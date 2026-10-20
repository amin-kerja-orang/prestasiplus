import { Inject, Injectable } from '@nestjs/common'

import type { TxClient } from '../../../db/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { Prisma } from '../../../db/generated/client'
import type { BijakAttemptAggregateInput, BijakAttemptAggregatePort } from './types'

const SOURCE = 'bijak'
const MAX_FIGURE = 99999.99
const MAX_QUESTIONS = 500
const MAX_USER_IDS = 5000
const DEFAULT_LIMIT = 100
const MAX_LIMIT = 1000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AggregateRow {
  attemptId: string
  userId: string
  paperId: string | null
  startType: 'pilihan' | 'jana' | null
  subjectCode: string
  kertas: number
  mode: 'exam' | 'latihan'
  status: 'submitted' | 'auto_submitted'
  unitsAwarded: number
  unitsMax: number
  durationSec: number | null
  provisional: boolean
  submittedAt: Date | null
  /** School snapshot at write time; null when the student had no school (or the school was removed). */
  schoolId: string | null
}

/**
 * Scope of a read. Give `userIds`, `schoolId`, or both (AND). At least one is required: a read with no
 * scope is refused (RangeError), never "every student".
 *
 * SCHOOL-SCOPED REPORTS (BE-19 student performance, BE-21 school admin): use `schoolId`. It filters on
 * `practice_attempt_aggregates.school_id`, the student's school SNAPSHOT at write time (migration 0018,
 * LEAD decision 4, 2026-10-20), served by the partial index (school_id, subject_code, submitted_at DESC)
 * WHERE NOT is_test. A student who moved school keeps old sittings under the old school. The caller must
 * have checked that the actor may see that school (this service does no authorisation).
 * `userIds[]` stays for class / per-student views (at most 5000 ids).
 */
export interface AggregateScope {
  /** Decimal-string user ids. An empty list reads nothing. */
  userIds?: string[]
  /** Decimal-string school id: only rows whose school snapshot is this school. */
  schoolId?: string
}

export interface AggregateFilter extends AggregateScope {
  subjectCode?: string
  kertas?: number
  /** Inclusive lower bound on submitted_at. */
  from?: Date
  /** Exclusive upper bound on submitted_at. */
  to?: Date
}

export interface SubjectSummaryRow {
  userId: string
  subjectCode: string
  sittings: number
  unitsAwarded: number
  unitsMax: number
  /** 0..100, one decimal; 0 when unitsMax is 0. */
  percent: number
}

export interface ItemStatRow {
  questionId: string
  sittings: number
  attempted: number
  awarded: number
  marks: number
  /** awarded / marks as a percentage, one decimal; 0 when marks is 0. */
  facilityPercent: number
}

const round2 = (n: number): number => Math.round(n * 100) / 100
const round1 = (n: number): number => Math.round(n * 10) / 10

function bad(what: string): never {
  throw new RangeError(`invalid aggregate input: ${what}`)
}

function checkFigure(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_FIGURE) bad(what)
  return round2(value)
}

function checkDate(value: unknown, what: string): Date | null {
  if (value === undefined || value === null) return null
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) bad(what)
  return value
}

function decimalId(value: unknown, what: string): bigint {
  if (typeof value !== 'string') bad(what)
  try {
    return idFromString(value)
  } catch {
    return bad(what)
  }
}

interface Checked {
  attemptId: string
  userId: bigint
  paperId: bigint | null
  score: number
  max: number
  startType: 'pilihan' | 'jana' | null
  startedAt: Date | null
  submittedAt: Date | null
  durationSec: number | null
  items: { questionId: string; marks: number; awarded: number; attempted: boolean; counted: boolean }[]
}

function validate(input: BijakAttemptAggregateInput): Checked {
  if (typeof input !== 'object' || input === null) bad('input')
  if (typeof input.attemptId !== 'string' || !UUID.test(input.attemptId)) bad('attemptId')
  const userId = decimalId(input.userId, 'userId')
  if (typeof input.isTest !== 'boolean') bad('isTest')
  if (typeof input.subject !== 'string' || input.subject.length < 1 || input.subject.length > 32) bad('subject')
  if (!Number.isInteger(input.kertas) || input.kertas < 1 || input.kertas > 32767) bad('kertas')
  if (input.mode !== 'exam' && input.mode !== 'latihan') bad('mode')
  if (input.status !== 'submitted' && input.status !== 'auto_submitted') bad('status')
  if (typeof input.provisional !== 'boolean' || typeof input.regraded !== 'boolean') bad('flags')
  const paperKind = input.paperKind ?? null
  if (paperKind !== null && paperKind !== 'pilihan' && paperKind !== 'jana') bad('paperKind')
  const paperId = input.paperId === null ? null : decimalId(input.paperId, 'paperId')
  const score = checkFigure(input.score, 'score')
  const max = checkFigure(input.max, 'max')
  if (score > max) bad('score above max')
  if (!Array.isArray(input.questions) || input.questions.length > MAX_QUESTIONS) bad('questions')
  const items = input.questions.map((q) => {
    if (typeof q !== 'object' || q === null) bad('question')
    if (typeof q.questionId !== 'string' || q.questionId.length < 1 || q.questionId.length > 64) bad('questionId')
    const marks = checkFigure(q.marks, 'marks')
    const awarded = checkFigure(q.awarded, 'awarded')
    if (awarded > marks) bad('awarded above marks')
    if (typeof q.attempted !== 'boolean' || typeof q.counted !== 'boolean') bad('question flags')
    return { questionId: q.questionId, marks, awarded, attempted: q.attempted, counted: q.counted }
  })
  const startedAt = checkDate(input.startedAt, 'startedAt')
  const submittedAt = checkDate(input.submittedAt, 'submittedAt')
  const durationSec =
    startedAt && submittedAt ? Math.max(0, Math.round((submittedAt.getTime() - startedAt.getTime()) / 1000)) : null
  return { attemptId: input.attemptId, userId, paperId, score, max, startType: paperKind, startedAt, submittedAt, durationSec, items }
}

function checkIds(userIds: string[]): bigint[] {
  if (!Array.isArray(userIds) || userIds.length > MAX_USER_IDS) throw new RangeError('invalid userIds')
  return userIds.map((id) => {
    try {
      return idFromString(id)
    } catch {
      throw new RangeError('invalid userIds')
    }
  })
}

interface Scope {
  /** undefined = no user filter (school scope only). */
  ids: bigint[] | undefined
  schoolId: bigint | undefined
}

/** Validates the scope. Returns null when the read is empty by definition (`userIds: []`). */
function checkScope(f: AggregateScope): Scope | null {
  if (f.userIds === undefined && f.schoolId === undefined) throw new RangeError('invalid scope: userIds or schoolId required')
  const ids = f.userIds === undefined ? undefined : checkIds(f.userIds)
  let schoolId: bigint | undefined
  if (f.schoolId !== undefined) {
    if (typeof f.schoolId !== 'string') throw new RangeError('invalid schoolId')
    try {
      schoolId = idFromString(f.schoolId)
    } catch {
      throw new RangeError('invalid schoolId')
    }
  }
  if (ids !== undefined && ids.length === 0) return null
  return { ids, schoolId }
}

function checkLimit(limit: number | undefined): number {
  if (limit === undefined) return DEFAULT_LIMIT
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) throw new RangeError('invalid limit')
  return limit
}

function checkFilter(f: Omit<AggregateFilter, keyof AggregateScope>): void {
  if (f.subjectCode !== undefined && (typeof f.subjectCode !== 'string' || f.subjectCode.length < 1 || f.subjectCode.length > 32))
    throw new RangeError('invalid subjectCode')
  if (f.kertas !== undefined && (!Number.isInteger(f.kertas) || f.kertas < 1)) throw new RangeError('invalid kertas')
  for (const d of [f.from, f.to]) if (d !== undefined && (!(d instanceof Date) || Number.isNaN(d.getTime()))) throw new RangeError('invalid date')
}

type DbRow = Prisma.PracticeAttemptAggregateGetPayload<object>

function toRow(r: DbRow): AggregateRow {
  return {
    attemptId: r.attemptId,
    userId: r.userId.toString(),
    paperId: r.paperId === null ? null : r.paperId.toString(),
    startType: r.startType as AggregateRow['startType'],
    subjectCode: r.subjectCode,
    kertas: r.kertas,
    mode: r.mode as AggregateRow['mode'],
    status: r.status as AggregateRow['status'],
    unitsAwarded: round2(r.unitsAwarded.toNumber()),
    unitsMax: round2(r.unitsMax.toNumber()),
    durationSec: r.durationSec,
    provisional: r.provisional,
    submittedAt: r.submittedAt,
    schoolId: r.schoolId === null ? null : r.schoolId.toString(),
  }
}

/**
 * US-33 attempt aggregate (owner M05). One row per submitted or marked Bijak sitting (AC-33.4), written by
 * `recordGraded` (BE-16 calls it after its commit). The read methods are for BE-19 and BE-21 and ALWAYS
 * exclude `is_test` rows (G-07, AC-18.3). Only `ownHistory` includes the owner's own test rows.
 *
 * Every row carries `school_id`, the student's `users.school_id` read in the same statement as the insert
 * (a snapshot: a regrade or a later school move never changes it). BE-19 and BE-21 should scope
 * school-level reports with `AggregateScope.schoolId`, not by expanding a school into `userIds[]`.
 */
@Injectable()
export class PracticeAggregateService implements BijakAttemptAggregatePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordGraded(input: BijakAttemptAggregateInput): Promise<void> {
    const v = validate(input)
    await this.prisma.transaction(async (tx) => {
      const inserted = await tx.$queryRaw<{ id: bigint }[]>`
        INSERT INTO practice_attempt_aggregates
          (source, attempt_id, user_id, paper_id, start_type, subject_code, kertas, mode, status,
           units_awarded, units_max, duration_sec, provisional, regrade_count, started_at, submitted_at, is_test,
           school_id)
        VALUES (${SOURCE}, ${v.attemptId}::uuid, ${v.userId}, ${v.paperId}, ${v.startType}, ${input.subject},
           ${input.kertas}, ${input.mode}, ${input.status}, ${v.score}::numeric, ${v.max}::numeric, ${v.durationSec},
           ${input.provisional}, ${input.regraded ? 1 : 0}, ${v.startedAt}, ${v.submittedAt}, ${input.isTest},
           (SELECT u.school_id FROM users u WHERE u.id = ${v.userId}))
        ON CONFLICT (source, attempt_id) DO NOTHING
        RETURNING id`
      if (inserted.length > 0) {
        await this.insertItems(tx, inserted[0]!.id, v, input.isTest)
        return
      }
      const locked = await tx.$queryRaw<{ id: bigint; user_id: bigint; is_test: boolean }[]>`
        SELECT id, user_id, is_test FROM practice_attempt_aggregates
        WHERE source = ${SOURCE} AND attempt_id = ${v.attemptId}::uuid FOR UPDATE`
      const row = locked[0]
      if (!row) throw new Error('aggregate row vanished')
      if (row.user_id !== v.userId || row.is_test !== input.isTest) throw new RangeError('aggregate owner mismatch')
      if (!input.regraded) return // replay: change nothing
      // Regrade: school_id is NOT updated (snapshot of the first write).
      await tx.practiceAttemptAggregate.update({
        where: { id: row.id },
        data: {
          unitsAwarded: v.score,
          unitsMax: v.max,
          status: input.status,
          provisional: input.provisional,
          mode: input.mode,
          subjectCode: input.subject,
          kertas: input.kertas,
          paperId: v.paperId,
          regradeCount: { increment: 1 },
          ...(v.durationSec !== null ? { durationSec: v.durationSec } : {}),
          ...(v.startType !== null ? { startType: v.startType } : {}),
          ...(v.startedAt ? { startedAt: v.startedAt } : {}),
          ...(v.submittedAt ? { submittedAt: v.submittedAt } : {}),
        },
      })
      await tx.practiceAttemptAggregateItem.deleteMany({ where: { aggregateId: row.id } })
      await this.insertItems(tx, row.id, v, input.isTest)
    })
  }

  private async insertItems(
    tx: TxClient,
    aggregateId: bigint,
    v: Checked,
    isTest: boolean,
  ): Promise<void> {
    if (v.items.length === 0) return
    await tx.practiceAttemptAggregateItem.createMany({
      data: v.items.map((q, position) => ({ aggregateId, position, ...q, isTest })),
    })
  }

  /** Sittings of the given students, newest first. Test rows are excluded. */
  async forStudents(
    filter: AggregateFilter & { limit?: number },
  ): Promise<AggregateRow[]> {
    const scope = checkScope(filter)
    checkFilter(filter)
    const take = checkLimit(filter.limit)
    if (scope === null) return []
    const rows = await this.prisma.client.practiceAttemptAggregate.findMany({
      where: this.where(scope, filter),
      orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take,
    })
    return rows.map(toRow)
  }

  /** Per (user, subject) totals. Test rows are excluded. */
  async subjectSummary(filter: AggregateScope & { from?: Date; to?: Date }): Promise<SubjectSummaryRow[]> {
    const scope = checkScope(filter)
    checkFilter(filter)
    if (scope === null) return []
    const groups = await this.prisma.client.practiceAttemptAggregate.groupBy({
      by: ['userId', 'subjectCode'],
      where: this.where(scope, filter),
      _count: { _all: true },
      _sum: { unitsAwarded: true, unitsMax: true },
      orderBy: [{ userId: 'asc' }, { subjectCode: 'asc' }],
    })
    return groups.map((g) => {
      const awarded = round2(g._sum.unitsAwarded?.toNumber() ?? 0)
      const max = round2(g._sum.unitsMax?.toNumber() ?? 0)
      return {
        userId: g.userId.toString(),
        subjectCode: g.subjectCode,
        sittings: g._count._all,
        unitsAwarded: awarded,
        unitsMax: max,
        percent: max > 0 ? round1((awarded / max) * 100) : 0,
      }
    })
  }

  /** Per-question figures over counted items. Test rows are excluded. */
  async itemStats(filter: AggregateScope & {
    paperId?: string
    subjectCode?: string
    kertas?: number
  }): Promise<ItemStatRow[]> {
    const scope = checkScope(filter)
    checkFilter(filter)
    const paperId = filter.paperId === undefined ? undefined : decimalId(filter.paperId, 'paperId')
    if (scope === null) return []
    const conds: Prisma.Sql[] = [
      Prisma.sql`a.source = ${SOURCE}`,
      Prisma.sql`a.is_test = false`,
      Prisma.sql`i.is_test = false`,
      Prisma.sql`i.counted = true`,
    ]
    if (scope.ids !== undefined) conds.push(Prisma.sql`a.user_id IN (${Prisma.join(scope.ids)})`)
    if (scope.schoolId !== undefined) conds.push(Prisma.sql`a.school_id = ${scope.schoolId}`)
    if (paperId !== undefined) conds.push(Prisma.sql`a.paper_id = ${paperId}`)
    if (filter.subjectCode !== undefined) conds.push(Prisma.sql`a.subject_code = ${filter.subjectCode}`)
    if (filter.kertas !== undefined) conds.push(Prisma.sql`a.kertas = ${filter.kertas}`)
    const rows = await this.prisma.client.$queryRaw<
      { question_id: string; sittings: number; attempted: number; awarded: number; marks: number }[]
    >`
      SELECT i.question_id,
             COUNT(*)::int AS sittings,
             (COUNT(*) FILTER (WHERE i.attempted))::int AS attempted,
             SUM(i.awarded)::float8 AS awarded,
             SUM(i.marks)::float8 AS marks
      FROM practice_attempt_aggregate_items i
      JOIN practice_attempt_aggregates a ON a.id = i.aggregate_id
      WHERE ${Prisma.join(conds, ' AND ')}
      GROUP BY i.question_id
      ORDER BY i.question_id`
    return rows.map((r) => {
      const awarded = round2(r.awarded)
      const marks = round2(r.marks)
      return {
        questionId: r.question_id,
        sittings: r.sittings,
        attempted: r.attempted,
        awarded,
        marks,
        facilityPercent: marks > 0 ? round1((awarded / marks) * 100) : 0,
      }
    })
  }

  /**
   * The owner's own sittings INCLUDING their Mod Pelajar test rows. For the owner's own screen only: other
   * modules (teacher, school, analytics) must use the other reads, which exclude test data.
   */
  async ownHistory(userId: string, opts: { limit?: number } = {}): Promise<AggregateRow[]> {
    const id = decimalId(userId, 'userId')
    const take = checkLimit(opts.limit)
    const rows = await this.prisma.client.practiceAttemptAggregate.findMany({
      where: { source: SOURCE, userId: id },
      orderBy: [{ submittedAt: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      take,
    })
    return rows.map(toRow)
  }

  private where(scope: Scope, f: Omit<AggregateFilter, keyof AggregateScope>): Prisma.PracticeAttemptAggregateWhereInput {
    return {
      source: SOURCE,
      isTest: false,
      ...(scope.ids !== undefined ? { userId: { in: scope.ids } } : {}),
      ...(scope.schoolId !== undefined ? { schoolId: scope.schoolId } : {}),
      ...(f.subjectCode !== undefined ? { subjectCode: f.subjectCode } : {}),
      ...(f.kertas !== undefined ? { kertas: f.kertas } : {}),
      ...(f.from || f.to ? { submittedAt: { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lt: f.to } : {}) } } : {}),
    }
  }
}
