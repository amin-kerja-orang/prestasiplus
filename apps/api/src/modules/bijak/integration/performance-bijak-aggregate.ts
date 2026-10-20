import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { CurriculumRepository } from '../../curriculum'
import { QuestionsRepository } from '../../questions'
import type { QuestionRecord } from '../../questions/types'
import { bijakCodeOf } from '../papers/subject-codes'
import { compareIds } from '../../reports/performance/domain/rules'
import type {
  BijakAggregatePort,
  BijakGroupBy,
  BijakItemFact,
  BijakItemQuery,
  BijakMode,
  BijakSittingFact,
  BijakSittingQuery,
  BijakTotals,
  OptionLetter,
} from '../../reports/performance/ports'

/** Largest id list in one statement; longer lists run as several statements and are merged. */
export const CHUNK = 1000

const LETTERS: readonly string[] = ['A', 'B', 'C', 'D']
const isLetter = (v: unknown): v is OptionLetter => typeof v === 'string' && LETTERS.includes(v)

/** Whole seconds between start and submit (same expression in `sittings` and `totals`, so the sums agree). */
const DURATION = Prisma.sql`GREATEST(0, ROUND(EXTRACT(EPOCH FROM (a.submitted_at - a.started_at))))::int`
/** Malaysian calendar day of the submit time (the contract's `mytDay`). */
const DAY = Prisma.sql`to_char(a.submitted_at AT TIME ZONE 'Asia/Kuala_Lumpur', 'YYYY-MM-DD')`

/** Constant key expressions per grouping (never built from input). */
const KEYS: Record<BijakGroupBy, { select: Prisma.Sql; group: Prisma.Sql }> = {
  user: { select: Prisma.sql`a.user_id::text AS user_id`, group: Prisma.sql`a.user_id` },
  user_subject: { select: Prisma.sql`a.user_id::text AS user_id, a.subject AS subject_id`, group: Prisma.sql`a.user_id, a.subject` },
  subject: { select: Prisma.sql`a.subject AS subject_id`, group: Prisma.sql`a.subject` },
  school: { select: Prisma.sql`COALESCE(u.school_id::text, '') AS school_id`, group: Prisma.sql`COALESCE(u.school_id::text, '')` },
  day: { select: Prisma.sql`${DAY} AS day`, group: DAY },
  user_day: { select: Prisma.sql`a.user_id::text AS user_id, ${DAY} AS day`, group: Prisma.sql`a.user_id, ${DAY}` },
}

const FROM = Prisma.sql`
  FROM exam_attempts a
  JOIN attempt_results r ON r.attempt_id = a.id
  JOIN users u ON u.id = a.user_id`

interface SittingRow {
  attempt_id: string
  user_id: string
  school_id: string | null
  subject: string
  subject_name: string
  paper_kind: 'pilihan' | 'jana'
  mode: BijakMode
  status: 'submitted' | 'auto_submitted'
  score: number
  max_score: number
  provisional: boolean
  pending_review: number
  duration_seconds: number
  started_at: Date
  submitted_at: Date
}

interface TotalsRow {
  user_id?: string
  subject_id?: string
  school_id?: string
  day?: string
  subject_name: string | null
  sittings: number
  score: number
  max: number
  seconds: number
  graded_score: number
  graded_max: number
  pupils: number
  last_submitted_at: Date
}

interface ItemRow {
  attempt_id: string
  user_id: string
  school_id: string | null
  subject: string
  subject_name: string
  question_id: string
  awarded: number
  marks: number
  chosen: string | null
  correct: string
}

const chunks = <T>(list: readonly T[]): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += CHUNK) out.push(list.slice(i, i + CHUNK))
  return out
}

/** Distinct, valid decimal ids of a list; undefined stays undefined (no filter). */
const cleanIds = (list: readonly string[] | undefined): string[] | undefined =>
  list === undefined ? undefined : [...new Set(list.filter(isIdString))]

/**
 * The real `BijakAggregatePort` (BE-19 reports) over BE-16's attempt tables. READ ONLY: no writes, no
 * migration. A sitting is an `exam_attempts` row that is `submitted` or `auto_submitted`, has a result row
 * and is not `is_test` (Mod Pelajar); abandoned and in-progress rows never match. The school is the pupil's
 * CURRENT `users.school_id` (the attempt has none), so a pupil's history follows them.
 *
 * - `sittings`: one statement per id chunk, joined with `attempt_results` and `users`.
 * - `totals`: the GROUP BY runs in SQL (numeric sums cast to float8 once); chunks of a long id list hold
 *   disjoint pupils, so merging rows of the same key is a plain sum (pupils too).
 * - `items`: MCQ questions are read from `attempt_results.graded` (the graded question rows keep the pupil's
 *   chosen option and the correct option); stem, options and topic come from the BE-09 bank through
 *   `QuestionsRepository` in batches (see the deviations doc: the LIVE version, not a pinned one).
 *
 * Why not `practice_attempt_aggregates` (BE-12): it has no school, no pupil choice and no subject name,
 * its `units_*` are the same marks but it would still need `exam_attempts` for the item letters.
 */
@Injectable()
export class PrismaBijakAggregate implements BijakAggregatePort {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  async sittings(query: BijakSittingQuery): Promise<BijakSittingFact[]> {
    const q = await withSubjectCode(query, this.curriculum)
    const out: BijakSittingFact[] = []
    for (const where of this.wheres(q, true)) {
      const rows = await this.prisma.client.$queryRaw<SittingRow[]>`
        SELECT a.id::text AS attempt_id, a.user_id::text AS user_id, u.school_id::text AS school_id,
               a.subject, a.subject_name, a.paper_kind, a.mode, a.status,
               r.score::float8 AS score, r.max_score::float8 AS max_score, r.provisional, r.pending_review,
               ${DURATION} AS duration_seconds, a.started_at, a.submitted_at
        ${FROM}
        WHERE ${where}
        ORDER BY a.submitted_at, a.id`
      for (const r of rows) {
        out.push({
          attemptId: r.attempt_id,
          userId: r.user_id,
          schoolId: r.school_id,
          subjectId: r.subject,
          subjectCode: r.subject,
          subjectName: r.subject_name,
          paperKind: r.paper_kind,
          mode: r.mode,
          status: r.status,
          score: r.score,
          maxScore: r.max_score,
          provisional: r.provisional,
          pendingReview: r.pending_review,
          durationSeconds: r.duration_seconds,
          startedAt: r.started_at,
          submittedAt: r.submitted_at,
        })
      }
    }
    return out.sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime() || compareIds(a.attemptId, b.attemptId))
  }

  async totals(query: BijakSittingQuery, groupBy: BijakGroupBy): Promise<BijakTotals[]> {
    const q = await withSubjectCode(query, this.curriculum)
    const key = KEYS[groupBy]
    const named = groupBy === 'subject' || groupBy === 'user_subject'
    const merged = new Map<string, BijakTotals>()
    for (const where of this.wheres(q, true)) {
      const rows = await this.prisma.client.$queryRaw<TotalsRow[]>`
        SELECT ${key.select},
               MAX(a.subject_name) AS subject_name,
               COUNT(*)::int AS sittings,
               COALESCE(SUM(r.score), 0)::float8 AS score,
               COALESCE(SUM(r.max_score), 0)::float8 AS max,
               COALESCE(SUM(${DURATION}), 0)::float8 AS seconds,
               COALESCE(SUM(r.score) FILTER (WHERE NOT r.provisional), 0)::float8 AS graded_score,
               COALESCE(SUM(r.max_score) FILTER (WHERE NOT r.provisional), 0)::float8 AS graded_max,
               COUNT(DISTINCT a.user_id)::int AS pupils,
               MAX(a.submitted_at) AS last_submitted_at
        ${FROM}
        WHERE ${where}
        GROUP BY ${key.group}`
      for (const r of rows) {
        const row: BijakTotals = {
          ...(r.user_id !== undefined ? { userId: r.user_id } : {}),
          ...(r.subject_id !== undefined ? { subjectId: r.subject_id } : {}),
          ...(named && r.subject_name !== null ? { subjectName: r.subject_name } : {}),
          ...(r.school_id !== undefined ? { schoolId: r.school_id } : {}),
          ...(r.day !== undefined ? { day: r.day } : {}),
          sittings: r.sittings,
          score: r.score,
          max: r.max,
          seconds: r.seconds,
          gradedScore: r.graded_score,
          gradedMax: r.graded_max,
          pupils: r.pupils,
          lastSubmittedAt: r.last_submitted_at,
        }
        const id = [row.userId, row.subjectId, row.schoolId, row.day].join('|')
        const have = merged.get(id)
        if (!have) {
          merged.set(id, row)
          continue
        }
        // Another id chunk: its pupils are different people, so every figure just adds up.
        have.sittings += row.sittings
        have.score += row.score
        have.max += row.max
        have.seconds += row.seconds
        have.gradedScore += row.gradedScore
        have.gradedMax += row.gradedMax
        have.pupils += row.pupils
        if (row.lastSubmittedAt > have.lastSubmittedAt) have.lastSubmittedAt = row.lastSubmittedAt
      }
    }
    return [...merged.values()].sort(
      (a, b) =>
        compareIds(a.userId ?? '', b.userId ?? '') ||
        compareIds(a.subjectId ?? '', b.subjectId ?? '') ||
        compareIds(a.schoolId ?? '', b.schoolId ?? '') ||
        (a.day ?? '').localeCompare(b.day ?? ''),
    )
  }

  async items(query: BijakItemQuery): Promise<BijakItemFact[]> {
    const q = await withSubjectCode(query, this.curriculum)
    const { questionIds, ...sittingQuery } = q
    const wantedQuestions = cleanIds(questionIds)
    if (wantedQuestions !== undefined && wantedQuestions.length === 0) return []
    const rows: ItemRow[] = []
    for (const where of this.wheres(sittingQuery, true)) {
      for (const qs of wantedQuestions === undefined ? [undefined] : chunks(wantedQuestions)) {
        const only = qs === undefined ? Prisma.empty : Prisma.sql`AND g.q->>'questionId' IN (${Prisma.join(qs)})`
        rows.push(
          ...(await this.prisma.client.$queryRaw<ItemRow[]>`
            SELECT a.id::text AS attempt_id, a.user_id::text AS user_id, u.school_id::text AS school_id,
                   a.subject, a.subject_name, g.q->>'questionId' AS question_id,
                   (g.q->>'awarded')::float8 AS awarded, (g.q->>'marks')::float8 AS marks,
                   p.p->'answer'->>'choice' AS chosen, p.p->'scheme'->>'correctOption' AS correct
            ${FROM}
            CROSS JOIN LATERAL jsonb_array_elements(r.graded->'questions') WITH ORDINALITY AS g(q, n)
            CROSS JOIN LATERAL jsonb_array_elements(g.q->'parts') AS p(p)
            WHERE ${where}
              AND jsonb_array_length(g.q->'parts') = 1
              AND p.p->>'partId' = g.q->>'questionId'
              AND p.p->'scheme' ? 'correctOption'
              AND COALESCE((g.q->>'counted')::boolean, true)
              ${only}
            ORDER BY a.submitted_at, a.id, g.n`),
        )
      }
    }
    const usable = rows.filter((r) => isLetter(r.correct))
    if (usable.length === 0) return []
    const bank = await this.bank([...new Set(usable.map((r) => r.question_id))])
    const out: BijakItemFact[] = []
    for (const r of usable) {
      const info = bank.get(r.question_id)
      if (!info || !info.options.some((o) => o.letter === r.correct)) continue
      out.push({
        attemptId: r.attempt_id,
        userId: r.user_id,
        schoolId: r.school_id,
        questionId: r.question_id,
        questionVersion: info.versionNo,
        subjectId: r.subject,
        subjectName: r.subject_name,
        topic: info.topic,
        subtopic: null,
        stem: info.stem,
        options: info.options,
        correctLetter: r.correct as OptionLetter,
        chosenLetter: isLetter(r.chosen) ? r.chosen : null,
        awarded: r.awarded,
        max: r.marks,
      })
    }
    return out
  }

  /**
   * WHERE fragments, one per (user chunk x school chunk). Always: not a test row, a closed sitting with a
   * submit time. An empty id list matches nothing, so it yields no fragment at all.
   */
  private wheres(q: BijakSittingQuery, closedOnly: boolean): Prisma.Sql[] {
    const users = cleanIds(q.userIds)
    const schools = cleanIds(q.schoolIds)
    if ((users && users.length === 0) || (schools && schools.length === 0)) return []
    if (q.modes && q.modes.length === 0) return []
    if (q.subjectId !== undefined && q.subjectId === '') return []
    const base: Prisma.Sql[] = [Prisma.sql`a.is_test = false`]
    if (closedOnly) base.push(Prisma.sql`a.status IN ('submitted', 'auto_submitted')`, Prisma.sql`a.submitted_at IS NOT NULL`)
    if (q.subjectId !== undefined) base.push(Prisma.sql`a.subject = ${q.subjectId}`)
    if (q.modes) base.push(Prisma.sql`a.mode IN (${Prisma.join([...q.modes])})`)
    if (q.submittedFrom) base.push(Prisma.sql`a.submitted_at >= ${q.submittedFrom}`)
    if (q.submittedTo) base.push(Prisma.sql`a.submitted_at < ${q.submittedTo}`)
    if (q.state !== undefined || q.district !== undefined) {
      const scope: Prisma.Sql[] = []
      if (q.state !== undefined) scope.push(Prisma.sql`s.state = ${q.state}`)
      if (q.district !== undefined) scope.push(Prisma.sql`s.district = ${q.district}`)
      base.push(Prisma.sql`u.school_id IN (SELECT s.id FROM schools s WHERE ${Prisma.join(scope, ' AND ')})`)
    }
    const out: Prisma.Sql[] = []
    for (const uc of users ? chunks(users) : [undefined]) {
      for (const sc of schools ? chunks(schools) : [undefined]) {
        const parts = [...base]
        if (uc) parts.push(Prisma.sql`a.user_id IN (${Prisma.join(uc.map(idFromString))})`)
        if (sc) parts.push(Prisma.sql`u.school_id IN (${Prisma.join(sc.map(idFromString))})`)
        out.push(Prisma.join(parts, ' AND '))
      }
    }
    return out
  }

  /** Stem, options and topic of MCQ questions: the live version, else the latest (withdrawn questions). */
  private async bank(
    ids: readonly string[],
  ): Promise<Map<string, { stem: string; options: { letter: OptionLetter; text: string }[]; topic: string | null; versionNo: number }>> {
    const records = new Map<string, QuestionRecord>()
    for (const view of ['live', 'latest'] as const) {
      const missing = ids.filter((id) => !records.has(id))
      for (const c of chunks(missing)) for (const r of await this.questions.getMany(c, view)) records.set(r.id, r)
    }
    const units = [...new Set([...records.values()].map((r) => r.version.unitId).filter((u): u is string => u !== null))]
    const titles = new Map<string, string | null>()
    await Promise.all(units.map(async (u) => titles.set(u, (await this.curriculum.nodeById(idFromString(u)))?.title ?? null)))
    const out = new Map<string, { stem: string; options: { letter: OptionLetter; text: string }[]; topic: string | null; versionNo: number }>()
    for (const [id, rec] of records) {
      const v = rec.version
      const only = v.parts.length === 1 ? v.parts[0] : undefined
      if (!only || !('mode' in only) || only.mode !== 'mcq') continue
      const prompt = only.prompt.ms
      const stemText = v.stemMs ?? ''
      const stem = stemText && prompt && stemText !== prompt ? `${stemText}\n\n${prompt}` : stemText || prompt
      const options = only.options.flatMap((o) => (isLetter(o.label) ? [{ letter: o.label, text: o.body.ms }] : []))
      out.set(id, { stem, options, topic: v.unitId !== null ? (titles.get(v.unitId) ?? null) : null, versionNo: v.versionNo })
    }
    return out
  }
}

/**
 * A class (BE-17) stores its subject as a curriculum `subjects.id` (decimal string); a sitting stores the Bijak subject
 * CODE (`exam_attempts.subject`, e.g. MAT). A decimal `subjectId` in a query is therefore translated to the Bijak code
 * before filtering (an unknown id becomes '' and matches nothing); a code is left as it is.
 */
export async function withSubjectCode<T extends { subjectId?: string }>(
  q: T,
  curriculum: { subject(id: bigint): Promise<{ code: string } | null> },
): Promise<T> {
  if (q.subjectId === undefined || !/^\d+$/.test(q.subjectId)) return q
  const subject = await curriculum.subject(idFromString(q.subjectId))
  return { ...q, subjectId: subject ? bijakCodeOf(subject.code) : '' }
}
