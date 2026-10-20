import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_MESSAGES as MESSAGES,
  BijakBuilderPaperCreateSchema,
  BijakBuilderPaperListQuerySchema,
  BijakBuilderPaperPatchSchema,
  BijakBuilderPreviewRequestSchema,
  type BijakBlueprintView,
  type BijakBuilderEditor,
  type BijakBuilderPaper,
  type BijakBuilderPaperStatus,
  type BijakBuilderPaperSummary,
  type BijakBuilderPreview,
  type BijakBuilderPublishResult,
  type BijakBuilderQuestion,
  type ListMeta,
} from '@pp/contract'
import type { z } from 'zod'

import { AUDIT_ACTIONS, AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import { toMytTimestamp } from '../../../common/time/myt'
import { ZodValidationPipe } from '../../../common/validation/zod-validation.pipe'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { bijakCodeOf, curriculumCodeOf } from '../../bijak/papers/subject-codes'
import { mytYear, referencePanels, ruleOf, sectionInstruction } from '../../bijak/papers/rules'
import { blueprintView } from '../blueprints/blueprint-view'
import type { AuditActor } from './actor'
import { BIJAK_BUILDER_PAGE_SIZE } from './builder.constants'
import { BuilderRepository, type PaperTree, type SubjectRef } from './builder.repository'
import { checkPaper, publishErrors, type PaperCheck } from './paper-check'
import { BijakBuilderPorts, type BuilderGroupInfo, type BuilderQuestionInfo, type BuilderQuestionRef } from './ports'

type Info = ReadonlyMap<string, BuilderQuestionInfo>

const MAX_KERTAS = 32767

const DEFAULT_TITLE = (subjectName: string, kertas: number) => `Percubaan SPM ${subjectName} Kertas ${String(kertas)} (draf)`

const statusOf = (dbStatus: string): BijakBuilderPaperStatus => (dbStatus === 'published' ? 'terbit' : 'draf')

const notFound = () => ApiError.of('NOT_FOUND', { message: MESSAGES.paperNotFound })
const invalid = (message: string) => ApiError.of('VALIDATION_ERROR', { message })

function parseId(text: string): bigint | null {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

/** Parses a raw body or query with a contract schema; failure is 422 VALIDATION_ERROR with `fields`. */
function parseWith<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  return new ZodValidationPipe(schema).transform(value)
}

interface Evaluation {
  info: Info
  groups: ReadonlyMap<string, BuilderGroupInfo>
  check: PaperCheck
}

/**
 * Paper builder (BE-39): drafts, placements, conformance, publish and withdraw of curated papers.
 * Every paper write runs in one transaction that locks the paper row first and records one audit row.
 * Questions are read only through `BijakBuilderPorts` (M04 owns them).
 */
@Injectable()
export class BuilderService {
  constructor(
    @Inject(BuilderRepository) private readonly repo: BuilderRepository,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(BijakBuilderPorts) private readonly ports: BijakBuilderPorts,
  ) {}

  private get questions() {
    return this.ports.questionSource
  }

  // --- conformance -------------------------------------------------------------------------------

  /** Question refs of a paper: pinned versions once published, the current version while it is a draft. */
  private refsOf(paper: PaperTree): BuilderQuestionRef[] {
    const pinned = paper.status === 'published'
    const seen = new Map<string, BuilderQuestionRef>()
    for (const s of paper.sections)
      for (const pl of s.placements) {
        const id = idToString(pl.questionId)
        if (!seen.has(id)) seen.set(id, pinned ? { id, versionNo: pl.pinnedVersionNo } : { id })
      }
    return [...seen.values()]
  }

  /**
   * Evaluates papers against ONE `describe` call for the current refs of the drafts, one call per
   * "layer" of pinned refs of the published papers (normally one: a layer holds at most one version
   * per question id, because `describe` is keyed by id), and ONE `groups` call for all of them.
   */
  private async evaluateMany(papers: readonly PaperTree[]): Promise<Evaluation[]> {
    const current = new Set<string>()
    const pinned = new Map<string, number[]>()
    for (const paper of papers)
      for (const ref of this.refsOf(paper)) {
        if (ref.versionNo === undefined) current.add(ref.id)
        else {
          const versions = pinned.get(ref.id) ?? []
          if (!versions.includes(ref.versionNo)) versions.push(ref.versionNo)
          pinned.set(ref.id, versions)
        }
      }
    const described = new Map<string, BuilderQuestionInfo>() // key: `${id}@${versionNo | 'now'}`
    if (current.size) {
      const got = await this.questions.describe([...current].map((id) => ({ id })))
      for (const [id, info] of got) described.set(`${id}@now`, info)
    }
    const layers = Math.max(0, ...[...pinned.values()].map((v) => v.length))
    for (let i = 0; i < layers; i++) {
      const refs = [...pinned].flatMap(([id, versions]) => (versions[i] === undefined ? [] : [{ id, versionNo: versions[i]! }]))
      const got = await this.questions.describe(refs)
      for (const ref of refs) {
        const info = got.get(ref.id)
        if (info) described.set(`${ref.id}@${String(ref.versionNo)}`, info)
      }
    }
    const groupIds = [...new Set([...described.values()].flatMap((i) => (i.groupId ? [i.groupId] : [])))]
    const groups = groupIds.length ? await this.questions.groups(groupIds) : new Map<string, BuilderGroupInfo>()

    return papers.map((paper) => {
      const isPinned = paper.status === 'published'
      const info = new Map<string, BuilderQuestionInfo>()
      const marks = new Map<string, number>()
      for (const s of paper.sections)
        for (const pl of s.placements) {
          const id = idToString(pl.questionId)
          const found = described.get(`${id}@${isPinned ? String(pl.pinnedVersionNo) : 'now'}`)
          if (found && !info.has(id)) info.set(id, found)
          if (!marks.has(id)) marks.set(id, pl.marksOverride ?? found?.marks ?? 0)
        }
      const placed = [...marks.keys()]
      const check = checkPaper({
        specs: paper.sections.map((s) => ({
          label: s.label,
          markBudget: s.markBudget,
          questionCount: s.questionCount,
          rule: ruleOf(s.ruleType, s.ruleN),
        })),
        sections: paper.sections.map((s) => ({ questionIds: s.placements.map((pl) => idToString(pl.questionId)) })),
        marksOf: (id) => marks.get(id) ?? 0,
        groupOf: (id) => info.get(id)?.groupId ?? undefined,
        membersOf: (g) => groups.get(g)?.questionIds ?? placed.filter((id) => info.get(id)?.groupId === g),
        isLive: (id) => info.get(id)?.status === 'published',
      })
      return { info, groups, check }
    })
  }

  private async evaluate(paper: PaperTree): Promise<Evaluation> {
    return (await this.evaluateMany([paper]))[0]!
  }

  // --- wire shapes -------------------------------------------------------------------------------

  private paperWire(paper: PaperTree, subject: SubjectRef | undefined): BijakBuilderPaper {
    const reference = referencePanels(paper.referenceSheets)
    return {
      id: idToString(paper.id),
      title: paper.title,
      subject: subject ? bijakCodeOf(subject.code) : '',
      kertas: paper.kertas,
      year: paper.year ?? mytYear(paper.createdAt),
      code: paper.paperCode ?? '',
      durationMin: paper.printedDurationMin,
      instructions: paper.instructions,
      ...(reference.length ? { reference } : {}),
      sections: paper.sections.map((s) => {
        const rule = ruleOf(s.ruleType, s.ruleN)
        return {
          id: idToString(s.id),
          label: s.label,
          ...(s.title ? { title: s.title } : {}),
          markBudget: s.markBudget,
          questionCount: s.questionCount,
          ...(s.compulsory ? { compulsory: true as const } : {}),
          ...(s.instruction ? { instruction: sectionInstruction(s.instruction, rule, s.questionCount) } : {}),
          rule,
          questionIds: s.placements.map((pl) => idToString(pl.questionId)),
        }
      }),
      status: statusOf(paper.status),
      createdAt: toMytTimestamp(paper.createdAt),
      updatedAt: toMytTimestamp(paper.updatedAt),
      ...(paper.publishedAt ? { publishedAt: toMytTimestamp(paper.publishedAt) } : {}),
    }
  }

  private questionWire(info: BuilderQuestionInfo): BijakBuilderQuestion {
    return {
      id: info.id,
      ...(info.groupId ? { groupId: info.groupId } : {}),
      ...(info.stimulusLabel ? { stimulusLabel: info.stimulusLabel } : {}),
      preview: info.preview,
      marks: info.marks,
      kind: info.kind,
      topic: info.topic,
      status: info.status,
      kertas: info.kertas,
      subject: info.subject,
    }
  }

  private async editorOf(paper: PaperTree): Promise<BijakBuilderEditor> {
    const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
    const wire = this.paperWire(paper, subject)
    const used = this.refsOf(paper)
    const usedInfo = used.length ? await this.questions.describe(used) : new Map<string, BuilderQuestionInfo>()
    // The picker shows at most 1000 candidates, so a large bank cannot make one editor read unbounded.
    const candidateIds = (await this.questions.candidates({ subject: wire.subject, kertas: paper.kertas }))
      .filter((id) => !usedInfo.has(id))
      .slice(0, 1000)
    const candInfo = candidateIds.length ? await this.questions.describe(candidateIds.map((id) => ({ id }))) : new Map<string, BuilderQuestionInfo>()
    const ordered: BuilderQuestionInfo[] = []
    const seen = new Set<string>()
    for (const id of [...used.map((r) => r.id), ...candidateIds]) {
      const info = usedInfo.get(id) ?? candInfo.get(id)
      if (info && !seen.has(id)) {
        seen.add(id)
        ordered.push(info)
      }
    }
    const groupIds = [...new Set(ordered.flatMap((q) => (q.groupId ? [q.groupId] : [])))]
    const groupMap = groupIds.length ? await this.questions.groups(groupIds) : new Map<string, BuilderGroupInfo>()
    const bp = subject ? await this.repo.activeBlueprint(subject.id, paper.kertas) : null
    const blueprint: BijakBlueprintView | null = bp && subject ? blueprintView(bp, subject) : null
    return {
      paper: wire,
      blueprint,
      questions: ordered.map((q) => this.questionWire(q)),
      groups: groupIds.flatMap((id) => {
        const g = groupMap.get(id)
        return g ? [{ id: g.id, stimulus: g.stimulus, questionIds: g.questionIds }] : []
      }),
    }
  }

  // --- audit -------------------------------------------------------------------------------------

  private record(actor: AuditActor, action: string, paperId: bigint, details: Record<string, unknown>) {
    return this.audit.record({
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      targetType: 'bijak_paper',
      targetId: idToString(paperId),
      requestId: actor.requestId,
      ip: actor.ip,
      isTest: actor.isTest,
      details,
    })
  }

  /** Locks, re-reads and returns a curated paper inside the open transaction, or 404. */
  private async lockedPaper(id: bigint | null): Promise<PaperTree> {
    if (id === null) throw notFound()
    await this.repo.lockPaper(id)
    const paper = await this.repo.findPilihan(id)
    if (!paper) throw notFound()
    return paper
  }

  // --- operations --------------------------------------------------------------------------------

  async list(rawQuery: unknown): Promise<{ data: BijakBuilderPaperSummary[]; meta: ListMeta }> {
    const query = parseWith(BijakBuilderPaperListQuerySchema, rawQuery)
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? BIJAK_BUILDER_PAGE_SIZE
    const statuses = query.status === undefined ? undefined : query.status === 'terbit' ? ['published'] : ['draft', 'ready', 'withdrawn']
    const [total, rows] = await Promise.all([
      this.repo.countPilihan(statuses),
      this.repo.listPilihan(statuses, (page - 1) * pageSize, pageSize),
    ])
    const subjects = await this.repo.subjectsByIds(rows.map((r) => r.subjectId))
    const evaluations = await this.evaluateMany(rows)
    const data = await Promise.all(
      rows.map(async (paper, i): Promise<BijakBuilderPaperSummary> => {
        const { check } = evaluations[i]!
        const subject = subjects.get(paper.subjectId.toString())
        const code = subject ? bijakCodeOf(subject.code) : ''
        return {
          id: idToString(paper.id),
          title: paper.title,
          subject: code,
          subjectName: subject?.name ?? code,
          kertas: paper.kertas,
          code: paper.paperCode ?? '',
          status: statusOf(paper.status),
          questionCount: paper.sections.reduce((n, s) => n + s.placements.length, 0),
          marks: check.totalMarks,
          budget: check.totalBudget,
          ok: check.ok,
          updatedAt: toMytTimestamp(paper.updatedAt),
        }
      }),
    )
    return { data, meta: listMeta(page, pageSize, total) }
  }

  async create(actor: AuditActor, rawBody: unknown): Promise<{ id: string }> {
    const body = parseWith(BijakBuilderPaperCreateSchema, rawBody)
    // kertas is a smallint column: a larger number can have no blueprint (and must not reach the query).
    if (body.kertas > MAX_KERTAS) throw invalid(MESSAGES.noBlueprint)
    const subject = await this.repo.subjectByCode(curriculumCodeOf(body.subject))
    if (!subject) throw invalid(MESSAGES.noBlueprint)
    const now = this.clock.now()
    const trimmed = body.title?.trim()
    const id = await this.prisma.transaction(async () => {
      // Lock the active blueprint row, then re-read it: a concurrent retire / new version / Draf edit is seen.
      const first = await this.repo.activeBlueprint(subject.id, body.kertas)
      if (!first) throw invalid(MESSAGES.noBlueprint)
      await this.repo.lockBlueprint(first.id)
      const blueprint = await this.repo.activeBlueprint(subject.id, body.kertas)
      if (!blueprint || blueprint.source === 'draft') throw invalid(MESSAGES.noBlueprint)
      const paperId = await this.repo.createPaper({
        title: trimmed ? trimmed : DEFAULT_TITLE(subject.name, body.kertas),
        subjectId: subject.id,
        kertas: body.kertas,
        year: mytYear(now),
        paperCode: blueprint.code,
        printedDurationMin: blueprint.durationMin,
        instructions: blueprint.instructions,
        referenceSheets: referencePanels(blueprint.referenceSheets),
        blueprintId: blueprint.id,
        createdById: BigInt(actor.userId),
        isTest: actor.isTest,
        sections: blueprint.sections.map((s) => ({
          label: s.label,
          instruction: s.instruction,
          ruleType: s.ruleType === 'choose' ? 'choose' : 'all',
          ruleN: s.ruleType === 'choose' ? s.ruleN : null,
          questionCount: s.questionCount,
          markBudget: s.markBudget ?? s.questionCount,
          compulsory: s.compulsory,
        })),
      })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_CREATED, paperId, { from: null, to: 'draf', sections: blueprint.sections.length })
      return paperId
    })
    return { id: idToString(id) }
  }

  async get(rawId: string): Promise<BijakBuilderEditor> {
    const id = parseId(rawId)
    const paper = id === null ? null : await this.repo.findPilihan(id)
    if (!paper) throw notFound()
    return this.editorOf(paper)
  }

  async update(actor: AuditActor, rawId: string, rawBody: unknown): Promise<BijakBuilderEditor> {
    const id = parseId(rawId)
    const paperId = await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      if (paper.status === 'published') throw invalid(MESSAGES.paperLocked)
      const body = parseWith(BijakBuilderPaperPatchSchema, rawBody)
      const subject = (await this.repo.subjectsByIds([paper.subjectId])).get(paper.subjectId.toString())
      const bijakSubject = subject ? bijakCodeOf(subject.code) : ''

      // Resolve every section patch before anything is written (a refusal leaves the paper untouched).
      const sections = body.sections ?? []
      const wanted = new Set<string>()
      for (const patch of sections) for (const qid of patch.questionIds) if (parseId(qid) !== null) wanted.add(qid)
      const info = wanted.size ? await this.questions.describe([...wanted].map((qid) => ({ id: qid }))) : new Map<string, BuilderQuestionInfo>()
      const plans: { sectionId: bigint; placements: { questionId: bigint; pinnedVersionNo: number }[] }[] = []
      for (const patch of sections) {
        const sectionId = parseId(patch.id)
        const section = sectionId === null ? undefined : paper.sections.find((s) => s.id === sectionId)
        if (!section) throw invalid(MESSAGES.invalidSection)
        const placements: { questionId: bigint; pinnedVersionNo: number }[] = []
        for (const qid of patch.questionIds) {
          const questionId = parseId(qid)
          const q = questionId === null ? undefined : info.get(qid)
          if (questionId === null || !q || q.subject !== bijakSubject) throw invalid(MESSAGES.invalidQuestion)
          placements.push({ questionId, pinnedVersionNo: q.versionNo })
        }
        const dups = patch.questionIds.filter((qid, i) => patch.questionIds.indexOf(qid) !== i)
        if (dups.length) throw invalid(LINES.duplicateQuestion([...new Set(dups)]))
        plans.push({ sectionId: section.id, placements })
      }

      await this.repo.updatePaper(paper.id, {
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.year !== undefined ? { year: body.year } : {}),
        ...(body.durationMin !== undefined ? { printedDurationMin: body.durationMin } : {}),
        updatedAt: this.clock.now(),
      })
      for (const plan of plans) await this.repo.replacePlacements(plan.sectionId, plan.placements)
      const status = statusOf(paper.status)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_UPDATED, paper.id, { from: status, to: status, sections: plans.length })
      return paper.id
    })
    const fresh = await this.repo.findPilihan(paperId)
    if (!fresh) throw notFound()
    return this.editorOf(fresh)
  }

  async remove(actor: AuditActor, rawId: string): Promise<{ ok: true }> {
    const id = parseId(rawId)
    if (id === null) return { ok: true }
    await this.prisma.transaction(async () => {
      await this.repo.lockPaper(id)
      const paper = await this.repo.findPilihan(id)
      if (!paper) return
      if (paper.status === 'published') throw invalid(MESSAGES.deleteTerbit)
      await this.repo.deletePaper(paper.id)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_DELETED, paper.id, { from: statusOf(paper.status), to: null })
    })
    return { ok: true }
  }

  async publish(actor: AuditActor, rawId: string): Promise<BijakBuilderPublishResult> {
    const id = parseId(rawId)
    return this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      const { info, check } = await this.evaluate(paper)
      if (!check.ok) return { ok: false, errors: publishErrors(check) }
      if (paper.status === 'published') return { ok: true, errors: [] }
      for (const s of paper.sections)
        for (const pl of s.placements) {
          const q = info.get(idToString(pl.questionId))
          if (q) await this.repo.pinPlacement(pl.id, q.versionNo, q.marks)
        }
      const now = this.clock.now()
      await this.repo.updatePaper(paper.id, {
        status: 'published',
        publishedAt: now,
        updatedAt: now,
        ...(paper.status === 'withdrawn' ? { version: paper.version + 1 } : {}),
      })
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_PUBLISHED, paper.id, { from: 'draf', to: 'terbit' })
      return { ok: true, errors: [] }
    })
  }

  async withdraw(actor: AuditActor, rawId: string): Promise<{ ok: true }> {
    const id = parseId(rawId)
    await this.prisma.transaction(async () => {
      const paper = await this.lockedPaper(id)
      if (paper.status !== 'published') return
      await this.repo.updatePaper(paper.id, { status: 'withdrawn', publishedAt: null, updatedAt: this.clock.now() })
      await this.repo.clearOverrides(paper.id)
      await this.record(actor, AUDIT_ACTIONS.BIJAK_PAPER_WITHDRAWN, paper.id, { from: 'terbit', to: 'draf' })
    })
    return { ok: true }
  }

  async preview(rawBody: unknown): Promise<BijakBuilderPreview> {
    const body = parseWith(BijakBuilderPreviewRequestSchema, rawBody)
    return this.questions.review(body.ids)
  }
}
