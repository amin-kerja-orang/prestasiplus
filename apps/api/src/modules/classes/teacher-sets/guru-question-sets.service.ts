import { Inject, Injectable } from '@nestjs/common'
import {
  GURU_SET_BANK_PAGE_SIZE,
  GURU_SET_BANK_PREVIEW_MAX,
  GURU_SET_MESSAGES,
  GURU_SET_RESULTS_PAGE_SIZE,
  GuruSetBankQuerySchema,
  GuruSetCopyRequestSchema,
  GuruSetListQuerySchema,
  GuruSetResultsQuerySchema,
  GuruSetStatusRequestSchema,
  GuruSetUpsertRequestSchema,
  type GuruSetUpsertRequest,
  type ListMeta,
  type QuestionSet,
  type QuestionSetRow,
} from '@pp/contract'
import type { z } from 'zod'

import { AuditService } from '../../../common/audit'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http'
import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import { QuestionsRepository, servabilityFilterOf, type QuestionFilter, type QuestionRecord, type StimulusRecord } from '../../questions'
import { FilesService } from '../../files/files.service'
import { stimulusTableParts } from '../../questions/stimulus-table'
import type { ClassActor } from '../actor'
import { ClassesRepository } from '../classes.repository'
import { QuestionSetsService } from '../question-sets/question-sets.service'
import { invalid, tryParseStrict } from '../strict-body'
import { GuruQuestionSetsRepository, type GuruSetRecord, type SetItemInput } from './guru-question-sets.repository'

type Obj = z.ZodObject<z.ZodRawShape>

/** `audit_events.action` names of the teacher set routes (ids only, never titles or question text). */
export const GURU_SET_AUDIT = {
  CREATED: 'classes.question_set.created',
  UPDATED: 'classes.question_set.updated',
  STATUS: 'classes.question_set.status_changed',
  COPIED: 'classes.question_set.copied',
  DELETED: 'classes.question_set.deleted',
} as const

/**
 * `question_sets.max_attempts` written by a teacher set: 0 = unlimited. R1 sets have no attempt cap (API-GUR-15) and the results
 * page is "one row per attempt"; `PracticeService.guardSubmit` enforces a cap only when `maxAttempts > 0`, so 0 is safe.
 * (DOC DEFECT 4 of issue #489: flip this one constant to 1 if the product decides on a single attempt.)
 */
export const GURU_SET_MAX_ATTEMPTS = 0

/** Education level grades of Tingkatan 1 to 5 (`education_levels.grade` 7 to 11). */
const TINGKATAN_GRADES = [7, 8, 9, 10, 11] as const

const notFound = (): ApiError => ApiError.of('NOT_FOUND')

/** The picker preview: the text cut at 120 characters with "..." appended only when something was cut. */
export function previewOf(text: string, max: number = GURU_SET_BANK_PREVIEW_MAX): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  return clean.length > max ? `${clean.slice(0, max)}...` : clean
}

/** Whole number rounded half up (80 stays 80, 66.5 gives 67). */
export const roundHalfUp = (n: number): number => Math.floor(n + 0.5)

/** One decimal on the wire (`correct / total * 100`); 0 when the session had no question. */
export function accuracyOf(correct: number, total: number): number {
  return total <= 0 ? 0 : Math.round((correct / total) * 1000) / 10
}

/** Kesukaran 1..5 of a version: the typed level, else TP clamped to 5, else 3 (DM-47). */
export function difficultyOf(v: { difficultyLevel: number | null; difficultyTp: number | null }): 1 | 2 | 3 | 4 | 5 {
  const n = v.difficultyLevel ?? (v.difficultyTp === null ? 3 : Math.min(5, v.difficultyTp))
  return Math.max(1, Math.min(5, n)) as 1 | 2 | 3 | 4 | 5
}

const sameSequence = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((x, i) => x === b[i])

/** The validated, resolved form of a create or an edit. */
interface Resolved {
  body: GuruSetUpsertRequest
  classIds: string[]
}

@Injectable()
export class GuruQuestionSetsService {
  constructor(
    @Inject(GuruQuestionSetsRepository) private readonly repo: GuruQuestionSetsRepository,
    @Inject(QuestionSetsService) private readonly eligible: QuestionSetsService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  // --- reads ------------------------------------------------------------------------------------

  /** `GET /guru/question-sets`: the card rows of the page, the three counters and the summary. */
  async list(actor: ClassActor, query: Record<string, unknown>) {
    const q = GuruSetListQuerySchema.safeParse({ classroomId: str(query.classroomId), page: str(query.page), pageSize: str(query.pageSize) })
    if (!q.success) throw invalid(Object.fromEntries(q.error.issues.map((i) => [i.path.join('.') || '_', i.message])))
    const { classroomId, page, pageSize } = q.data
    const [{ rows, total }, counts, participation, listed] = await Promise.all([
      this.repo.listOwn(actor.userId, { ...(classroomId === undefined ? {} : { classroomId }), page, pageSize }),
      this.repo.statusCounts(actor.userId),
      this.repo.participation(actor.userId),
      this.repo.listedIds(actor.userId, classroomId),
    ])
    const ids = rows.map((r) => r.id)
    const [items, siap, classrooms, subjects, summarySiap] = await Promise.all([
      this.eligible.eligibleItems(rows),
      this.repo.siapOf(ids),
      this.repo.classroomsOf(ids),
      this.repo.subjectNames(rows.map((r) => r.subjectId)),
      this.repo.distinctSiap(listed),
    ])
    const out: QuestionSetRow[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status === 'published' ? 'published' : 'draft',
      subjectId: r.subjectId as string,
      subjectName: subjects.get(r.subjectId as string) ?? '',
      educationLevelId: r.educationLevelId,
      questionCount: items.get(r.id)?.length ?? 0,
      siap: siap.get(r.id) ?? 0,
      classrooms: classrooms.get(r.id) ?? [],
      updatedAt: toMytTimestamp(r.updatedAt),
    }))
    const meta: ListMeta = listMeta(page, pageSize, total)
    return {
      data: { rows: out, counters: { published: counts.published, draft: counts.draft, participation }, summary: { total: listed.length, siap: summarySiap } },
      meta,
    }
  }

  /** `GET /guru/question-sets/:id`: the "Urus" form (the stored question ids, the class ids, the lock). */
  async get(actor: ClassActor, id: string): Promise<QuestionSet> {
    return this.view(await this.ownSet(actor, id))
  }

  private async ownSet(actor: ClassActor, id: string): Promise<GuruSetRecord> {
    const set = isIdString(id) ? await this.repo.getOwn(actor.userId, id) : null
    if (!set) throw notFound()
    return set
  }

  private async view(set: GuruSetRecord): Promise<QuestionSet> {
    const [items, classIds, locked] = await Promise.all([this.repo.storedItems(set.id), this.repo.classroomIdsOf([set.id]), this.repo.hasSessions(set.id)])
    return {
      id: set.id,
      title: set.title,
      status: set.status === 'published' ? 'published' : 'draft',
      subjectId: set.subjectId as string,
      educationLevelId: set.educationLevelId,
      questionIds: items.map((i) => i.questionId),
      classroomIds: classIds.get(set.id) ?? [],
      locked,
      createdAt: toMytTimestamp(set.createdAt),
      updatedAt: toMytTimestamp(set.updatedAt),
    }
  }

  // --- validation -------------------------------------------------------------------------------

  /** The ONE served predicate of the picker, the validation and the pupil draw: approved live, active, whole groups, the practice shape. */
  private bankFilter(extra: QuestionFilter = {}): QuestionFilter {
    return { ...servabilityFilterOf('bab', {}, ['bab']), ...extra }
  }

  /**
   * Validates the form and reports every failing field together. `questionIds` are checked only when `checkQuestions`
   * (a create, or an edit that changes the list): approved and servable, no duplicate, whole stimulus groups.
   */
  private async resolve(actor: ClassActor, raw: unknown, checkQuestions: (ids: readonly string[]) => boolean): Promise<Resolved> {
    const parsed = tryParseStrict(GuruSetUpsertRequestSchema as unknown as Obj, raw) as { data?: GuruSetUpsertRequest; fields?: Record<string, string> }
    const fields: Record<string, string> = { ...parsed.fields }
    const body = parsed.data
    let classIds: string[] = []
    if (body) {
      if (!isIdString(body.subjectId) || !(await this.classes.activeSubjectExists(body.subjectId))) fields.subjectId = GURU_SET_MESSAGES.subjectRequired
      if (body.educationLevelId !== undefined && body.educationLevelId !== null && body.educationLevelId !== '') {
        const level = isIdString(body.educationLevelId) ? await this.curriculum.level(idFromString(body.educationLevelId)) : null
        if (!level || level.grade === null || !(TINGKATAN_GRADES as readonly number[]).includes(level.grade)) fields.educationLevelId = GURU_SET_MESSAGES.invalid
      }
      classIds = [...new Set(body.classroomIds)]
      if (classIds.length > 0 && !(await this.ownActiveClasses(actor, classIds))) fields.classroomIds = GURU_SET_MESSAGES.invalid
      if (body.status === 'published' && classIds.length === 0 && fields.classroomIds === undefined) fields.classroomIds = GURU_SET_MESSAGES.classRequiredToPublish
      if (!fields.questionIds && checkQuestions(body.questionIds)) {
        const message = await this.questionProblem(body.questionIds)
        if (message) fields.questionIds = message
      }
    }
    if (Object.keys(fields).length > 0 || !body) throw invalid(fields)
    return { body, classIds }
  }

  /** True when every id is an own, active class of kind `classroom`. */
  private async ownActiveClasses(actor: ClassActor, ids: readonly string[]): Promise<boolean> {
    if (!ids.every((i) => isIdString(i) && i !== '0')) return false
    const rows = await this.classes.byIds(ids)
    return rows.length === ids.length && rows.every((c) => c.kind === 'classroom' && c.teacherId === actor.userId && c.isActive)
  }

  /** The BM message for a question list that cannot be saved, or null when it is fine. */
  private async questionProblem(ids: readonly string[]): Promise<string | null> {
    if (new Set(ids).size !== ids.length || !ids.every((i) => isIdString(i) && i !== '0')) return GURU_SET_MESSAGES.invalid
    const filter = this.bankFilter()
    const passing = new Set(await this.questions.eligibleAmong(ids, filter))
    if (ids.some((i) => !passing.has(i))) return GURU_SET_MESSAGES.invalid
    // Whole stimulus groups only (FR-GUR-8b-8): every servable member of a group that is touched must be chosen.
    const records = await this.questions.getMany(ids, 'live')
    const groupIds = [...new Set(records.flatMap((r) => (r.groupId === null ? [] : [r.groupId])))]
    if (groupIds.length === 0) return null
    const chosen = new Set(ids)
    const groups = await this.questions.groupsByIds(groupIds)
    for (const g of groups) {
      const missing = g.questionIds.filter((m) => !chosen.has(m))
      if (missing.length === 0) continue
      if ((await this.questions.eligibleAmong(missing, filter)).length > 0) return GURU_SET_MESSAGES.groupSplit
    }
    return null
  }

  /** The stored (question, live version) pairs of a validated list, in the chosen order. */
  private async itemsOf(ids: readonly string[]): Promise<SetItemInput[]> {
    const records = await this.questions.getMany(ids, 'live')
    const byId = new Map(records.map((r) => [r.id, r]))
    return ids.map((id) => ({ questionId: id, versionNo: (byId.get(id) as QuestionRecord).version.versionNo }))
  }

  // --- writes -----------------------------------------------------------------------------------

  /** `POST /guru/question-sets` (201): the set with its items and classes, draft or published. */
  async create(actor: ClassActor, raw: unknown): Promise<QuestionSet> {
    const { body, classIds } = await this.resolve(actor, raw, () => true)
    const items = await this.itemsOf(body.questionIds)
    const now = this.clock.now()
    const set = await this.prisma.transaction(async (tx) => {
      const row = await this.repo.create({
        teacherId: actor.userId,
        title: body.title,
        subjectId: body.subjectId,
        educationLevelId: body.educationLevelId ? body.educationLevelId : null,
        status: body.status,
        maxAttempts: GURU_SET_MAX_ATTEMPTS,
        isTest: actor.isTest,
        now,
      })
      await this.repo.replaceItems(row.id, items)
      await this.repo.replaceClassrooms(row.id, classIds, actor.userId, now)
      await this.record(actor, tx, GURU_SET_AUDIT.CREATED, row, { status: row.status, questions: items.length, classes: classIds.length })
      return row
    })
    return this.view(set)
  }

  /**
   * `PUT /guru/question-sets/:id`. Title, subject, Tingkatan, status and classes always save. The question list is locked once any
   * pupil has a session of the set: a changed list then answers 409 AFTER the rest is saved (title and classes still save).
   */
  async update(actor: ClassActor, id: string, raw: unknown): Promise<QuestionSet> {
    const set = await this.ownSet(actor, id)
    const stored = (await this.repo.storedItems(set.id)).map((i) => i.questionId)
    const locked = await this.repo.hasSessions(set.id)
    const { body, classIds } = await this.resolve(actor, raw, (ids) => !sameSequence(ids, stored) && !locked)
    const changed = !sameSequence(body.questionIds, stored)
    const items = changed && !locked ? await this.itemsOf(body.questionIds) : null
    const now = this.clock.now()
    // Behaviour agreed for AC-GUR-8b-12: title, subject, Tingkatan, status and classes ALWAYS save; when the question list changed
    // and the set is locked, the list is left as it was and the answer is 409 AFTER the commit. The lock is re-read inside the
    // transaction with the set row locked (FOR UPDATE), so a pupil who starts between the check above and the write cannot slip a change in.
    const { row: updated, conflict } = await this.prisma.transaction(async (tx) => {
      await this.repo.lockRow(set.id)
      const lockedNow = await this.repo.hasSessions(set.id)
      const row = await this.repo.update(set.id, {
        title: body.title,
        subjectId: body.subjectId,
        educationLevelId: body.educationLevelId ? body.educationLevelId : null,
        status: body.status,
        now,
      })
      const replace = changed && !lockedNow
      if (replace) {
        const list = items ?? (await this.itemsOf(body.questionIds))
        await this.repo.replaceItems(row.id, list)
      }
      await this.repo.replaceClassrooms(row.id, classIds, actor.userId, now)
      await this.record(actor, tx, GURU_SET_AUDIT.UPDATED, row, { status: row.status, questionsChanged: replace, classes: classIds.length })
      return { row, conflict: changed && lockedNow }
    })
    if (conflict) {
      throw ApiError.of('CONFLICT', { message: GURU_SET_MESSAGES.locked, fields: { questionIds: GURU_SET_MESSAGES.locked } })
    }
    return this.view(updated)
  }

  /** `POST /guru/question-sets/:id/status`: Terbitkan (needs at least one class) or Jadikan Draf (attempts are kept). */
  async setStatus(actor: ClassActor, id: string, raw: unknown): Promise<QuestionSet> {
    const set = await this.ownSet(actor, id)
    const parsed = tryParseStrict(GuruSetStatusRequestSchema as unknown as Obj, raw) as { data?: { status: 'draft' | 'published' }; fields?: Record<string, string> }
    if (parsed.fields || !parsed.data) throw invalid(parsed.fields ?? { status: GURU_SET_MESSAGES.statusInvalid })
    const status = parsed.data.status
    if (status === 'published') {
      const classIds = (await this.repo.classroomIdsOf([set.id])).get(set.id) ?? []
      if (classIds.length === 0) throw invalid({ classroomIds: GURU_SET_MESSAGES.classRequiredToPublish })
    }
    const now = this.clock.now()
    const row = await this.prisma.transaction(async (tx) => {
      const r = await this.repo.setStatus(set.id, status, now)
      await this.record(actor, tx, GURU_SET_AUDIT.STATUS, r, { from: set.status, to: status })
      return r
    })
    return this.view(row)
  }

  /** `POST /guru/question-sets/:id/copy` (201): a draft "{title} (Salinan)" with every stored item, assigned to the chosen own classes only. */
  async copy(actor: ClassActor, id: string, raw: unknown): Promise<QuestionSet> {
    const set = await this.ownSet(actor, id)
    const parsed = tryParseStrict(GuruSetCopyRequestSchema as unknown as Obj, raw) as { data?: { classroomIds: string[] }; fields?: Record<string, string> }
    if (parsed.fields || !parsed.data) throw invalid({ classroomIds: GURU_SET_MESSAGES.classRequiredToCopy })
    const classIds = [...new Set(parsed.data.classroomIds)]
    if (classIds.length === 0 || !(await this.ownActiveClasses(actor, classIds))) throw invalid({ classroomIds: GURU_SET_MESSAGES.classRequiredToCopy })
    const items = await this.repo.storedItems(set.id)
    const now = this.clock.now()
    const copy = await this.prisma.transaction(async (tx) => {
      const row = await this.repo.create({
        teacherId: actor.userId,
        title: `${set.title}${GURU_SET_MESSAGES.copySuffix}`,
        subjectId: set.subjectId as string,
        educationLevelId: set.educationLevelId,
        status: 'draft',
        maxAttempts: GURU_SET_MAX_ATTEMPTS,
        isTest: actor.isTest,
        now,
      })
      await this.repo.replaceItems(row.id, items)
      await this.repo.replaceClassrooms(row.id, classIds, actor.userId, now)
      await this.record(actor, tx, GURU_SET_AUDIT.COPIED, row, { from: set.id, questions: items.length, classes: classIds.length })
      return row
    })
    return this.view(copy)
  }

  /** `DELETE /guru/question-sets/:id`: the set, its items and its class rows go; the pupils' sessions stay for Prestasi. */
  async remove(actor: ClassActor, id: string): Promise<{ deleted: 1 }> {
    const set = await this.ownSet(actor, id)
    await this.prisma.transaction(async (tx) => {
      await this.repo.remove(set.id)
      await this.record(actor, tx, GURU_SET_AUDIT.DELETED, set, { status: set.status })
    })
    return { deleted: 1 }
  }

  private async record(actor: ClassActor, tx: Parameters<AuditService['record']>[0]['tx'], action: string, set: GuruSetRecord, details: Record<string, unknown>): Promise<void> {
    await this.audit.record({
      tx,
      action,
      actorUserId: actor.userId,
      actorRole: actor.role,
      sessionRowId: actor.auth.sessionRowId,
      targetType: 'question_set',
      targetId: set.id,
      schoolId: actor.schoolId,
      scopeLevel: actor.auth.active.scope.level,
      requestId: actor.requestId,
      ip: actor.ip,
      details,
    })
  }

  // --- results ----------------------------------------------------------------------------------

  /** `GET /guru/question-sets/:id/results?classroomId=&page=`: completed sessions of the set, newest first, 25 per page. */
  async results(actor: ClassActor, id: string, query: Record<string, unknown>) {
    const set = await this.ownSet(actor, id)
    const q = GuruSetResultsQuerySchema.safeParse({ classroomId: str(query.classroomId), page: str(query.page) })
    if (!q.success) throw invalid(Object.fromEntries(q.error.issues.map((i) => [i.path.join('.') || '_', i.message])))
    // A class filter that is not an own class shows nothing (it never leaks another teacher's pupils).
    let classroomId: string | null = null
    let empty = false
    if (q.data.classroomId !== undefined && q.data.classroomId !== '') {
      classroomId = q.data.classroomId
      empty = !(await this.ownActiveOrInactive(actor, classroomId))
    }
    const page = q.data.page
    const [summary, rows] = empty
      ? [{ penyertaan: 0, jumlahPercubaan: 0, skorPurata: null as number | null }, []]
      : await Promise.all([this.repo.resultSummary(set.id, classroomId), this.repo.resultRows(set.id, classroomId, page, GURU_SET_RESULTS_PAGE_SIZE)])
    return {
      data: {
        summary: { penyertaan: summary.penyertaan, skorPurata: summary.skorPurata === null ? null : roundHalfUp(summary.skorPurata), jumlahPercubaan: summary.jumlahPercubaan },
        rows: rows.map((r) => ({
          pupil: { id: r.pupilId, name: r.pupilName },
          correct: r.correct,
          total: r.total,
          accuracy: accuracyOf(r.correct, r.total),
          attemptedAt: toMytTimestamp(r.completedAt),
        })),
      },
      meta: listMeta(page, GURU_SET_RESULTS_PAGE_SIZE, summary.jumlahPercubaan),
    }
  }

  private async ownActiveOrInactive(actor: ClassActor, classroomId: string): Promise<boolean> {
    if (!isIdString(classroomId)) return false
    const c = await this.classes.get(classroomId)
    return c !== null && c.kind === 'classroom' && c.teacherId === actor.userId
  }

  // --- bank picker ------------------------------------------------------------------------------

  /** `GET /guru/question-sets/bank`: units (a question or a whole group as ONE), 50 per call by keyset cursor. */
  async bank(query: Record<string, unknown>) {
    const parsed = GuruSetBankQuerySchema.safeParse({ subjectId: str(query.subjectId), levelId: str(query.levelId), q: str(query.q), cursor: str(query.cursor) })
    if (!parsed.success) throw invalid(Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.') || '_', i.message])))
    const { subjectId, levelId, q, cursor } = parsed.data
    const extra: QuestionFilter = { ...(subjectId ? { subjectId } : {}), ...(levelId ? { educationLevelId: levelId } : {}) }
    const refs = await this.repo.bankUnits(this.bankFilter(extra), q, cursor, GURU_SET_BANK_PAGE_SIZE + 1)
    const page = refs.slice(0, GURU_SET_BANK_PAGE_SIZE)
    const nextCursor = refs.length > GURU_SET_BANK_PAGE_SIZE ? (page[page.length - 1]?.rep ?? null) : null
    if (page.length === 0) return { data: { units: [], nextCursor: null } }

    const groups = new Map((await this.questions.groupsByIds(page.flatMap((u) => (u.groupId === null ? [] : [u.groupId])))).map((g) => [g.id, g]))
    // The members of a group that are served (a group is complete, so every non-archived member passes); in the group's order.
    const memberIds = [...new Set([...groups.values()].flatMap((g) => g.questionIds))]
    const served = new Set(memberIds.length === 0 ? [] : await this.questions.eligibleAmong(memberIds, this.bankFilter()))
    const unitMembers = (u: { groupId: string | null; rep: string }): string[] =>
      u.groupId === null ? [u.rep] : (groups.get(u.groupId)?.questionIds ?? []).filter((m) => served.has(m))
    const headIds = page.map((u) => unitMembers(u)[0] ?? u.rep)
    const records = new Map((await this.questions.getMany(headIds, 'live')).map((r) => [r.id, r]))

    const [subjects, levels, tokens] = await Promise.all([
      this.classes.subjectNames([...records.values()].map((r) => r.version.subjectId)),
      this.levelNames([...records.values()].map((r) => r.version.educationLevelId)),
      this.imageTokens(page, groups, records),
    ])
    const units = page.flatMap((u, i) => {
      const head = records.get(headIds[i] as string)
      if (!head) return []
      const group = u.groupId === null ? null : (groups.get(u.groupId) ?? null)
      const stem = head.version.stemMs ?? head.version.stemEn ?? ''
      const first = group?.stimuli[0]
      const stimulus = first ? this.stimulusOf(first, tokens) : head.version.stemImageId ? this.stemImage(head, tokens) : null
      return [
        {
          kind: (u.groupId === null ? 'question' : 'group') as 'question' | 'group',
          id: u.groupId ?? u.rep,
          questionIds: unitMembers(u).length > 0 ? unitMembers(u) : [u.rep],
          preview: previewOf(stem),
          subject: (head.version.subjectId === null ? undefined : subjects.get(head.version.subjectId)) ?? '',
          level: (head.version.educationLevelId === null ? undefined : levels.get(head.version.educationLevelId)) ?? '',
          difficulty: difficultyOf(head.version),
          stimulus,
        },
      ]
    })
    return { data: { units, nextCursor } }
  }

  private async levelNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    for (const id of new Set(ids.filter((i): i is string => i !== null))) {
      const level = await this.curriculum.level(idFromString(id))
      if (level) out.set(id, level.name)
    }
    return out
  }

  /** Public file tokens of every image the page shows (group stimuli and stem images). */
  private async imageTokens(
    page: readonly { groupId: string | null }[],
    groups: Map<string, { stimuli: StimulusRecord[] }>,
    records: Map<string, QuestionRecord>,
  ): Promise<Map<string, string>> {
    const fileIds = new Set<string>()
    for (const u of page) {
      const first = u.groupId === null ? undefined : groups.get(u.groupId)?.stimuli[0]
      if (first?.assetFileId) fileIds.add(first.assetFileId)
    }
    for (const r of records.values()) if (r.version.stemImageId) fileIds.add(r.version.stemImageId)
    return fileIds.size === 0 ? new Map() : this.files.publicIdsOf([...fileIds])
  }

  private stimulusOf(s: StimulusRecord, tokens: Map<string, string>) {
    const table = stimulusTableParts(s.kind, s.tableData, s.bodyMs)
    return {
      id: s.id,
      kind: s.kind,
      label: s.label,
      caption: s.caption ?? null,
      body: table.bodyIsTable || (s.bodyMs === null && s.bodyEn === null) ? null : { ms: s.bodyMs ?? s.bodyEn ?? '', ...(s.bodyMs !== null && s.bodyEn !== null ? { en: s.bodyEn } : {}) },
      alt: s.alt,
      sourceCitation: s.sourceCitation ?? null,
      tableData: table.table ?? null,
      imageId: s.assetFileId === null ? null : (tokens.get(s.assetFileId) ?? null),
    }
  }

  /** The picture of a single question (its stem image) as a figure the picker can show inline. */
  private stemImage(r: QuestionRecord, tokens: Map<string, string>) {
    return {
      id: r.id,
      kind: 'image' as const,
      label: '',
      caption: null,
      body: null,
      alt: null,
      sourceCitation: null,
      tableData: null,
      imageId: r.version.stemImageId ? (tokens.get(r.version.stemImageId) ?? null) : null,
    }
  }
}

/** A query value that is a plain string (Express gives an array for a repeated key). */
const str = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)

