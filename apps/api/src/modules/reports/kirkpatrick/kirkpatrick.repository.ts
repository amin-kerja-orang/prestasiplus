import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

/**
 * The one doorway to the M12 tables (`feedback`, `interventions`) and the read-only aggregates behind the Kirkpatrick
 * levels. Every query is parameterised. The aggregates read `users`, `user_roles`, `schools`, `practice_sessions`
 * and `practice_answers` directly (a deliberate, read-only exception to the "users only through UsersRepository"
 * habit, recorded in docs/architecture/v2-backend-deviations.md): a per-school roll-up of the whole T4/T5 population
 * cannot be expressed through the per-user repository API. Rows written under Mod Pelajar (`is_test`) are excluded
 * from every figure.
 *
 * Ids on the wire are decimal strings; a scope is a list of school ids (`null` = every school, `[]` = none).
 */

/** One row per (pupil, subject, month) of completed non-test practice of the T4/T5 segment. */
export interface Cell {
  userId: string
  schoolId: string
  subjectId: string | null
  /** `YYYY-MM`, Asia/Kuala_Lumpur. */
  month: string
  sessions: number
  answered: number
  correct: number
  /** Sessions with at least one answer, and the sum of their score percentages. */
  scoredSessions: number
  scoreSum: number
}

export interface SchoolPopulationRow {
  schoolId: string
  t4t5: number
  never: number
  teachers: number
  teachersLoggedIn: number
}

export interface SchoolInfo {
  id: string
  name: string
  code: string | null
  state: string | null
}

export interface FeedbackAggregateRow {
  role: string
  responses: number
  satSum: number
  npsCount: number
  npsSum: number
}

export interface PupilFacts {
  id: string
  name: string
  schoolId: string | null
  schoolName: string
  grade: number | null
  isStudent: boolean
}

export interface InterventionRecord {
  id: string
  studentId: string
  alertType: 'mood' | 'inactive' | 'declining'
  actionDate: string
  alertDescription: string
  actionTaken: string
  beforeAccuracy: number | null
  afterAccuracy: number | null
  beforeMood: 'happy' | 'okay' | 'sad' | 'stressed' | null
  afterMood: 'happy' | 'okay' | 'sad' | 'stressed' | null
  createdBy: string
  createdAt: Date
  updatedAt: Date
  studentName: string | null
}

export interface NewIntervention {
  studentId: string
  alertType: InterventionRecord['alertType']
  actionDate: string
  alertDescription: string
  actionTaken: string
  beforeAccuracy: number | null
  afterAccuracy: number | null
  beforeMood: InterventionRecord['beforeMood']
  afterMood: InterventionRecord['afterMood']
  createdBy: string
}

export interface FeedbackRecord {
  id: string
  userId: string
  role: string
  schoolId: string | null
  month: string
  nps: number
  satisfaction: number
  createdAt: Date
}

/** Who may see which interventions. `students` is an explicit id list; `school` means the pupils of that school. */
export type InterventionScope = { kind: 'all' } | { kind: 'school'; schoolId: string } | { kind: 'students'; ids: readonly string[] }

const KL = 'Asia/Kuala_Lumpur'

const toIds = (ids: readonly string[]): bigint[] => ids.map((i) => idFromString(i))

const monthStart = (month: string): Date => new Date(`${month}-01T00:00:00Z`)
const monthKey = (d: Date): string => d.toISOString().slice(0, 7)
const dayKey = (d: Date): string => d.toISOString().slice(0, 10)

type InterventionRow = {
  id: bigint
  student_id: bigint
  alert_type: string
  action_date: Date
  alert_description: string
  action_taken: string
  before_accuracy: Prisma.Decimal | null
  after_accuracy: Prisma.Decimal | null
  before_mood: string | null
  after_mood: string | null
  created_by_id: bigint
  created_at: Date
  updated_at: Date
  student_name?: string | null
}

function toIntervention(r: InterventionRow): InterventionRecord {
  return {
    id: idToString(r.id),
    studentId: idToString(r.student_id),
    alertType: r.alert_type as InterventionRecord['alertType'],
    actionDate: dayKey(r.action_date),
    alertDescription: r.alert_description,
    actionTaken: r.action_taken,
    beforeAccuracy: r.before_accuracy === null ? null : Number(r.before_accuracy),
    afterAccuracy: r.after_accuracy === null ? null : Number(r.after_accuracy),
    beforeMood: r.before_mood as InterventionRecord['beforeMood'],
    afterMood: r.after_mood as InterventionRecord['afterMood'],
    createdBy: idToString(r.created_by_id),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    studentName: r.student_name ?? null,
  }
}

@Injectable()
export class KirkpatrickRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  /** `AND u.school_id = ANY(...)` for a scope, or nothing for every school. */
  private schoolClause(schoolIds: readonly string[] | null, column: Prisma.Sql): Prisma.Sql {
    return schoolIds === null ? Prisma.empty : Prisma.sql`AND ${column} = ANY(${toIds(schoolIds)}::bigint[])`
  }

  /** The T4/T5 segment (BR-M12-01): active pupils of grade 10 or 11 with a school, in scope. */
  private segment(schoolIds: readonly string[] | null): Prisma.Sql {
    return Prisma.sql`SELECT u.id AS user_id, u.school_id
      FROM users u
      WHERE u.is_active AND u.grade IN (10, 11) AND u.school_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student')
        ${this.schoolClause(schoolIds, Prisma.sql`u.school_id`)}`
  }

  // --- schools --------------------------------------------------------------------------------------------

  async schools(ids: readonly string[]): Promise<Map<string, SchoolInfo>> {
    const out = new Map<string, SchoolInfo>()
    if (ids.length === 0) return out
    const rows = await this.db.$queryRaw<{ id: string; name: string; code: string | null; state: string | null }[]>`
      SELECT id::text AS id, name, code, state FROM schools WHERE id = ANY(${toIds(ids)}::bigint[])`
    for (const r of rows) out.set(r.id, r)
    return out
  }

  async schoolIdsOfState(state: string): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ id: string }[]>`SELECT id::text AS id FROM schools WHERE state = ${state} ORDER BY id`
    return rows.map((r) => r.id)
  }

  async schoolExists(id: string): Promise<boolean> {
    const rows = await this.db.$queryRaw<{ one: number }[]>`SELECT 1 AS one FROM schools WHERE id = ${idFromString(id)}`
    return rows.length > 0
  }

  /** Schools with at least one user, name A to Z (S1 / S4 selects). */
  async schoolsWithUsers(only: string | null): Promise<SchoolInfo[]> {
    const where = only === null ? Prisma.empty : Prisma.sql`AND s.id = ${idFromString(only)}`
    return this.db.$queryRaw<SchoolInfo[]>`
      SELECT s.id::text AS id, s.name, s.code, s.state FROM schools s
      WHERE (s.type IS NULL OR s.type NOT IN ('SK', 'SJK(C)', 'SJK(T)')) AND EXISTS (SELECT 1 FROM users u WHERE u.school_id = s.id) ${where}
      ORDER BY s.name ASC, s.id ASC`
  }

  // --- populations and practice ---------------------------------------------------------------------------

  /** Per-school populations of a scope: T4/T5 pupils, never logged in, teachers, teachers logged in. */
  async populations(schoolIds: readonly string[] | null): Promise<SchoolPopulationRow[]> {
    if (schoolIds !== null && schoolIds.length === 0) return []
    const rows = await this.db.$queryRaw<
      { school_id: string; t4t5: number; never: number; teachers: number; teachers_logged_in: number }[]
    >`
      SELECT u.school_id::text AS school_id,
        count(*) FILTER (WHERE r.role = 'student' AND u.grade IN (10, 11))::int AS t4t5,
        count(*) FILTER (WHERE r.role = 'student' AND u.grade IN (10, 11) AND u.last_login_at IS NULL)::int AS never,
        count(*) FILTER (WHERE r.role = 'teacher')::int AS teachers,
        count(*) FILTER (WHERE r.role = 'teacher' AND u.last_login_at IS NOT NULL)::int AS teachers_logged_in
      FROM users u
      JOIN user_roles r ON r.user_id = u.id AND r.role IN ('student', 'teacher')
      WHERE u.is_active AND u.school_id IS NOT NULL ${this.schoolClause(schoolIds, Prisma.sql`u.school_id`)}
      GROUP BY u.school_id
      ORDER BY u.school_id`
    return rows.map((r) => ({ schoolId: r.school_id, t4t5: r.t4t5, never: r.never, teachers: r.teachers, teachersLoggedIn: r.teachers_logged_in }))
  }

  /** The practice roll-up of the segment: one row per (pupil, subject, month). */
  async cells(schoolIds: readonly string[] | null): Promise<Cell[]> {
    if (schoolIds !== null && schoolIds.length === 0) return []
    const rows = await this.db.$queryRaw<
      {
        user_id: string
        school_id: string
        subject_id: string | null
        month: string
        sessions: number
        answered: number
        correct: number
        scored_sessions: number
        score_sum: number
      }[]
    >`
      WITH seg AS (${this.segment(schoolIds)}),
      sess AS (
        SELECT s.id, s.user_id, seg.school_id, s.subject_id,
          to_char(s.completed_at AT TIME ZONE ${KL}, 'YYYY-MM') AS month,
          count(a.id) AS answered,
          count(a.id) FILTER (WHERE a.is_correct) AS correct
        FROM practice_sessions s
        JOIN seg ON seg.user_id = s.user_id
        LEFT JOIN practice_answers a ON a.session_id = s.id AND NOT a.is_test
        WHERE s.status = 'completed' AND NOT s.is_test AND s.completed_at IS NOT NULL
        GROUP BY s.id, s.user_id, seg.school_id, s.subject_id, s.completed_at
      )
      SELECT user_id::text AS user_id, school_id::text AS school_id, subject_id::text AS subject_id, month,
        count(*)::int AS sessions, sum(answered)::int AS answered, sum(correct)::int AS correct,
        count(*) FILTER (WHERE answered >= 1)::int AS scored_sessions,
        coalesce(sum(CASE WHEN answered >= 1 THEN 100.0 * correct / answered END), 0)::float8 AS score_sum
      FROM sess
      GROUP BY user_id, school_id, subject_id, month`
    return rows.map((r) => ({
      userId: r.user_id,
      schoolId: r.school_id,
      subjectId: r.subject_id,
      month: r.month,
      sessions: r.sessions,
      answered: r.answered,
      correct: r.correct,
      scoredSessions: r.scored_sessions,
      scoreSum: r.score_sum,
    }))
  }

  /** BR-M12-13: answers by weekday (1 = Isnin .. 7 = Ahad) and hour, MYT, of the segment's completed sessions. */
  async heat(schoolIds: readonly string[] | null): Promise<{ dow: number; hour: number; n: number }[]> {
    if (schoolIds !== null && schoolIds.length === 0) return []
    return this.db.$queryRaw<{ dow: number; hour: number; n: number }[]>`
      WITH seg AS (${this.segment(schoolIds)})
      SELECT extract(isodow FROM a.answered_at AT TIME ZONE ${KL})::int AS dow,
        extract(hour FROM a.answered_at AT TIME ZONE ${KL})::int AS hour,
        count(*)::int AS n
      FROM practice_answers a
      JOIN seg ON seg.user_id = a.user_id
      JOIN practice_sessions s ON s.id = a.session_id AND s.status = 'completed' AND NOT s.is_test
      WHERE NOT a.is_test
      GROUP BY 1, 2`
  }

  async subjectNames(ids: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (ids.length === 0) return out
    const rows = await this.db.$queryRaw<{ id: string; name: string }[]>`
      SELECT id::text AS id, name FROM subjects WHERE id = ANY(${toIds(ids)}::bigint[])`
    for (const r of rows) out.set(r.id, r.name)
    return out
  }

  async userNames(ids: readonly string[]): Promise<Map<string, string>> {
    const out = new Map<string, string>()
    if (ids.length === 0) return out
    const rows = await this.db.$queryRaw<{ id: string; name: string }[]>`
      SELECT id::text AS id, name FROM users WHERE id = ANY(${toIds(ids)}::bigint[])`
    for (const r of rows) out.set(r.id, r.name)
    return out
  }

  // --- feedback (level 1) ---------------------------------------------------------------------------------

  /** Feedback roll-up per role over non-test rows; `schoolId` narrows to the respondents of that school. */
  async feedbackAggregates(schoolId: string | null): Promise<FeedbackAggregateRow[]> {
    const where = schoolId === null ? Prisma.empty : Prisma.sql`AND school_id = ${idFromString(schoolId)}`
    const rows = await this.db.$queryRaw<{ role: string; responses: number; sat_sum: number; nps_count: number; nps_sum: number }[]>`
      SELECT role, count(*)::int AS responses, coalesce(sum(satisfaction), 0)::int AS sat_sum,
        count(nps)::int AS nps_count, coalesce(sum(nps), 0)::int AS nps_sum
      FROM feedback WHERE NOT is_test ${where} GROUP BY role`
    return rows.map((r) => ({ role: r.role, responses: r.responses, satSum: r.sat_sum, npsCount: r.nps_count, npsSum: r.nps_sum }))
  }

  /** Mod Pelajar (`isTest`) responses and real ones are separate: one never blocks the other. */
  async feedbackAnswered(userId: string, month: string, isTest: boolean): Promise<boolean> {
    const n = await this.db.feedback.count({ where: { userId: idFromString(userId), month: monthStart(month), isTest } })
    return n > 0
  }

  /** The respondent's school at response time: the account's school. */
  async schoolOfUser(userId: string): Promise<string | null> {
    const rows = await this.db.$queryRaw<{ school_id: string | null }[]>`
      SELECT school_id::text AS school_id FROM users WHERE id = ${idFromString(userId)}`
    return rows[0]?.school_id ?? null
  }

  /** Inserts the month's response; a duplicate (user, month) throws the Prisma unique error (P2002). */
  async insertFeedback(input: {
    userId: string
    role: string
    schoolId: string | null
    month: string
    nps: number
    satisfaction: number
    isTest: boolean
    now: Date
  }): Promise<FeedbackRecord> {
    const row = await this.db.feedback.create({
      data: {
        userId: idFromString(input.userId),
        role: input.role,
        schoolId: input.schoolId === null ? null : idFromString(input.schoolId),
        month: monthStart(input.month),
        nps: input.nps,
        satisfaction: input.satisfaction,
        isTest: input.isTest,
        createdAt: input.now,
        updatedAt: input.now,
      },
    })
    return {
      id: idToString(row.id),
      userId: idToString(row.userId),
      role: row.role,
      schoolId: row.schoolId === null ? null : idToString(row.schoolId),
      month: monthKey(row.month),
      nps: row.nps ?? input.nps,
      satisfaction: row.satisfaction,
      createdAt: row.createdAt,
    }
  }

  // --- pupils ---------------------------------------------------------------------------------------------

  async pupil(id: string): Promise<PupilFacts | null> {
    const rows = await this.db.$queryRaw<
      { id: string; name: string; school_id: string | null; school_name: string | null; grade: number | null; is_student: boolean }[]
    >`
      SELECT u.id::text AS id, u.name, u.school_id::text AS school_id, s.name AS school_name, u.grade,
        EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student') AS is_student
      FROM users u LEFT JOIN schools s ON s.id = u.school_id
      WHERE u.id = ${idFromString(id)}`
    const r = rows[0]
    return r ? { id: r.id, name: r.name, schoolId: r.school_id, schoolName: r.school_name ?? '', grade: r.grade, isStudent: r.is_student } : null
  }

  /** Per-subject totals of one pupil's completed non-test (or test, when `isTest`) practice. */
  async pupilSubjects(userId: string, isTest: boolean): Promise<{ subjectId: string; answered: number; correct: number }[]> {
    return this.db.$queryRaw<{ subjectId: string; answered: number; correct: number }[]>`
      SELECT a.subject_id::text AS "subjectId", count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct
      FROM practice_answers a
      JOIN practice_sessions s ON s.id = a.session_id AND s.status = 'completed' AND s.is_test = ${isTest}
      WHERE a.user_id = ${idFromString(userId)} AND a.is_test = ${isTest} AND a.subject_id IS NOT NULL
      GROUP BY a.subject_id`
  }

  async pupilTotals(userId: string, isTest: boolean): Promise<{ answered: number; correct: number }> {
    const rows = await this.db.$queryRaw<{ answered: number; correct: number }[]>`
      SELECT count(*)::int AS answered, count(*) FILTER (WHERE a.is_correct)::int AS correct
      FROM practice_answers a
      JOIN practice_sessions s ON s.id = a.session_id AND s.status = 'completed' AND s.is_test = ${isTest}
      WHERE a.user_id = ${idFromString(userId)} AND a.is_test = ${isTest}`
    return rows[0] ?? { answered: 0, correct: 0 }
  }

  /** Distinct MYT days (`YYYY-MM-DD`, ascending) with a completed session. */
  async pupilDays(userId: string, isTest: boolean): Promise<string[]> {
    const rows = await this.db.$queryRaw<{ day: string }[]>`
      SELECT DISTINCT to_char(completed_at AT TIME ZONE ${KL}, 'YYYY-MM-DD') AS day
      FROM practice_sessions
      WHERE user_id = ${idFromString(userId)} AND status = 'completed' AND is_test = ${isTest} AND completed_at IS NOT NULL
      ORDER BY day`
    return rows.map((r) => r.day)
  }

  /** Answers per MYT day since `fromDay` (inclusive), for the "30 squares". */
  async answersPerDay(userId: string, fromDay: string, isTest: boolean): Promise<Map<string, number>> {
    const rows = await this.db.$queryRaw<{ day: string; n: number }[]>`
      SELECT to_char(answered_at AT TIME ZONE ${KL}, 'YYYY-MM-DD') AS day, count(*)::int AS n
      FROM practice_answers
      WHERE user_id = ${idFromString(userId)} AND is_test = ${isTest}
        AND (answered_at AT TIME ZONE ${KL})::date >= ${fromDay}::date
      GROUP BY 1`
    return new Map(rows.map((r) => [r.day, r.n]))
  }

  // --- interventions (level 3; sensitive) -----------------------------------------------------------------

  private interventionWhere(scope: InterventionScope): Prisma.Sql {
    switch (scope.kind) {
      case 'all':
        return Prisma.empty
      case 'school':
        return Prisma.sql`WHERE i.student_id IN (SELECT id FROM users WHERE school_id = ${idFromString(scope.schoolId)})`
      case 'students':
        return Prisma.sql`WHERE i.student_id = ANY(${toIds(scope.ids)}::bigint[])`
    }
  }

  async interventions(scope: InterventionScope): Promise<InterventionRecord[]> {
    if (scope.kind === 'students' && scope.ids.length === 0) return []
    const rows = await this.db.$queryRaw<InterventionRow[]>`
      SELECT i.id, i.student_id, i.alert_type, i.action_date, i.alert_description, i.action_taken,
        i.before_accuracy, i.after_accuracy, i.before_mood, i.after_mood, i.created_by_id, i.created_at, i.updated_at,
        u.name AS student_name
      FROM interventions i LEFT JOIN users u ON u.id = i.student_id
      ${this.interventionWhere(scope)}
      ORDER BY i.created_at DESC, i.id DESC`
    return rows.map(toIntervention)
  }

  async insertIntervention(input: NewIntervention, now: Date): Promise<InterventionRecord> {
    const row = await this.db.intervention.create({
      data: {
        studentId: idFromString(input.studentId),
        alertType: input.alertType,
        actionDate: new Date(`${input.actionDate}T00:00:00Z`),
        alertDescription: input.alertDescription,
        actionTaken: input.actionTaken,
        beforeAccuracy: input.beforeAccuracy,
        afterAccuracy: input.afterAccuracy,
        beforeMood: input.beforeMood,
        afterMood: input.afterMood,
        createdById: idFromString(input.createdBy),
        createdAt: now,
        updatedAt: now,
      },
    })
    const names = await this.userNames([input.studentId])
    return toIntervention({
      id: row.id,
      student_id: row.studentId,
      alert_type: row.alertType,
      action_date: row.actionDate,
      alert_description: row.alertDescription,
      action_taken: row.actionTaken,
      before_accuracy: row.beforeAccuracy,
      after_accuracy: row.afterAccuracy,
      before_mood: row.beforeMood,
      after_mood: row.afterMood,
      created_by_id: row.createdById,
      created_at: row.createdAt,
      updated_at: row.updatedAt,
      student_name: names.get(input.studentId) ?? null,
    })
  }
}
