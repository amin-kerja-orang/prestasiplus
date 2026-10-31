import { Inject, Injectable, Logger } from '@nestjs/common'
import {
  isQuestionWorkflowTransitionAllowed,
  QUESTION_MESSAGES,
  QuestionPartSchema,
  type QuestionPart,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { CLOCK, type Clock } from '../../db/clock'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { CurriculumRepository } from '../curriculum'
import { FilesService } from '../files'
import { UsersRepository } from '../users'
import { bulkFailureOf, notFoundFailure, questionNotFound, transitionConflict, type BulkFailure } from './errors'
import { gradeQuestion } from './grading'
import {
  difficultyOf,
  flatFromVersion,
  kertasOfPaperCode,
  keyIndexOf,
  languageToStore,
  partsFromFlat,
  paperCodeWithKertas,
  toPublic,
  type FlatSource,
  type FlatType,
} from './projection'
import { checkKeysGate, checkTagGate, MAX_SP_NODES } from './publish-gate'
import { GroupMembers } from './group-members'
import { QuestionsRepository, type NewGroup, type NewStimulus, type VersionDraft } from './questions.repository'
import { draftsFromParts, MAX_PART_DEPTH, referencedIds, versionTypeOf } from './tree'
import { isLeaf, leavesOf } from './grading'
import type {
  AdminListFilter,
  AdminListResult,
  ContributionCounts,
  NamedRef,
  Page,
  PartAnswer,
  PublicQuestion,
  QuestionActor,
  QuestionBulkAction,
  QuestionCreateInput,
  QuestionDetailView,
  QuestionGrade,
  QuestionGuruCreateInput,
  QuestionGuruUpdateInput,
  QuestionProvenance,
  QuestionRecord,
  QuestionStatus,
  QuestionStatusInfo,
  QuestionSummaryView,
  QuestionTag,
  QuestionUpdateInput,
  QuestionView,
  SetStatusOptions,
  StructuredListFilter,
  StructuredListResult,
} from './types'

/** A transaction that writes a whole version tree: raised above the Prisma default of 5 s. */
const TX = { timeout: 20_000, maxWait: 10_000 } as const

const parse = (text: string): bigint | null => {
  try {
    return BigInt(/^(0|[1-9]\d{0,18})$/.test(text) ? text : 'x')
  } catch {
    return null
  }
}

const fail = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })

interface FlatIssue {
  path: PropertyKey[]
  message: string
}
interface UnionLike {
  code: string
  path: readonly PropertyKey[]
  message: string
  errors?: readonly (readonly UnionLike[])[]
}

/**
 * A failed `z.union` reports only "Invalid input" at the union. This walks into the branches and keeps
 * the issue that got furthest into the value (longest path), so an `mcq` leaf with a `rubric` key
 * names `key.kind` instead of the whole part.
 */
function deepestIssue(issue: UnionLike, prefix: readonly PropertyKey[]): FlatIssue {
  const path = [...prefix, ...issue.path]
  if (issue.code === 'invalid_union' && issue.errors && issue.errors.length > 0) {
    let best: FlatIssue | undefined
    for (const branch of issue.errors) {
      for (const inner of branch) {
        const flat = deepestIssue(inner, path)
        if (!best || flat.path.length > best.path.length) best = flat
      }
    }
    if (best) return best
  }
  return { path, message: issue.message }
}

/** 422 text of a `pksk_choice` leaf sent to the general question routes (no `pksk` tag). */
export const PKSK_LEAF_REFUSED = 'Jenis soalan PKSK hanya boleh disimpan sebagai soalan PKSK.'

const MAX_TOP_PARTS = 20
const MAX_TOTAL_PARTS = 200
const MAX_IMAGES = 50
const PARTS_TOO_LARGE = 'Struktur soalan terlalu besar (maksimum 20 bahagian atas, 200 bahagian semua, 3 peringkat).'

/** Number of parts in a tree, counting every level; stops early once past the cap. */
function treeSize(parts: unknown, depth: number): number {
  if (!Array.isArray(parts) || depth > MAX_PART_DEPTH + 1) return 0
  let n = 0
  for (const p of parts) {
    n += 1 + treeSize((p as { children?: unknown } | null)?.children, depth + 1)
    if (n > MAX_TOTAL_PARTS) return n
  }
  return n
}

function treeDepth(parts: unknown, depth = 1): number {
  if (!Array.isArray(parts)) return depth - 1
  let max = depth
  for (const p of parts) {
    const kids = (p as { children?: unknown } | null)?.children
    if (Array.isArray(kids) && kids.length > 0) max = Math.max(max, treeDepth(kids, depth + 1))
    if (max > MAX_PART_DEPTH) return max
  }
  return max
}

/** The status an edit leaves behind: it never keeps an approval (the live `approved` version keeps serving; the edit is version n+1 as a draft, Q-5, ADR-0027). */
function statusAfterEdit(current: QuestionStatus): QuestionStatus {
  return current === 'approved' ? 'draft' : current
}

/** What create, update and the Guru routes all reduce to before touching the database. */
interface Normalized {
  subjectId: string
  educationLevelId: string
  /** 1..6, stored in `difficulty_tp`. */
  tp: number
  stem: string
  parts: QuestionPart[]
  language: VersionDraft['language']
  explanation: string | null
  tag?: QuestionTag | undefined
  dskpSpId?: string | null | undefined
  chapterId?: string | null | undefined
  topicId?: string | null | undefined
  stimulusGroupId?: string | null | undefined
  /** Stem image file id: a string sets/replaces it, null removes it, undefined keeps what is stored. */
  stemImage?: string | null | undefined
  /** Kertas: a digit sets it, null clears it, undefined keeps what is stored. */
  kertas?: '1' | '2' | '3' | null | undefined
  /** A source paper code stored verbatim (intake); wins over `kertas`. */
  paperCode?: string | null | undefined
  /** Who writes: image files must be theirs (or the actor is an admin) when they are new to the question. */
  actor: QuestionActor
  /** Message keys to use when a tag problem is found (flat bodies use `dskpSpId`). */
  flatSp: boolean
}

/**
 * Question bank use cases (M04, BE-09). Controllers (Part C) call the admin and Guru methods;
 * BE-10 calls `setStatus`, `getStatus`, `deactivate`; BE-12/15/41 call `getPublicForLearner` and
 * `gradeAnswer`; BE-17 calls `contributionCountsFor`.
 *
 * Errors: 404 `NOT_FOUND` for an unknown id and for a row the caller may not see; 422
 * `VALIDATION_ERROR` with `fields`; 409 `CONFLICT` for a status pair outside the contract table.
 */
@Injectable()
export class QuestionsService {
  private readonly logger = new Logger(QuestionsService.name)

  constructor(
    @Inject(QuestionsRepository) private readonly repo: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(UsersRepository) private readonly users: UsersRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(GroupMembers) private readonly groupMembers: GroupMembers,
  ) {}

  // --- admin (Admin Pusat) ----------------------------------------------------------------------

  async list(filter: AdminListFilter): Promise<AdminListResult> {
    const page = await this.repo.listIds(filter)
    const records = await this.repo.getMany(page.ids, 'latest')
    return { rows: await this.named(records), page: filter.page, pageSize: filter.pageSize, total: page.total, counts: page.counts }
  }

  async summary(): Promise<QuestionSummaryView> {
    const [subjects, totals] = await Promise.all([this.curriculum.subjects({ active: true }), this.repo.subjectTotals()])
    return {
      total: totals.total,
      subjects: subjects.map((s) => {
        const t = totals.bySubject.get(idToString(s.id))
        return {
          id: idToString(s.id),
          name: s.name,
          icon: s.icon,
          group: s.isCore ? ('teras' as const) : ('elektif' as const),
          total: t?.total ?? 0,
          approved: t?.published ?? 0,
        }
      }),
    }
  }

  async getAdmin(id: string): Promise<QuestionDetailView> {
    const record = await this.repo.get(id, 'latest')
    if (!record) throw questionNotFound()
    return this.detail(record)
  }

  async create(raw: QuestionCreateInput, actor: QuestionActor, provenance?: QuestionProvenance): Promise<QuestionView> {
    const input = await this.withImageKeys(raw)
    const flat: FlatSource = {
      questionType: input.questionType,
      questionText: input.questionText,
      ...(input.options === undefined ? {} : { options: input.options }),
      ...(input.correctAnswer === undefined ? {} : { correctAnswer: input.correctAnswer }),
      ...(input.tfAnswer === undefined ? {} : { tfAnswer: input.tfAnswer }),
      ...(input.correctAnswerText === undefined ? {} : { correctAnswerText: input.correctAnswerText }),
      ...(input.altAnswers === undefined ? {} : { altAnswers: input.altAnswers }),
      ...(input.modelAnswer === undefined ? {} : { modelAnswer: input.modelAnswer }),
      ...(input.pointsValue === undefined ? {} : { pointsValue: input.pointsValue }),
      ...(input.optionImageFileIds === undefined ? {} : { optionImageIds: input.optionImageFileIds }),
    }
    const parts = this.checkedParts(input.parts ?? partsFromFlat(flat), input.parts !== undefined)
    const status = input.status ?? 'draft'
    return this.createFrom(
      {
        subjectId: input.subjectId,
        educationLevelId: input.educationLevelId,
        tp: input.tag?.tp ?? input.difficultyLevel,
        stem: input.questionText,
        parts,
        language: languageToStore(input.language, undefined),
        explanation: input.explanation?.trim() || null,
        tag: input.tag,
        dskpSpId: input.dskpSpId,
        chapterId: input.curriculumChapterId,
        stimulusGroupId: input.stimulusGroupId,
        stemImage: input.questionImageFileId,
        kertas: input.kertas,
        paperCode: provenance?.paperCode,
        actor,
        flatSp: input.tag === undefined,
      },
      status,
      actor,
      provenance,
    )
  }

  /**
   * Creates a question like `create` and records its provenance (BE-38: an accepted intake item becomes a Draf question with
   * its source paper, file, page, region, number label, source type, run id and model). `status` is the one in `input`
   * (default `draft`); the intake never asks for more.
   */
  async createFromIntake(input: QuestionCreateInput, actor: QuestionActor, provenance: QuestionProvenance): Promise<QuestionView> {
    return this.create(input, actor, provenance)
  }

  async update(id: string, input: QuestionUpdateInput, actor: QuestionActor): Promise<QuestionView> {
    const record = await this.repo.get(id, 'latest')
    if (!record) throw questionNotFound()
    return this.viewOf(await this.applyUpdate(record, input, actor))
  }

  async remove(id: string, actor: QuestionActor): Promise<void> {
    void actor
    if (!(await this.repo.remove(id))) throw questionNotFound()
  }

  async bulkAction(action: QuestionBulkAction, ids: readonly string[], actor: QuestionActor): Promise<{ affected: number; ids: string[]; failed: BulkFailure[] }> {
    let affected = 0
    const done: string[] = []
    const failed: BulkFailure[] = []
    for (const id of new Set(ids)) {
      try {
        if (action === 'delete') {
          if (await this.repo.remove(id)) {
            affected += 1
            done.push(id)
          } else {
            failed.push(notFoundFailure(id))
          }
        } else {
          const a = actor as QuestionActor & { roleCode?: string; requestId?: string | null }
          await this.setStatus(id, action, actor.userId, { event: { actorUserId: actor.userId, actorRole: a.roleCode ?? actor.role, requestId: a.requestId ?? null } })
          affected += 1
          done.push(id)
        }
      } catch (e) {
        // An unknown id, a refused transition and a failed publish gate leave that id untouched.
        const failure = bulkFailureOf(id, e)
        if (!failure) throw e
        failed.push(failure)
      }
    }
    return { affected, ids: done, failed }
  }

  // --- lifecycle (BE-10 calls these) ------------------------------------------------------------

  async setStatus(id: string, status: QuestionStatus, _actorId: string, options: SetStatusOptions = {}): Promise<QuestionView> {
    const actor = options.actor ?? 'admin'
    await this.prisma.transaction(async () => {
      if (!(await this.repo.lock(id))) throw questionNotFound()
      const record = await this.repo.get(id, 'latest')
      if (!record) throw questionNotFound()
      const v = record.version
      if (!isQuestionWorkflowTransitionAllowed(v.status, status, actor)) throw transitionConflict(v.status, status)
      if (options.event) {
        await this.prisma.client.questionStatusEvent.create({
          data: { questionId: BigInt(id), versionNo: v.versionNo, fromStatus: v.status, toStatus: status, actorUserId: BigInt(options.event.actorUserId), actorRole: options.event.actorRole, reason: options.reason ?? null, requestId: options.event.requestId },
        })
      }
      if (status === 'approved') {
        const fields = checkTagGate({ subjectId: v.subjectId, educationLevelId: v.educationLevelId, unitId: v.unitId, spIds: v.spIds, tp: v.difficultyTp })
        Object.assign(fields, checkKeysGate(v.parts))
        if (Object.keys(fields).length > 0) throw fail(fields)
        // The version that served until now is superseded in the same transaction.
        if (record.liveVersionNo !== null && record.liveVersionNo !== v.versionNo) {
          await this.repo.setVersionStatus(id, record.liveVersionNo, 'archived', { archiveReason: 'superseded' })
        }
        await this.repo.setVersionStatus(id, v.versionNo, 'approved', { publishedAt: this.clock.now() })
        await this.repo.setLiveVersion(id, v.versionNo)
      } else if (v.status === 'approved') {
        // Taking the live version down (approved -> archived) ends its serving at once.
        await this.repo.setVersionStatus(id, v.versionNo, status, { archiveReason: 'withdrawn' })
        await this.repo.setLiveVersion(id, null)
      } else {
        await this.repo.setVersionStatus(id, v.versionNo, status)
        if (status === 'archived' && record.liveVersionNo !== null && record.liveVersionNo !== v.versionNo) {
          // Withdrawing a question whose latest edit is still a draft also ends the live version.
          await this.repo.setVersionStatus(id, record.liveVersionNo, 'archived', { archiveReason: 'withdrawn' })
          await this.repo.setLiveVersion(id, null)
        }
      }
    }, TX)
    const after = await this.repo.get(id, 'latest')
    if (!after) throw questionNotFound()
    return this.viewOf(after)
  }

  async getStatus(id: string): Promise<QuestionStatusInfo> {
    const r = await this.repo.get(id, 'latest')
    if (!r) throw questionNotFound()
    return {
      id: r.id,
      status: r.version.status,
      latestVersionNo: r.latestVersionNo,
      liveVersionNo: r.liveVersionNo,
      isActive: r.isActive,
      createdById: r.createdById,
    }
  }

  async deactivate(id: string): Promise<void> {
    if (!(await this.repo.deactivate(id))) throw questionNotFound()
  }

  async reactivate(id: string): Promise<void> {
    if (!(await this.repo.reactivate(id))) throw questionNotFound()
  }

  // --- structured (admin reads) -----------------------------------------------------------------

  async listStructured(filter: StructuredListFilter): Promise<StructuredListResult> {
    const [page, stats, subjects] = await Promise.all([this.repo.structuredIds(filter), this.repo.structuredStats(), this.curriculum.subjects()])
    const records = await this.repo.getMany(page.ids, 'latest')
    const names = new Map(subjects.map((s) => [idToString(s.id), s.name]))
    return {
      rows: await this.named(records),
      page: filter.page,
      pageSize: filter.pageSize,
      total: page.total,
      stats: {
        total: stats.total,
        published: stats.published,
        bySubject: [...stats.bySubject.entries()]
          .map(([sid, count]) => ({ name: names.get(sid) ?? '', count }))
          .filter((s) => s.name !== '')
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
    }
  }

  async getStructured(id: string): Promise<QuestionDetailView> {
    const record = await this.repo.get(id, 'latest')
    if (!record || record.version.type !== 'structured') throw questionNotFound()
    return this.detail(record)
  }

  // --- Guru (own rows only; another teacher id is 404) ------------------------------------------

  async listOwn(userId: string, page: number, pageSize = 20): Promise<Page<QuestionView>> {
    const res = await this.repo.listOwn({ ownerId: userId, page, pageSize })
    return { ...res, rows: await this.named(res.rows) }
  }

  async getOwn(id: string, userId: string): Promise<QuestionDetailView> {
    return this.detail(await this.owned(id, userId))
  }

  async createGuru(raw: QuestionGuruCreateInput, userId: string): Promise<QuestionDetailView> {
    const input = await this.withImageKeys(raw)
    const flat: FlatSource = {
      questionType: input.questionType,
      questionText: input.questionText,
      ...(input.options === undefined ? {} : { options: input.options }),
      ...(input.correctAnswer === undefined ? {} : { correctAnswer: input.correctAnswer }),
      ...(input.tfAnswer === undefined ? {} : { tfAnswer: input.tfAnswer }),
      ...(input.correctAnswerText === undefined ? {} : { correctAnswerText: input.correctAnswerText }),
      ...(input.altAnswers === undefined ? {} : { altAnswers: input.altAnswers }),
      ...(input.modelAnswer === undefined ? {} : { modelAnswer: input.modelAnswer }),
      ...(input.optionImageFileIds === undefined ? {} : { optionImageIds: input.optionImageFileIds }),
    }
    const parts = this.checkedParts(input.parts ?? partsFromFlat(flat), input.parts !== undefined)
    const created = await this.createFrom(
      {
        subjectId: input.subjectId,
        educationLevelId: input.educationLevelId,
        tp: input.tag?.tp ?? difficultyOf(input.difficultyLevel),
        stem: input.questionText,
        parts,
        language: languageToStore(undefined, input.scriptType),
        explanation: input.explanation?.trim() || null,
        tag: input.tag,
        dskpSpId: input.dskpSpId,
        chapterId: input.curriculumChapterId,
        topicId: input.curriculumTopicId,
        stemImage: input.questionImageFileId,
        actor: { userId, role: 'teacher' },
        flatSp: input.tag === undefined,
      },
      'review',
      { userId, role: 'teacher' },
    )
    return this.detail(created)
  }

  async updateOwn(id: string, input: QuestionGuruUpdateInput, userId: string): Promise<QuestionDetailView> {
    const record = await this.owned(id, userId)
    const flat = flatFromVersion(record.version)
    const touchesKey = input.options !== undefined || input.correctOptionId !== undefined
    if (touchesKey && flat.questionType !== 'mcq') {
      throw fail({ options: QUESTION_MESSAGES.options })
    }
    const body: QuestionUpdateInput = {
      subjectId: record.version.subjectId ?? '',
      educationLevelId: record.version.educationLevelId ?? '',
      difficultyLevel: input.difficultyLevel === undefined ? flat.difficultyLevel : difficultyOf(input.difficultyLevel),
      questionText: input.questionText,
      ...(input.explanation === undefined ? {} : { explanation: input.explanation }),
      ...(input.options === undefined
        ? {}
        : { options: [...input.options].sort((a, b) => Number((a as { id: number }).id) - Number((b as { id: number }).id)) }),
      ...(input.correctOptionId === undefined ? {} : { correctAnswer: keyIndexOf(input.correctOptionId) ?? 0 }),
      ...(input.questionImageFileId === undefined ? {} : { questionImageFileId: input.questionImageFileId }),
      ...(input.optionImageFileIds === undefined ? {} : { optionImageFileIds: input.optionImageFileIds }),
      ...(input.removeQuestionImage === undefined ? {} : { removeQuestionImage: input.removeQuestionImage }),
      ...(input.removeOptionImage === undefined ? {} : { removeOptionImage: input.removeOptionImage }),
    }
    return this.detail(await this.applyUpdate(record, body, { userId, role: 'teacher' }, { keepSubject: true }))
  }

  async removeOwn(id: string, userId: string): Promise<void> {
    await this.owned(id, userId)
    await this.repo.remove(id)
  }

  async contributionCountsFor(userId: string): Promise<ContributionCounts> {
    const byStatus = await this.repo.ownerStatusCounts(userId)
    return { total: Object.values(byStatus).reduce((s, n) => s + n, 0), byStatus }
  }

  // --- learners (BE-12, BE-15, BE-41); there is no student HTTP route (Q-3) ---------------------

  async getPublicForLearner(id: string): Promise<PublicQuestion> {
    const record = await this.repo.get(id, 'live')
    if (!record || !record.isActive || record.version.status !== 'approved') throw questionNotFound()
    return toPublic(record)
  }

  async gradeAnswer(id: string, answers: readonly PartAnswer[]): Promise<QuestionGrade> {
    const record = await this.repo.get(id, 'live')
    if (!record || !record.isActive || record.version.status !== 'approved') throw questionNotFound()
    return gradeQuestion(record.id, record.version.parts, answers)
  }

  // --- stimuli and groups (tests and later cards; no HTTP route in this contract) ---------------

  createStimulus(input: NewStimulus): Promise<string> {
    return this.repo.createStimulus(input)
  }

  /** At most 3 stimuli per group (OD-28): a 4th is a 422 on `stimuli`. */
  async createStimulusGroup(input: Omit<NewGroup, 'stimulusIds'> & { stimulusIds: readonly string[] }): Promise<string> {
    if (input.stimulusIds.length < 1 || input.stimulusIds.length > 3) {
      throw fail({ stimuli: 'Satu kumpulan mesti mempunyai 1 hingga 3 stimulus.' })
    }
    if (new Set(input.stimulusIds).size !== input.stimulusIds.length || !(await this.repo.stimuliExist(input.stimulusIds))) {
      throw fail({ stimuli: 'Stimulus tidak sah.' })
    }
    return this.repo.createGroup({ ...input, stimulusIds: input.stimulusIds.map((s) => BigInt(s)) })
  }

  // --- internals ----------------------------------------------------------------------------------

  private async owned(id: string, userId: string): Promise<QuestionRecord> {
    const owner = await this.repo.ownerOf(id)
    if (owner === undefined || owner !== userId) throw questionNotFound()
    const record = await this.repo.get(id, 'latest')
    if (!record) throw questionNotFound()
    return record
  }

  /** Re-validates a built tree with the contract; a failure is a 422 on the first offending path. */
  private checkedParts(parts: QuestionPart[], supplied: boolean): QuestionPart[] {
    // Size caps run on the raw input, before the schema walks it (DoS): top level, total and depth.
    if (parts.length > MAX_TOP_PARTS || treeSize(parts, 1) > MAX_TOTAL_PARTS || treeDepth(parts) > MAX_PART_DEPTH) {
      throw fail({ parts: PARTS_TOO_LARGE })
    }
    const res = QuestionPartSchema.array().min(1).max(20).safeParse(parts)
    if (res.success) {
      // BE-42: the PKSK leaf is valid only on a question tagged `pksk_domain`, which only PkskQuestionsService writes.
      if (leavesOf(res.data).some(({ leaf }) => leaf.mode === 'pksk_choice')) throw fail({ [supplied ? 'parts' : 'questionType']: PKSK_LEAF_REFUSED })
      return res.data
    }
    const issue = res.error.issues[0]
    const deepest = issue ? deepestIssue(issue as UnionLike, []) : { path: [] as PropertyKey[], message: 'Data tidak sah.' }
    const key = supplied ? ['parts', ...deepest.path.map(String)].join('.') : this.flatKeyOf(deepest.path)
    throw fail({ [key]: deepest.message })
  }

  /**
   * The body names its image files by the public token `POST /files` returned (or an internal decimal id). The store keeps
   * internal ids, so tokens are swapped here, before the tree is built; an unknown token stays as sent and fails the
   * image check with the same 422 as any other bad image.
   */
  private async withImageKeys<T extends { questionImageFileId?: string | null | undefined; optionImageFileIds?: (string | null)[] | undefined }>(input: T): Promise<T> {
    const out: T = { ...input }
    if (typeof out.questionImageFileId === 'string') out.questionImageFileId = await this.files.internalIdOf(out.questionImageFileId)
    if (out.optionImageFileIds) out.optionImageFileIds = await Promise.all(out.optionImageFileIds.map((id) => (typeof id === 'string' ? this.files.internalIdOf(id) : id)))
    return out
  }

  /** The flat body field that a failure inside the single generated leaf points to. */
  private flatKeyOf(path: readonly PropertyKey[]): string {
    const flat = path.map(String)
    if (flat.includes('options')) return 'options'
    if (flat.includes('key')) return 'correctAnswer'
    return 'questionText'
  }

  private async createFrom(n: Normalized, status: QuestionStatus, actor: QuestionActor, provenance?: QuestionProvenance): Promise<QuestionView> {
    const { draft, newStemFileId } = await this.draftOf(n, status, null)
    if (provenance) {
      draft.numberLabel = provenance.numberLabel
      draft.sourcePage = provenance.sourcePage
    }
    if (status === 'approved') {
      const fields = checkTagGate({
        subjectId: draft.subjectId === null ? null : idToString(draft.subjectId),
        educationLevelId: draft.educationLevelId === null ? null : idToString(draft.educationLevelId),
        unitId: draft.unitNodeId === null ? null : idToString(draft.unitNodeId),
        spIds: draft.spNodeIds.map(idToString),
        tp: draft.difficultyTp,
      })
      // Same keys rule BE-10 offers: marks of a points key equal the leaf marks and the sum of its points.
      Object.assign(fields, checkKeysGate(n.parts))
      if (Object.keys(fields).length > 0) throw fail(fields)
    }
    const creator = parse(actor.userId)
    const id = await this.prisma.transaction(async () => {
      await this.attachStem(draft, newStemFileId)
      const groupId = n.stimulusGroupId ? n.stimulusGroupId : null
      const created = await this.repo.create({
        sourceType: provenance?.sourceType ?? 'manual',
        createdById: creator,
        groupId: groupId === null ? null : BigInt(groupId),
        // D90 / R1-T32: the same member rules as the stimulus routes; locks the group so concurrent creates get distinct positions.
        groupPosition: groupId === null ? null : await this.groupMembers.joinNew(groupId, draft.subjectId === null ? null : idToString(draft.subjectId), kertasOfPaperCode(draft.paperCode ?? null)),
        now: this.clock.now(),
        version: draft,
        ...(provenance
          ? {
              provenance: {
                sourceRegion: provenance.sourceRegion,
                sourcePaperId: parse(provenance.sourcePaperId ?? ''),
                intakeItemId: parse(provenance.intakeItemId ?? ''),
                sourceFileId: parse(provenance.sourceFileId ?? ''),
                aiRunId: parse(provenance.aiRunId ?? ''),
                aiModel: provenance.aiModel,
              },
            }
          : {}),
      })
      return created
    }, TX)
    const record = await this.repo.get(id, 'latest')
    if (!record) throw questionNotFound()
    return this.viewOf(record)
  }

  /**
   * Validates references (subject, level, tag nodes, chapter, topic, images, stimuli, group) against
   * their owners and builds the version columns. All failures land in one `fields` map.
   * `previous`: the version being edited (keeps its non-edited columns).
   */
  private async draftOf(n: Normalized, status: QuestionStatus, previous: QuestionRecord | null): Promise<{ draft: VersionDraft; newStemFileId: bigint | null }> {
    const fields: Record<string, string> = {}
    const subjectKey = parse(n.subjectId)
    const levelKey = parse(n.educationLevelId)
    const subject = subjectKey === null ? null : await this.curriculum.subject(subjectKey)
    const level = levelKey === null ? null : await this.curriculum.level(levelKey)
    if (!subject) fields.subjectId = QUESTION_MESSAGES.subject
    // Secondary-only (D72): a Darjah (primary-stage) level cannot be written; same refusal as an unknown level.
    if (!level || level.stage === 'primary') fields.educationLevelId = QUESTION_MESSAGES.level
    if (!Number.isInteger(n.tp) || n.tp < 1 || n.tp > 6) fields.difficultyLevel = QUESTION_MESSAGES.difficulty

    // Curriculum tag: unit (kind unit), 1 to 3 SP nodes (kind sp), all of this subject and level.
    let unitKey: bigint | null = null
    let spKeys: bigint[] = []
    const spField = n.flatSp ? 'dskpSpId' : 'tag.spIds'
    const spMessage = n.flatSp ? QUESTION_MESSAGES.sp : 'SP DSKP tidak sah.'
    const wantedSp = [...new Set(n.tag ? n.tag.spIds : n.dskpSpId ? [n.dskpSpId] : [])]
    if (wantedSp.length > MAX_SP_NODES) fields.tag = 'Satu soalan boleh mempunyai 1 hingga 3 SP sahaja.'
    const belongs = (node: { subjectId: bigint; educationLevelId: bigint }): boolean =>
      subject !== null && level !== null && node.subjectId === subject.id && node.educationLevelId === level.id
    if (wantedSp.length <= MAX_SP_NODES) {
      for (const spId of wantedSp) {
        const key = parse(spId)
        const node = key === null ? null : await this.curriculum.nodeById(key)
        if (!node || node.kind !== 'sp' || (subject && level && !belongs(node))) {
          fields[spField] = spMessage
          break
        }
        spKeys.push(node.id)
      }
      if (fields[spField] !== undefined) spKeys = []
    }
    if (n.tag?.unitId) {
      const key = parse(n.tag.unitId)
      const node = key === null ? null : await this.curriculum.nodeById(key)
      if (!node || node.kind !== 'unit' || (subject && level && !belongs(node))) fields['tag.unitId'] = 'Unit DSKP tidak sah.'
      else unitKey = node.id
    } else if (spKeys.length > 0 && fields[spField] === undefined) {
      // No unit sent: the unit is the ancestor of the first SP, when it has one.
      const chain = await this.curriculum.ancestorsOf(spKeys[0] as bigint)
      unitKey = chain.find((a) => a.kind === 'unit')?.id ?? null
    }

    let chapterKey: bigint | null = null
    let topicKey: bigint | null = null
    if (n.chapterId) {
      const key = parse(n.chapterId)
      const chapter = key === null ? null : await this.curriculum.chapter(key)
      if (!chapter) fields.curriculumChapterId = QUESTION_MESSAGES.guruChapter
      // REQ-B-010: each of subject and level that is known is checked on its own (a chapter of another subject is refused even with no level).
      else if ((subject && chapter.subjectId !== subject.id) || (level && chapter.educationLevelId !== level.id)) fields.curriculumChapterId = QUESTION_MESSAGES.chapterMismatch
      else chapterKey = chapter.id
    } else if (n.chapterId === undefined && previous?.version.chapterId && (subject || level)) {
      // The chapter is kept while it still belongs to the subject and the level being saved (the one that is known, when the other is empty).
      const kept = await this.curriculum.chapter(BigInt(previous.version.chapterId))
      if (kept && (!subject || kept.subjectId === subject.id) && (!level || kept.educationLevelId === level.id)) chapterKey = kept.id
    }
    if (n.topicId) {
      const key = parse(n.topicId)
      const topic = key === null ? null : await this.curriculum.topic(key)
      if (!topic || (chapterKey !== null && topic.chapterId !== chapterKey)) fields.curriculumTopicId = QUESTION_MESSAGES.guruTopic
      else topicKey = topic.id
    }

    // Images are existing `question_image` files; stimuli and the group must exist.
    const refs = referencedIds(n.parts)
    const imageIds = [...new Set(refs.imageIds)]
    // Files already on the stored version are not checked for ownership again (a Guru may edit an admin's question).
    const stored = new Set<string>(previous ? referencedIds(previous.version.parts).imageIds : [])
    const storedStem = previous?.version.stemImageId ?? null
    if (storedStem !== null) stored.add(storedStem)
    const stemId = typeof n.stemImage === 'string' ? n.stemImage : null
    if (imageIds.length + (stemId !== null ? 1 : 0) > MAX_IMAGES) {
      fields.imageIds = 'Satu soalan boleh mempunyai paling banyak ' + String(MAX_IMAGES) + ' imej.'
    } else {
      const bad = async (imageId: string): Promise<boolean> => {
        const meta = await this.files.metaOf(imageId)
        // Missing, wrong purpose and someone else's NEW file all answer alike (no existence oracle).
        // An unowned file (no owner) counts as foreign too: fail closed for everyone but an admin.
        const foreign = !stored.has(imageId) && meta !== null && meta.ownerUserId !== n.actor.userId && n.actor.role !== 'admin'
        return !meta || meta.purpose !== 'question_image' || foreign
      }
      for (const imageId of imageIds) {
        if (await bad(imageId)) fields[this.imageKey(n.parts, imageId)] = QUESTION_MESSAGES.image
      }
      if (stemId !== null && (await bad(stemId))) fields.questionImage = QUESTION_MESSAGES.image
    }
    // BJS-06: a leaf unit override must be a unit node of this subject and level.
    for (const unitId of new Set(refs.unitIds)) {
      const key = parse(unitId)
      const node = key === null ? null : await this.curriculum.nodeById(key)
      if (!node || node.kind !== 'unit' || (subject && level && !belongs(node))) {
        fields.parts = 'Unit DSKP bahagian soalan tidak sah.' // [PROPOSED] copy
        break
      }
    }
    if (refs.stimulusIds.length > 0 && !(await this.repo.stimuliExist(refs.stimulusIds))) fields.parts = 'Stimulus tidak sah.'
    if (n.stimulusGroupId && !(await this.repo.groupExists(n.stimulusGroupId))) fields.stimulusGroupId = 'Kumpulan stimulus tidak sah.'

    if (Object.keys(fields).length > 0) throw fail(fields)

    const v = previous?.version
    // Stem image: an image stimulus linked to the version. Other stimuli stay; only the image one is swapped.
    let stimulusIds = v?.stimulusIds.map((s) => BigInt(s)) ?? []
    let newStemFileId: bigint | null = null
    if (n.stemImage !== undefined && v) {
      const assets = await this.repo.stimulusAssets(v.stimulusIds)
      const imageStimuli = new Set(assets.filter((a) => a.kind === 'image' && a.assetFileId !== null).map((a) => a.id))
      const sameFile = typeof n.stemImage === 'string' && n.stemImage === v.stemImageId
      if (!sameFile) stimulusIds = v.stimulusIds.filter((s) => !imageStimuli.has(s)).map((s) => BigInt(s))
    }
    if (typeof n.stemImage === 'string' && n.stemImage !== (v?.stemImageId ?? null)) newStemFileId = BigInt(n.stemImage)
    // Kertas: the trailing digit of the paper code is what the paper builder reads.
    const paperCode =
      n.paperCode !== undefined && n.paperCode !== null
        ? n.paperCode
        : n.kertas === undefined
          ? (v?.paperCode ?? null)
          : paperCodeWithKertas(v?.paperCode, n.kertas, subject?.code ?? null)
    const draft: VersionDraft = {
      status,
      type: versionTypeOf(n.parts),
      stemMs: n.stem,
      stemEn: v?.stemEn ?? null,
      numberLabel: v?.numberLabel ?? null,
      language: n.language,
      explanationMs: n.explanation,
      explanationEn: v?.explanationEn ?? null,
      subjectId: subject?.id ?? null,
      educationLevelId: level?.id ?? null,
      unitNodeId: unitKey,
      chapterId: chapterKey,
      topicId: n.topicId === undefined ? (v?.topicId ? BigInt(v.topicId) : null) : topicKey,
      formOrigin: v?.formOrigin ?? this.formOriginOf(level?.code),
      cognitiveLevel: v?.cognitiveLevel ?? null,
      kbat: v?.kbat ?? null,
      tagReview: v?.tagReview ?? false,
      catalogueVersion: v?.catalogueVersion ?? null,
      difficultyTp: n.tp,
      sourcePage: v?.sourcePage ?? null,
      setLabel: v?.setLabel ?? null,
      spNodeIds: spKeys,
      paperCode,
      stimulusIds,
      parts: draftsFromParts(n.parts),
    }
    return { draft, newStemFileId }
  }

  /** Inside the write transaction: creates the image stimulus of a new stem image and links it first. */
  private async attachStem(draft: VersionDraft, fileId: bigint | null): Promise<void> {
    if (fileId === null) return
    const id = await this.repo.createStimulus({ kind: 'image', label: null, bodyMs: null, bodyEn: null, altText: null, assetFileId: fileId })
    draft.stimulusIds = [BigInt(id), ...draft.stimulusIds]
  }

  private formOriginOf(levelCode: string | undefined): VersionDraft['formOrigin'] {
    return levelCode === 'T5' ? 't5' : levelCode === 'T4' ? 't4' : 't1_t3'
  }

  /** The `fields` key of a bad option image: `parts.<path>.options.<i>.imageId`. */
  private imageKey(parts: readonly QuestionPart[], imageId: string, prefix: string[] = []): string {
    for (const part of parts) {
      const path = [...prefix, part.label]
      if (isLeaf(part)) {
        if (part.mode === 'mcq') {
          const i = part.options.findIndex((o) => o.imageId === imageId)
          if (i >= 0) return `optionImages.${String(i)}`
        }
      } else {
        const inner = this.imageKey(part.children as QuestionPart[], imageId, path)
        if (inner !== 'questionImage') return inner
      }
    }
    return 'questionImage'
  }

  /** PUT: merge the body over the stored latest version and write it (new version when approved). */
  private async applyUpdate(record: QuestionRecord, rawInput: QuestionUpdateInput, actor: QuestionActor, opts: { keepSubject?: boolean } = {}): Promise<QuestionRecord> {
    const input = await this.withImageKeys(rawInput)
    const v = record.version
    const flat = flatFromVersion(v)
    const single = v.parts.length === 1 ? v.parts[0] : undefined
    const flatShaped = single !== undefined && isLeaf(single) && (single.mode === 'mcq' || single.mode === 'short_text' || single.mode === 'essay')

    let parts: QuestionPart[]
    if (input.parts) {
      parts = this.checkedParts(input.parts, true)
    } else if (flatShaped) {
      // Remove wins; else a sent id (or null = no image) replaces the stored one; an omitted position keeps it.
      const optionImageIds = flat.optionImageIds.map((id, i) =>
        input.removeOptionImage?.[i] ? null : input.optionImageFileIds?.[i] !== undefined ? (input.optionImageFileIds[i] ?? null) : id,
      )
      const src: FlatSource = {
        questionType: flat.questionType as FlatType,
        questionText: input.questionText,
        pointsValue: input.pointsValue ?? flat.pointsValue,
        optionImageIds,
        options: input.options ?? flat.options ?? [],
        correctAnswer: input.correctAnswer ?? flat.correctAnswer ?? 0,
        tfAnswer: input.tfAnswer === undefined ? flat.tfAnswer : input.tfAnswer,
        correctAnswerText: input.correctAnswerText === undefined ? flat.correctAnswerText : input.correctAnswerText,
        altAnswers: input.altAnswers ?? flat.altAnswers,
        modelAnswer: input.modelAnswer === undefined ? flat.modelAnswer : input.modelAnswer,
      }
      if (flat.questionType === 'mcq' && src.options !== undefined && src.options.length !== 4) throw fail({ options: QUESTION_MESSAGES.options })
      parts = this.checkedParts(partsFromFlat(src), false)
    } else {
      parts = v.parts
    }

    // Level 5 on the flat scale may be TP 5 or 6: keep the stored TP when the body repeats what was read.
    const keepTp = v.difficultyTp !== null && input.difficultyLevel === flat.difficultyLevel
    const language = input.language === undefined
      ? v.language
      : v.language === 'ar' || v.language === 'jawi' || v.language === 'ms_en'
        ? v.language
        : languageToStore(input.language, undefined)
    const dskpSpId = input.dskpSpId === undefined ? undefined : input.dskpSpId === '' ? null : input.dskpSpId
    const normalized: Normalized = {
      subjectId: opts.keepSubject ? (v.subjectId ?? input.subjectId) : input.subjectId,
      educationLevelId: opts.keepSubject ? (v.educationLevelId ?? input.educationLevelId) : input.educationLevelId,
      tp: input.tag?.tp ?? (keepTp && v.difficultyTp !== null ? v.difficultyTp : input.difficultyLevel),
      stem: input.questionText,
      parts,
      language,
      explanation: input.explanation === undefined ? v.explanationMs : input.explanation?.trim() || null,
      ...(input.tag
        ? { tag: input.tag }
        : dskpSpId !== undefined
          ? { dskpSpId }
          : { tag: { unitId: v.unitId, spIds: v.spIds, tp: v.difficultyTp } }),
      actor,
      flatSp: !input.tag && dskpSpId !== undefined,
    }
    if (input.stimulusGroupId !== undefined) normalized.stimulusGroupId = input.stimulusGroupId
    if (input.curriculumChapterId !== undefined) normalized.chapterId = input.curriculumChapterId
    const stemImage = input.removeQuestionImage === true ? null : input.questionImageFileId
    if (stemImage !== undefined) normalized.stemImage = stemImage
    if (input.kertas !== undefined) normalized.kertas = input.kertas

    let { draft, newStemFileId } = await this.draftOf(normalized, statusAfterEdit(v.status), record)
    const now = this.clock.now()
    await this.prisma.transaction(async () => {
      // Two concurrent edits serialise here; the second one sees the first one's version.
      if (!(await this.repo.lock(record.id))) throw questionNotFound()
      const fresh = await this.repo.get(record.id, 'latest')
      if (!fresh) throw questionNotFound()
      // The image set, stimuli and paper code were derived from the record read before the lock. If another edit landed in
      // between, derive them again from the version read under the lock.
      if (fresh.version.versionNo !== v.versionNo || fresh.version.updatedAt.getTime() !== v.updatedAt.getTime()) {
        ;({ draft, newStemFileId } = await this.draftOf(normalized, statusAfterEdit(fresh.version.status), fresh))
      }
      await this.attachStem(draft, newStemFileId)
      const next = { ...draft, status: statusAfterEdit(fresh.version.status) }
      if (fresh.version.status === 'approved') {
        // Q-5: the live version keeps serving; the edit is version n+1 as a draft.
        await this.repo.addVersion(record.id, fresh.latestVersionNo + 1, next, now)
      } else {
        await this.repo.rewriteVersion(record.id, fresh.version.versionNo, next, now)
      }
      // R1-T49: a grouped question that changes subject or kertas must still fit the other members (the only member may change freely).
      if (fresh.groupId !== null && input.stimulusGroupId === undefined) {
        const after = { subject: draft.subjectId === null ? null : idToString(draft.subjectId), kertas: kertasOfPaperCode(draft.paperCode ?? null) }
        const before = { subject: fresh.version.subjectId, kertas: kertasOfPaperCode(fresh.version.paperCode) }
        if (after.subject !== before.subject || after.kertas !== before.kertas) await this.groupMembers.assertTraitChange(fresh.groupId, record.id, after.subject, after.kertas)
      }
      if (input.stimulusGroupId !== undefined) {
        // D90 / R1-T32: leaving or joining a group goes through the same rules as the stimulus routes (served lock, caps, PKSK, ...).
        await this.groupMembers.move(record.id, fresh.groupId, input.stimulusGroupId)
      }
    }, TX)
    const after = await this.repo.get(record.id, 'latest')
    if (!after) throw questionNotFound()
    return after
  }

  // --- views --------------------------------------------------------------------------------------

  private async refs(): Promise<{ subjects: Map<string, NamedRef>; levels: Map<string, NamedRef> }> {
    const [subjects, levels] = await Promise.all([this.curriculum.subjects(), this.curriculum.levels({ includeInactive: true })])
    return {
      subjects: new Map(subjects.map((s) => [idToString(s.id), { id: idToString(s.id), name: s.name }])),
      levels: new Map(levels.map((l) => [idToString(l.id), { id: idToString(l.id), name: l.name }])),
    }
  }

  private async named(records: QuestionRecord[]): Promise<QuestionView[]> {
    if (records.length === 0) return []
    const refs = await this.refs()
    // The wire names an image by its public token (the id `POST /files` returned), not the internal key.
    const fileIds = new Set<string>()
    for (const r of records) {
      if (r.version.stemImageId) fileIds.add(r.version.stemImageId)
      for (const id of flatFromVersion(r.version).optionImageIds) if (id) fileIds.add(id)
    }
    const chapterIds = [...new Set(records.map((r) => r.version.chapterId).filter((c): c is string => !!c).map((c) => BigInt(c)))]
    const chapterNames = new Map(
      (chapterIds.length === 0 ? [] : await this.curriculum.chaptersByIds(chapterIds)).map((c) => [idToString(c.id), c.name]),
    )
    const tokens = fileIds.size === 0 ? new Map<string, string>() : await this.files.publicIdsOf([...fileIds])
    return records.map((r) => ({
      ...r,
      subject: (r.version.subjectId && refs.subjects.get(r.version.subjectId)) || null,
      level: (r.version.educationLevelId && refs.levels.get(r.version.educationLevelId)) || null,
      imageTokens: Object.fromEntries(tokens),
      chapterName: (r.version.chapterId && chapterNames.get(r.version.chapterId)) || null,
    }))
  }

  private async viewOf(record: QuestionRecord): Promise<QuestionView> {
    const [view] = await this.named([record])
    return view as QuestionView
  }

  private async detail(record: QuestionRecord): Promise<QuestionDetailView> {
    const view = await this.viewOf(record)
    const creator = record.createdById ? await this.users.get(record.createdById) : null
    const stimulusGroup = record.groupId ? await this.repo.groupOf(record.id) : null
    // The pictures of the group's stimuli are named by public token too (one form for the Studio, R1-T32).
    const assetIds = (stimulusGroup?.stimuli ?? []).flatMap((s) => (s.assetFileId === null ? [] : [s.assetFileId]))
    const assetTokens = assetIds.length === 0 ? new Map<string, string>() : await this.files.publicIdsOf(assetIds)
    return {
      ...view,
      imageTokens: { ...view.imageTokens, ...Object.fromEntries(assetTokens) },
      dskp: await this.dskpOf(record.version.spIds[0]),
      createdByName: creator?.name ?? null,
      stimulusGroup,
    }
  }

  /** The DSKP chain of the first SP: bidang (grouping, else unit), SK and the SP itself. */
  private async dskpOf(spId: string | undefined): Promise<QuestionDetailView['dskp']> {
    const key = spId === undefined ? null : parse(spId)
    if (key === null) return null
    const sp = await this.curriculum.nodeById(key)
    if (!sp) return null
    const chain = await this.curriculum.ancestorsOf(sp.id)
    const sk = chain.find((a) => a.kind === 'sk')
    const bidang = chain.find((a) => a.kind === 'grouping') ?? chain.find((a) => a.kind === 'unit')
    if (!sk || !bidang) return null
    return {
      bidang: { id: idToString(bidang.id), code: bidang.kind === 'grouping' ? null : bidang.code, name: bidang.title },
      sk: { id: idToString(sk.id), code: sk.code, description: sk.title },
      sp: { id: idToString(sp.id), code: sp.code, description: sp.title },
    }
  }
}

