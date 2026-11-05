import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { QuestionsRepository } from '../../questions'
import type { QuestionFilter } from '../../questions'
import { VISIBLE_USER_SQL } from '../../command-center/shared/visibility'
import type { QuestionSetRecord } from '../question-sets/question-sets.repository'

/** A teacher set as the S6-T14 routes need it: the S1 record plus the columns of DM-46 and the timestamps. */
export interface GuruSetRecord extends QuestionSetRecord {
  educationLevelId: string | null
  kind: 'set' | 'kertas'
  updatedAt: Date
}

export interface NewGuruSet {
  teacherId: string
  title: string
  subjectId: string
  educationLevelId: string | null
  status: 'draft' | 'published'
  maxAttempts: number
  isTest: boolean
  now: Date
}

export interface GuruSetPatch {
  title: string
  subjectId: string
  educationLevelId: string | null
  status: 'draft' | 'published'
  now: Date
}

export interface SetItemInput {
  questionId: string
  versionNo: number
}

export interface ResultRow {
  pupilId: string
  pupilName: string
  correct: number
  total: number
  completedAt: Date
}

export interface ResultSummary {
  penyertaan: number
  jumlahPercubaan: number
  /** Mean of the per-attempt percentages (exact, not yet rounded); null without a counted attempt. */
  skorPurata: number | null
}

/** One unit of the bank picker before it is shaped for the wire: a question or a whole stimulus group. */
export interface BankUnitRef {
  groupId: string | null
  /** The newest question id of the unit: its sort key and the keyset cursor. */
  rep: string
}

const idOf = (id: string): bigint | null => (isIdString(id) ? idFromString(id) : null)
const idsOf = (ids: readonly string[]): bigint[] => [...new Set(ids)].flatMap((i) => (isIdString(i) ? [idFromString(i)] : []))

const likePattern = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

const toRecord = (row: {
  id: bigint
  teacherId: bigint
  classroomId: bigint | null
  subjectId: bigint | null
  educationLevelId: bigint | null
  title: string
  timeLimitMinutes: number | null
  maxAttempts: number
  status: string
  scheduledAt: Date | null
  needsRebuild: boolean
  isTest: boolean
  kind: string
  createdAt: Date
  updatedAt: Date
}): GuruSetRecord => ({
  id: idToString(row.id),
  teacherId: idToString(row.teacherId),
  classroomId: row.classroomId === null ? null : idToString(row.classroomId),
  subjectId: row.subjectId === null ? null : idToString(row.subjectId),
  educationLevelId: row.educationLevelId === null ? null : idToString(row.educationLevelId),
  title: row.title,
  timeLimitMinutes: row.timeLimitMinutes,
  maxAttempts: row.maxAttempts,
  status: row.status as GuruSetRecord['status'],
  scheduledAt: row.scheduledAt,
  needsRebuild: row.needsRebuild,
  isTest: row.isTest,
  kind: row.kind as GuruSetRecord['kind'],
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

/**
 * The doorway of the teacher Set Soalan routes (S6-T14, API-GUR-16) to `question_sets`, `question_set_items` and
 * `question_set_classrooms` (DM-46). It also READS `practice_sessions` (sessions of a set: the edit lock, "siap", results)
 * and `enrolments` (the class filter of the results); it never writes them. Questions are read through
 * `QuestionsRepository` (the bank picker reuses its `scopeSql`, so the picker, the validation and the pupil draw share one predicate).
 * Every method uses `prisma.client`, so it joins the transaction a service opened.
 */
@Injectable()
export class GuruQuestionSetsRepository {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
  ) {}

  private get db() {
    return this.prisma.client
  }

  // --- sets -------------------------------------------------------------------------------------

  /** An own set of kind `set` (a teacher paper `kertas` is not managed here), or null. */
  async getOwn(teacherId: string, id: string): Promise<GuruSetRecord | null> {
    const key = idOf(id)
    const owner = idOf(teacherId)
    if (key === null || owner === null) return null
    // Same rules as `listOwn`: a migrated header that needs a rebuild, or one without a subject, is not a set of the teacher (404).
    const row = await this.db.questionSet.findFirst({ where: { id: key, teacherId: owner, kind: 'set', needsRebuild: false, subjectId: { not: null } } })
    return row ? toRecord(row) : null
  }

  /** Locks the set row until the surrounding transaction ends (`SELECT ... FOR UPDATE`): serialises the edit with a concurrent change. */
  async lockRow(setId: string): Promise<void> {
    await this.db.$queryRaw`SELECT id FROM question_sets WHERE id = ${idFromString(setId)} FOR UPDATE`
  }

  /**
   * The listed sets: own, kind `set`, status draft or published (`scheduled` is never produced and is ignored), a migrated header that
   * needs a rebuild left out; newest update first. With `classroomId` only the sets assigned to that class.
   */
  async listOwn(teacherId: string, opts: { classroomId?: string; page: number; pageSize: number }): Promise<{ rows: GuruSetRecord[]; total: number }> {
    const owner = idOf(teacherId)
    if (owner === null) return { rows: [], total: 0 }
    const cls = opts.classroomId === undefined ? null : idOf(opts.classroomId)
    if (opts.classroomId !== undefined && cls === null) return { rows: [], total: 0 }
    const where: Prisma.QuestionSetWhereInput = {
      teacherId: owner,
      kind: 'set',
      status: { in: ['draft', 'published'] },
      needsRebuild: false,
      subjectId: { not: null },
      ...(cls === null ? {} : { classrooms: { some: { classroomId: cls } } }),
    }
    const [rows, total] = await Promise.all([
      this.db.questionSet.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (opts.page - 1) * opts.pageSize, take: opts.pageSize }),
      this.db.questionSet.count({ where }),
    ])
    return { rows: rows.map(toRecord), total }
  }

  /** Ids of every listed set of the teacher under the same rules as `listOwn` (the filter included); for the summary. */
  async listedIds(teacherId: string, classroomId?: string): Promise<string[]> {
    const owner = idOf(teacherId)
    if (owner === null) return []
    const cls = classroomId === undefined ? null : idOf(classroomId)
    if (classroomId !== undefined && cls === null) return []
    const rows = await this.db.questionSet.findMany({
      where: {
        teacherId: owner,
        kind: 'set',
        status: { in: ['draft', 'published'] },
        needsRebuild: false,
        subjectId: { not: null },
        ...(cls === null ? {} : { classrooms: { some: { classroomId: cls } } }),
      },
      select: { id: true },
    })
    return rows.map((r) => idToString(r.id))
  }

  /** Published and draft counts of the listed sets of the teacher (whatever the class filter). */
  async statusCounts(teacherId: string): Promise<{ published: number; draft: number }> {
    const owner = idOf(teacherId)
    if (owner === null) return { published: 0, draft: 0 }
    const groups = await this.db.questionSet.groupBy({
      by: ['status'],
      where: { teacherId: owner, kind: 'set', status: { in: ['draft', 'published'] }, needsRebuild: false, subjectId: { not: null } },
      _count: { _all: true },
    })
    const n = (status: string): number => groups.find((g) => g.status === status)?._count._all ?? 0
    return { published: n('published'), draft: n('draft') }
  }

  async subjectNames(ids: readonly (string | null)[]): Promise<Map<string, string>> {
    const keys = idsOf(ids.filter((i): i is string => i !== null))
    if (keys.length === 0) return new Map()
    const rows = await this.db.subject.findMany({ where: { id: { in: keys } }, select: { id: true, name: true } })
    return new Map(rows.map((r) => [idToString(r.id), r.name]))
  }

  async create(input: NewGuruSet): Promise<GuruSetRecord> {
    const row = await this.db.questionSet.create({
      data: {
        teacherId: idFromString(input.teacherId),
        subjectId: idFromString(input.subjectId),
        educationLevelId: input.educationLevelId === null ? null : idFromString(input.educationLevelId),
        title: input.title,
        status: input.status,
        kind: 'set',
        maxAttempts: input.maxAttempts,
        isTest: input.isTest,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
    return toRecord(row)
  }

  async update(id: string, patch: GuruSetPatch): Promise<GuruSetRecord> {
    const row = await this.db.questionSet.update({
      where: { id: idFromString(id) },
      data: {
        title: patch.title,
        subjectId: idFromString(patch.subjectId),
        educationLevelId: patch.educationLevelId === null ? null : idFromString(patch.educationLevelId),
        status: patch.status,
        updatedAt: patch.now,
      },
    })
    return toRecord(row)
  }

  async setStatus(id: string, status: 'draft' | 'published', now: Date): Promise<GuruSetRecord> {
    const row = await this.db.questionSet.update({ where: { id: idFromString(id) }, data: { status, updatedAt: now } })
    return toRecord(row)
  }

  /** Items and class rows go with the set (cascade); practice sessions are untouched (no foreign key to the set). */
  async remove(id: string): Promise<void> {
    await this.db.questionSet.delete({ where: { id: idFromString(id) } })
  }

  // --- items ------------------------------------------------------------------------------------

  /** The stored question ids in position order (archived ones included: the "Urus" form shows what is stored). */
  async storedItems(setId: string): Promise<SetItemInput[]> {
    const key = idOf(setId)
    if (key === null) return []
    const rows = await this.db.questionSetItem.findMany({ where: { questionSetId: key }, orderBy: { position: 'asc' }, select: { questionId: true, questionVersionNo: true } })
    return rows.map((r) => ({ questionId: idToString(r.questionId), versionNo: r.questionVersionNo }))
  }

  /** Replaces the items (positions 0..n-1) with the given list. */
  async replaceItems(setId: string, items: readonly SetItemInput[]): Promise<void> {
    const key = idFromString(setId)
    await this.db.questionSetItem.deleteMany({ where: { questionSetId: key } })
    if (items.length === 0) return
    await this.db.questionSetItem.createMany({
      data: items.map((it, position) => ({ questionSetId: key, position, questionId: idFromString(it.questionId), questionVersionNo: it.versionNo })),
    })
  }

  // --- classes ----------------------------------------------------------------------------------

  /** The assigned class ids per set, ascending. */
  async classroomIdsOf(setIds: readonly string[]): Promise<Map<string, string[]>> {
    const keys = idsOf(setIds)
    const out = new Map<string, string[]>(setIds.map((id) => [id, []]))
    if (keys.length === 0) return out
    const rows = await this.db.questionSetClassroom.findMany({ where: { questionSetId: { in: keys } }, orderBy: [{ questionSetId: 'asc' }, { classroomId: 'asc' }] })
    for (const r of rows) out.get(idToString(r.questionSetId))?.push(idToString(r.classroomId))
    return out
  }

  /** The assigned classes (id and name, name A to Z then id) per set. */
  async classroomsOf(setIds: readonly string[]): Promise<Map<string, { id: string; name: string }[]>> {
    const keys = idsOf(setIds)
    const out = new Map<string, { id: string; name: string }[]>(setIds.map((id) => [id, []]))
    if (keys.length === 0) return out
    const rows = await this.db.$queryRaw<{ set_id: bigint; id: bigint; name: string }[]>`
      SELECT qc.question_set_id AS set_id, c.id, c.name
        FROM question_set_classrooms qc JOIN classrooms c ON c.id = qc.classroom_id
       WHERE qc.question_set_id = ANY(${keys}::bigint[])
       ORDER BY c.name ASC, c.id ASC`
    for (const r of rows) out.get(idToString(r.set_id))?.push({ id: idToString(r.id), name: r.name })
    return out
  }

  /** Replaces the class rows of a set with `classIds`, keeping the row (and `assigned_at`) of a class that stays. */
  async replaceClassrooms(setId: string, classIds: readonly string[], assignedBy: string, now: Date): Promise<void> {
    const set = idFromString(setId)
    const keep = idsOf(classIds)
    await this.db.questionSetClassroom.deleteMany({ where: { questionSetId: set, classroomId: { notIn: keep } } })
    if (keep.length === 0) return
    await this.db.questionSetClassroom.createMany({
      data: keep.map((classroomId) => ({ questionSetId: set, classroomId, assignedBy: idFromString(assignedBy), assignedAt: now })),
      skipDuplicates: true,
    })
  }

  // --- sessions (read only; practice_sessions is S5's table) -------------------------------------

  /** True when any practice session of the set exists (any status): the question list is then locked. */
  async hasSessions(setId: string): Promise<boolean> {
    const key = idOf(setId)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ ok: number }[]>`SELECT 1 AS ok FROM practice_sessions WHERE question_set_id = ${key} LIMIT 1`
    return rows.length > 0
  }

  /** Distinct pupils with a completed session, per set ("{n} siap"). */
  async siapOf(setIds: readonly string[]): Promise<Map<string, number>> {
    const keys = idsOf(setIds)
    const out = new Map<string, number>(setIds.map((id) => [id, 0]))
    if (keys.length === 0) return out
    const rows = await this.db.$queryRaw<{ set_id: bigint; n: number }[]>`
      SELECT question_set_id AS set_id, count(DISTINCT user_id)::int AS n
        FROM practice_sessions
       WHERE question_set_id = ANY(${keys}::bigint[]) AND status = 'completed' AND NOT is_test
       GROUP BY question_set_id`
    for (const r of rows) out.set(idToString(r.set_id), r.n)
    return out
  }

  /** Distinct pupils with a completed session on any of the sets (the summary "siap"). */
  async distinctSiap(setIds: readonly string[]): Promise<number> {
    const keys = idsOf(setIds)
    if (keys.length === 0) return 0
    const rows = await this.db.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT user_id)::int AS n FROM practice_sessions
       WHERE question_set_id = ANY(${keys}::bigint[]) AND status = 'completed' AND NOT is_test`
    return rows[0]?.n ?? 0
  }

  /** "Penyertaan": distinct pupils with at least one completed session on any `set` of the teacher. */
  async participation(teacherId: string): Promise<number> {
    const owner = idOf(teacherId)
    if (owner === null) return 0
    const rows = await this.db.$queryRaw<{ n: number }[]>`
      SELECT count(DISTINCT ps.user_id)::int AS n
        FROM practice_sessions ps JOIN question_sets s ON s.id = ps.question_set_id
       WHERE s.teacher_id = ${owner} AND s.kind = 'set' AND ps.status = 'completed' AND NOT ps.is_test`
    return rows[0]?.n ?? 0
  }

  private resultWhere(setId: bigint, classroomId: bigint | null): Prisma.Sql {
    const cls =
      classroomId === null
        ? Prisma.empty
        : Prisma.sql`AND EXISTS (SELECT 1 FROM enrolments e WHERE e.student_id = ps.user_id AND e.classroom_id = ${classroomId} AND e.status = 'active' AND e.is_test = false)`
    return Prisma.sql`ps.question_set_id = ${setId} AND ps.status = 'completed' AND NOT ps.is_test AND ${VISIBLE_USER_SQL} ${cls}`
  }

  /** Cards of the results page over every completed session of the set (optionally of the pupils of one class). */
  async resultSummary(setId: string, classroomId: string | null): Promise<ResultSummary> {
    const set = idOf(setId)
    if (set === null) return { penyertaan: 0, jumlahPercubaan: 0, skorPurata: null }
    const cls = classroomId === null ? null : idOf(classroomId)
    if (classroomId !== null && cls === null) return { penyertaan: 0, jumlahPercubaan: 0, skorPurata: null }
    const rows = await this.db.$queryRaw<{ pupils: number; attempts: number; mean: string | null }[]>`
      SELECT count(DISTINCT ps.user_id)::int AS pupils, count(*)::int AS attempts,
             avg(100.0 * ps.correct_count / NULLIF(ps.question_count, 0))::text AS mean
        FROM practice_sessions ps JOIN users u ON u.id = ps.user_id
       WHERE ${this.resultWhere(set, cls)}`
    const r = rows[0]
    return { penyertaan: r?.pupils ?? 0, jumlahPercubaan: r?.attempts ?? 0, skorPurata: r?.mean == null ? null : Number(r.mean) }
  }

  /** One page of completed sessions, newest first. */
  async resultRows(setId: string, classroomId: string | null, page: number, pageSize: number): Promise<ResultRow[]> {
    const set = idOf(setId)
    if (set === null) return []
    const cls = classroomId === null ? null : idOf(classroomId)
    if (classroomId !== null && cls === null) return []
    const rows = await this.db.$queryRaw<{ user_id: bigint; name: string; correct_count: number; question_count: number; completed_at: Date }[]>`
      SELECT ps.user_id, u.name, ps.correct_count, ps.question_count, ps.completed_at
        FROM practice_sessions ps JOIN users u ON u.id = ps.user_id
       WHERE ${this.resultWhere(set, cls)}
       ORDER BY ps.completed_at DESC NULLS LAST, ps.id DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`
    return rows.map((r) => ({ pupilId: idToString(r.user_id), pupilName: r.name, correct: r.correct_count, total: r.question_count, completedAt: r.completed_at }))
  }

  // --- bank picker ------------------------------------------------------------------------------

  /**
   * One page of bank units, newest first: a question outside a group is one unit, a whole stimulus group is ONE unit (its
   * newest matching member decides the position). The predicate is `QuestionsRepository.scopeSql(filter, true)`, the one the pupil
   * draw uses; `q` searches the stem. `after` is the `rep` of the last unit of the previous page.
   */
  async bankUnits(filter: QuestionFilter, q: string | undefined, after: string | undefined, limit: number): Promise<BankUnitRef[]> {
    const { from, where } = this.questions.scopeSql({ ...filter, status: 'approved', active: true }, true)
    const search = q === undefined ? Prisma.empty : Prisma.sql`AND (v.stem_ms ILIKE ${likePattern(q)} ESCAPE '\\' OR v.stem_en ILIKE ${likePattern(q)} ESCAPE '\\')`
    const cursor = after === undefined ? null : idOf(after)
    if (after !== undefined && cursor === null) return []
    const rows = await this.db.$queryRaw<{ group_id: bigint | null; rep: bigint }[]>(
      Prisma.sql`WITH m AS (SELECT q.id, q.group_id ${from} WHERE ${where} ${search}),
        u AS (SELECT group_id, max(id) AS rep FROM m GROUP BY group_id, CASE WHEN group_id IS NULL THEN id END)
        SELECT group_id, rep FROM u WHERE (${cursor}::bigint IS NULL OR rep < ${cursor}::bigint) ORDER BY rep DESC LIMIT ${limit}`,
    )
    return rows.map((r) => ({ groupId: r.group_id === null ? null : idToString(r.group_id), rep: idToString(r.rep) }))
  }
}
