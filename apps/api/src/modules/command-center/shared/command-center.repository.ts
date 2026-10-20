/**
 * The one READ-ONLY repository of the Command Center (BE-22). The cross-user tallies the board and the drill-downs need do not
 * exist on any owner repository (`PracticeRepository` is per user), so they are read here with `$queryRaw`, the documented
 * precedent being `exam/builder/question-bank.source.ts`. Nothing here writes, and no value is ever concatenated into SQL:
 * every input is a bound parameter.
 *
 * Tables read: `users`, `user_roles`, `schools`, `school_subscriptions`, `classrooms`, `enrolments`, `teacher_profiles`,
 * `practice_sessions`, `practice_answers`, `subjects`, `chapters`.
 *
 * `is_test` (Mod Pelajar): `users` has no such column; the rows an admin wrote while acting as a student carry
 * `is_test = true` on `practice_answers`, `practice_sessions` and `enrolments`. EVERY read below excludes them.
 *
 * Ids go in and out as decimal strings. Counts are plain numbers. Instants are `Date`; MYT calendar days are `YYYY-MM-DD`.
 * "Student" means a user with the `student` role. The default population of an answer read is ACTIVE students (`u.is_active`);
 * pass `includeInactive: true` for "every pupil of the school".
 */
import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

const TZ = 'Asia/Kuala_Lumpur'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Which answers to count. `to` is inclusive unless `exclusiveTo`. `studentIds: []` matches nobody. */
export interface AnswerFilter {
  from?: Date
  to: Date
  exclusiveTo?: boolean
  /** A school's pupils (`users.school_id`); omit for the whole platform. */
  schoolId?: string
  studentIds?: string[]
  includeInactive?: boolean
}

export interface Tally {
  answers: number
  correct: number
  /** Distinct answering students. */
  students: number
}
export interface UserTally {
  userId: string
  name: string
  schoolId: string | null
  schoolName: string | null
  answers: number
  correct: number
  firstAt: Date
  lastAt: Date
}
export interface SchoolTally extends Tally {
  schoolId: string
  schoolName: string
}
export interface SubjectTally {
  /** null = answers outside any subject (free practice). */
  code: string | null
  name: string | null
  answers: number
  correct: number
  students: number
}
export interface FeedRow {
  userId: string
  studentName: string
  schoolId: string | null
  schoolName: string | null
  subjectCode: string | null
  subjectName: string | null
  isCorrect: boolean
  answeredAt: Date
}

export interface SessionRow {
  id: string
  userId: string
  mode: string
  subjectId: string | null
  subjectCode: string | null
  subjectName: string | null
  chapterName: string | null
  difficulty: number | null
  questionCount: number
  correctCount: number
  timeSpentSec: number
  missionId: string | null
  startedAt: Date
  completedAt: Date
}
export interface SessionFilter {
  userId?: string
  studentIds?: string[]
  from?: Date
  to?: Date
  /** Exact subject code; `'UMUM'` = no subject. */
  subjectCode?: string
  newestFirst?: boolean
  limit?: number
}

export interface UserBrief {
  id: string
  name: string
  schoolId: string | null
  isActive: boolean
  roles: string[]
}
export interface Ref {
  id: string
  name: string
}
export interface ClassRow {
  id: string
  name: string
  kind: string
  /** `classrooms.teacher_id`. */
  ownerId: string | null
  ownerName: string | null
  /** `classrooms.school_id`. */
  schoolId: string | null
  /** The class school, else the owner's school. */
  effectiveSchoolId: string | null
  isActive: boolean
  /** `education_levels.grade` (1..11 for the standard levels). */
  educationGrade: number | null
}
export interface TeacherRow {
  id: string
  name: string
  isActive: boolean
  subject: string | null
}
export interface LoginRow {
  userId: string
  name: string
  roles: string[]
  schoolId: string | null
  schoolName: string | null
  lastLoginAt: Date
  isComplimentary: boolean
  /** Has an active paid package / is on a subscribed school: raw flags for the package chip (ADMIN, PARENT, AKTIF, PKSK, SEKOLAH, BEBAS, FREE). */
  hasPackage: boolean
  hasPksk: boolean
  schoolSubscribed: boolean
}

type Row = Record<string, unknown>
const n = (v: unknown): number => Number(v ?? 0)
const s = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

function ids(list: string[]): bigint[] {
  const out: bigint[] = []
  for (const id of list) {
    try {
      out.push(idFromString(id))
    } catch {
      /* a malformed id matches nothing */
    }
  }
  return out
}
const bigintOrNull = (id: string): bigint | null => {
  try {
    return idFromString(id)
  } catch {
    return null
  }
}

@Injectable()
export class CommandCenterRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private q<T = Row>(query: Prisma.Sql): Promise<T[]> {
    return this.prisma.client.$queryRaw<T[]>(query)
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Fragments
  // ------------------------------------------------------------------------------------------------------------------

  /** WHERE conditions of an answer read over `practice_answers a JOIN users u ON u.id = a.user_id`. */
  private answerWhere(f: AnswerFilter): Prisma.Sql {
    const c: Prisma.Sql[] = [
      Prisma.sql`a.is_test = false`,
      f.exclusiveTo ? Prisma.sql`a.answered_at < ${f.to}` : Prisma.sql`a.answered_at <= ${f.to}`,
      Prisma.sql`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')`,
    ]
    if (f.from) c.push(Prisma.sql`a.answered_at >= ${f.from}`)
    if (!f.includeInactive) c.push(Prisma.sql`u.is_active`)
    if (f.schoolId !== undefined) {
      const sid = bigintOrNull(f.schoolId)
      c.push(sid === null ? Prisma.sql`false` : Prisma.sql`u.school_id = ${sid}`)
    }
    if (f.studentIds) c.push(Prisma.sql`a.user_id = ANY(${ids(f.studentIds)}::bigint[])`)
    return Prisma.join(c, ' AND ')
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Answers (practice_answers)
  // ------------------------------------------------------------------------------------------------------------------

  async answerTally(f: AnswerFilter): Promise<Tally> {
    const [r] = await this.q(Prisma.sql`
      SELECT count(*)::int AS answers, count(*) FILTER (WHERE a.is_correct)::int AS correct, count(DISTINCT a.user_id)::int AS students
        FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${this.answerWhere(f)}`)
    return { answers: n(r?.answers), correct: n(r?.correct), students: n(r?.students) }
  }

  /** One row per answering student, ordered by answers desc then id. */
  async answerTallyByUser(f: AnswerFilter): Promise<UserTally[]> {
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS user_id, u.name, u.school_id::text AS school_id, sc.name AS school_name,
             count(*)::int AS answers, count(*) FILTER (WHERE a.is_correct)::int AS correct,
             min(a.answered_at) AS first_at, max(a.answered_at) AS last_at
        FROM practice_answers a JOIN users u ON u.id = a.user_id LEFT JOIN schools sc ON sc.id = u.school_id
       WHERE ${this.answerWhere(f)}
       GROUP BY u.id, u.name, u.school_id, sc.name ORDER BY answers DESC, u.id ASC`)
    return rows.map((r) => ({
      userId: String(r.user_id),
      name: String(r.name),
      schoolId: s(r.school_id),
      schoolName: s(r.school_name),
      answers: n(r.answers),
      correct: n(r.correct),
      firstAt: r.first_at as Date,
      lastAt: r.last_at as Date,
    }))
  }

  /** One row per school with an answering student (students without a school are skipped), by active students desc, answers desc, id. */
  async answerTallyBySchool(f: AnswerFilter): Promise<SchoolTally[]> {
    const rows = await this.q(Prisma.sql`
      SELECT sc.id::text AS school_id, sc.name AS school_name, count(*)::int AS answers,
             count(*) FILTER (WHERE a.is_correct)::int AS correct, count(DISTINCT a.user_id)::int AS students
        FROM practice_answers a JOIN users u ON u.id = a.user_id JOIN schools sc ON sc.id = u.school_id
       WHERE ${this.answerWhere(f)}
       GROUP BY sc.id, sc.name ORDER BY students DESC, answers DESC, sc.id ASC`)
    return rows.map((r) => ({ schoolId: String(r.school_id), schoolName: String(r.school_name), answers: n(r.answers), correct: n(r.correct), students: n(r.students) }))
  }

  /** Distinct (student, MYT day) pairs with an answer; `day` is `YYYY-MM-DD`. */
  async answerDays(f: AnswerFilter): Promise<{ userId: string; day: string }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT DISTINCT a.user_id::text AS user_id, to_char(a.answered_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day
        FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${this.answerWhere(f)}`)
    return rows.map((r) => ({ userId: String(r.user_id), day: String(r.day) }))
  }

  /** Answers per MYT day (only days with answers), oldest first. */
  async dailyCounts(f: AnswerFilter): Promise<{ day: string; answers: number }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT to_char(a.answered_at AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, count(*)::int AS answers
        FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${this.answerWhere(f)} GROUP BY 1 ORDER BY 1`)
    return rows.map((r) => ({ day: String(r.day), answers: n(r.answers) }))
  }

  /** Answers per MYT hour (0..23; only hours with answers). */
  async hourlyCounts(f: AnswerFilter): Promise<{ hour: number; answers: number }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT extract(hour FROM a.answered_at AT TIME ZONE ${TZ})::int AS hour, count(*)::int AS answers
        FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${this.answerWhere(f)} GROUP BY 1 ORDER BY 1`)
    return rows.map((r) => ({ hour: n(r.hour), answers: n(r.answers) }))
  }

  /** Per subject (a null-subject row stands for free practice), answers desc then code. */
  async subjectTally(f: AnswerFilter): Promise<SubjectTally[]> {
    const rows = await this.q(Prisma.sql`
      SELECT sub.code, sub.name, count(*)::int AS answers, count(*) FILTER (WHERE a.is_correct)::int AS correct,
             count(DISTINCT a.user_id)::int AS students
        FROM practice_answers a JOIN users u ON u.id = a.user_id LEFT JOIN subjects sub ON sub.id = a.subject_id
       WHERE ${this.answerWhere(f)} GROUP BY sub.code, sub.name ORDER BY answers DESC, sub.code ASC NULLS LAST`)
    return rows.map((r) => ({ code: s(r.code), name: s(r.name), answers: n(r.answers), correct: n(r.correct), students: n(r.students) }))
  }

  /** The newest answers, newest first. */
  async latestAnswers(f: AnswerFilter, limit: number): Promise<FeedRow[]> {
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS user_id, u.name, u.school_id::text AS school_id, sc.name AS school_name, sub.code, sub.name AS subject_name,
             a.is_correct, a.answered_at
        FROM practice_answers a JOIN users u ON u.id = a.user_id LEFT JOIN schools sc ON sc.id = u.school_id
        LEFT JOIN subjects sub ON sub.id = a.subject_id
       WHERE ${this.answerWhere(f)} ORDER BY a.answered_at DESC, a.id DESC LIMIT ${Math.max(0, Math.trunc(limit))}`)
    return rows.map((r) => ({
      userId: String(r.user_id),
      studentName: String(r.name),
      schoolId: s(r.school_id),
      schoolName: s(r.school_name),
      subjectCode: s(r.code),
      subjectName: s(r.subject_name),
      isCorrect: Boolean(r.is_correct),
      answeredAt: r.answered_at as Date,
    }))
  }

  /** Answers of the students grouped by (student, subject): the "today" drill rows. `lastAt` = newest answer of the pair. */
  async pairTally(f: AnswerFilter): Promise<{ userId: string; name: string; subjectCode: string | null; subjectName: string | null; answers: number; correct: number; lastAt: Date }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS user_id, u.name, sub.code, sub.name AS subject_name, count(*)::int AS answers,
             count(*) FILTER (WHERE a.is_correct)::int AS correct, max(a.answered_at) AS last_at
        FROM practice_answers a JOIN users u ON u.id = a.user_id LEFT JOIN subjects sub ON sub.id = a.subject_id
       WHERE ${this.answerWhere(f)} GROUP BY u.id, u.name, sub.code, sub.name ORDER BY last_at DESC, u.id ASC`)
    return rows.map((r) => ({ userId: String(r.user_id), name: String(r.name), subjectCode: s(r.code), subjectName: s(r.subject_name), answers: n(r.answers), correct: n(r.correct), lastAt: r.last_at as Date }))
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Sessions (practice_sessions, completed only)
  // ------------------------------------------------------------------------------------------------------------------

  private sessionSelect = Prisma.sql`
    SELECT ps.id::text AS id, ps.user_id::text AS user_id, ps.mode, ps.subject_id::text AS subject_id, sub.code, sub.name AS subject_name,
           ch.name AS chapter_name, ps.difficulty, ps.question_count, ps.correct_count, ps.time_spent_sec, ps.mission_id::text AS mission_id,
           ps.started_at, ps.completed_at
      FROM practice_sessions ps LEFT JOIN subjects sub ON sub.id = ps.subject_id LEFT JOIN chapters ch ON ch.id = ps.chapter_id`

  private toSession(r: Row): SessionRow {
    return {
      id: String(r.id),
      userId: String(r.user_id),
      mode: String(r.mode),
      subjectId: s(r.subject_id),
      subjectCode: s(r.code),
      subjectName: s(r.subject_name),
      chapterName: s(r.chapter_name),
      difficulty: r.difficulty === null || r.difficulty === undefined ? null : n(r.difficulty),
      questionCount: n(r.question_count),
      correctCount: n(r.correct_count),
      timeSpentSec: n(r.time_spent_sec),
      missionId: s(r.mission_id),
      startedAt: r.started_at as Date,
      completedAt: r.completed_at as Date,
    }
  }

  /** Completed, non-test sessions (all modes). `to` is exclusive. Default order oldest first. */
  async completedSessions(f: SessionFilter): Promise<SessionRow[]> {
    const c: Prisma.Sql[] = [Prisma.sql`ps.status = 'completed'`, Prisma.sql`ps.is_test = false`, Prisma.sql`ps.completed_at IS NOT NULL`]
    if (f.userId !== undefined) {
      const id = bigintOrNull(f.userId)
      c.push(id === null ? Prisma.sql`false` : Prisma.sql`ps.user_id = ${id}`)
    }
    if (f.studentIds) c.push(Prisma.sql`ps.user_id = ANY(${ids(f.studentIds)}::bigint[])`)
    if (f.from) c.push(Prisma.sql`ps.completed_at >= ${f.from}`)
    if (f.to) c.push(Prisma.sql`ps.completed_at < ${f.to}`)
    if (f.subjectCode !== undefined) c.push(f.subjectCode === 'UMUM' ? Prisma.sql`ps.subject_id IS NULL` : Prisma.sql`sub.code = ${f.subjectCode}`)
    const order = f.newestFirst ? Prisma.sql`ps.completed_at DESC, ps.id DESC` : Prisma.sql`ps.completed_at ASC, ps.id ASC`
    const limit = f.limit === undefined ? Prisma.empty : Prisma.sql`LIMIT ${Math.max(0, Math.trunc(f.limit))}`
    const rows = await this.q(Prisma.sql`${this.sessionSelect} WHERE ${Prisma.join(c, ' AND ')} ORDER BY ${order} ${limit}`)
    return rows.map((r) => this.toSession(r))
  }

  /** One completed, non-test session by id (any owner); null for an unknown, malformed, running or test session. */
  async completedSession(sessionId: string): Promise<SessionRow | null> {
    if (!UUID.test(sessionId)) return null
    const rows = await this.q(Prisma.sql`${this.sessionSelect} WHERE ps.id = ${sessionId}::uuid AND ps.status = 'completed' AND ps.is_test = false AND ps.completed_at IS NOT NULL`)
    return rows[0] ? this.toSession(rows[0]) : null
  }

  /** The served questions of a session in order, with the version served (for the session detail). */
  async sessionQuestions(sessionId: string): Promise<{ questionId: string; versionNo: number; position: number }[]> {
    if (!UUID.test(sessionId)) return []
    const rows = await this.q(Prisma.sql`
      SELECT question_id::text AS question_id, question_version_no, position FROM practice_session_questions
       WHERE session_id = ${sessionId}::uuid AND is_test = false ORDER BY position`)
    return rows.map((r) => ({ questionId: String(r.question_id), versionNo: n(r.question_version_no), position: n(r.position) }))
  }

  /** The answers of a session in answer order (text of the question comes from QuestionsRepository). */
  async sessionAnswers(sessionId: string): Promise<{ questionId: string | null; selectedLabel: string | null; isCorrect: boolean; answeredAt: Date }[]> {
    if (!UUID.test(sessionId)) return []
    const rows = await this.q(Prisma.sql`
      SELECT question_id::text AS question_id, selected_label, is_correct, answered_at FROM practice_answers
       WHERE session_id = ${sessionId}::uuid AND is_test = false ORDER BY answered_at ASC, id ASC`)
    return rows.map((r) => ({ questionId: s(r.question_id), selectedLabel: s(r.selected_label), isCorrect: Boolean(r.is_correct), answeredAt: r.answered_at as Date }))
  }

  /** Completed non-test sessions of the students' answers in the window: counts, summed seconds and mission sessions. */
  async sessionTally(f: { from: Date; to: Date; schoolId?: string; studentIds?: string[] }): Promise<{ completed: number; seconds: number; missions: number }> {
    const c: Prisma.Sql[] = [
      Prisma.sql`ps.status = 'completed'`,
      Prisma.sql`ps.is_test = false`,
      Prisma.sql`ps.completed_at >= ${f.from}`,
      Prisma.sql`ps.completed_at <= ${f.to}`,
      Prisma.sql`u.is_active`,
      Prisma.sql`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')`,
    ]
    if (f.schoolId !== undefined) {
      const sid = bigintOrNull(f.schoolId)
      c.push(sid === null ? Prisma.sql`false` : Prisma.sql`u.school_id = ${sid}`)
    }
    if (f.studentIds) c.push(Prisma.sql`ps.user_id = ANY(${ids(f.studentIds)}::bigint[])`)
    const [r] = await this.q(Prisma.sql`
      SELECT count(*)::int AS completed, coalesce(sum(ps.time_spent_sec), 0)::int AS seconds, count(*) FILTER (WHERE ps.mission_id IS NOT NULL)::int AS missions
        FROM practice_sessions ps JOIN users u ON u.id = ps.user_id WHERE ${Prisma.join(c, ' AND ')}`)
    return { completed: n(r?.completed), seconds: n(r?.seconds), missions: n(r?.missions) }
  }

  // ------------------------------------------------------------------------------------------------------------------
  // People and schools
  // ------------------------------------------------------------------------------------------------------------------

  async userBrief(id: string): Promise<UserBrief | null> {
    const key = bigintOrNull(id)
    if (key === null) return null
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS id, u.name, u.school_id::text AS school_id, u.is_active,
             coalesce((SELECT array_agg(ur.role ORDER BY ur.role) FROM user_roles ur WHERE ur.user_id = u.id), '{}') AS roles
        FROM users u WHERE u.id = ${key}`)
    const r = rows[0]
    return r ? { id: String(r.id), name: String(r.name), schoolId: s(r.school_id), isActive: Boolean(r.is_active), roles: (r.roles as string[]) ?? [] } : null
  }

  async schoolRefs(schoolIds: string[]): Promise<Map<string, Ref>> {
    const rows = await this.q(Prisma.sql`SELECT id::text AS id, name FROM schools WHERE id = ANY(${ids(schoolIds)}::bigint[])`)
    return new Map(rows.map((r) => [String(r.id), { id: String(r.id), name: String(r.name) }]))
  }

  async schoolRef(schoolId: string): Promise<Ref | null> {
    return (await this.schoolRefs([schoolId])).get(schoolId) ?? null
  }

  /** Active student users; of one school, or the platform when `schoolId` is omitted. */
  async studentCount(opts: { schoolId?: string; includeInactive?: boolean } = {}): Promise<number> {
    const c: Prisma.Sql[] = [Prisma.sql`EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')`]
    if (!opts.includeInactive) c.push(Prisma.sql`u.is_active`)
    if (opts.schoolId !== undefined) {
      const sid = bigintOrNull(opts.schoolId)
      c.push(sid === null ? Prisma.sql`false` : Prisma.sql`u.school_id = ${sid}`)
    }
    const [r] = await this.q(Prisma.sql`SELECT count(*)::int AS c FROM users u WHERE ${Prisma.join(c, ' AND ')}`)
    return n(r?.c)
  }

  /** Students of a school (users.school_id), by name then id. */
  async studentsOfSchool(schoolId: string, opts: { includeInactive?: boolean } = {}): Promise<{ id: string; name: string; isActive: boolean }[]> {
    const sid = bigintOrNull(schoolId)
    if (sid === null) return []
    const active = opts.includeInactive ? Prisma.empty : Prisma.sql`AND u.is_active`
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS id, u.name, u.is_active FROM users u
       WHERE u.school_id = ${sid} AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student') ${active}
       ORDER BY u.name ASC, u.id ASC`)
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), isActive: Boolean(r.is_active) }))
  }

  /** Names of any users (missing ids are absent). */
  async userNames(userIds: string[]): Promise<Map<string, string>> {
    const rows = await this.q(Prisma.sql`SELECT id::text AS id, name FROM users WHERE id = ANY(${ids(userIds)}::bigint[])`)
    return new Map(rows.map((r) => [String(r.id), String(r.name)]))
  }

  /** Teachers of a school (role teacher, users.school_id), by name then id, with the profile subject. */
  async teachersOfSchool(schoolId: string): Promise<TeacherRow[]> {
    const sid = bigintOrNull(schoolId)
    if (sid === null) return []
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS id, u.name, u.is_active, tp.subject FROM users u LEFT JOIN teacher_profiles tp ON tp.user_id = u.id
       WHERE u.school_id = ${sid} AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'teacher')
       ORDER BY u.name ASC, u.id ASC`)
    return rows.map((r) => ({ id: String(r.id), name: String(r.name), isActive: Boolean(r.is_active), subject: s(r.subject)?.trim() || null }))
  }

  /** Schools with a subscription holding `onDate` (status active or grace); one school, or all. */
  async subscribedSchoolCount(onDate: Date, schoolId?: string): Promise<number> {
    const c: Prisma.Sql[] = [Prisma.sql`ss.status IN ('active', 'grace')`, Prisma.sql`ss.starts_on <= ${onDate}::date`, Prisma.sql`ss.ends_on >= ${onDate}::date`]
    if (schoolId !== undefined) {
      const sid = bigintOrNull(schoolId)
      c.push(sid === null ? Prisma.sql`false` : Prisma.sql`ss.school_id = ${sid}`)
    }
    const [r] = await this.q(Prisma.sql`SELECT count(DISTINCT ss.school_id)::int AS c FROM school_subscriptions ss WHERE ${Prisma.join(c, ' AND ')}`)
    return n(r?.c)
  }

  /** Schools that have at least one student (platform "total schools" of the daily board). */
  async schoolsWithStudents(): Promise<number> {
    const [r] = await this.q(Prisma.sql`
      SELECT count(DISTINCT u.school_id)::int AS c FROM users u
       WHERE u.school_id IS NOT NULL AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')`)
    return n(r?.c)
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Logins
  // ------------------------------------------------------------------------------------------------------------------

  /** Logins per role in the window (`users.last_login_at`); a multi-role user counts once per role. `schoolId` limits to one school. */
  async loginCountsByRole(window: { from: Date; to: Date }, schoolId?: string): Promise<{ role: string; count: number }[]> {
    const school = this.schoolCond('u', schoolId)
    const rows = await this.q(Prisma.sql`
      SELECT ur.role, count(*)::int AS c FROM users u JOIN user_roles ur ON ur.user_id = u.id
       WHERE u.last_login_at >= ${window.from} AND u.last_login_at <= ${window.to} ${school} GROUP BY ur.role`)
    return rows.map((r) => ({ role: String(r.role), count: n(r.c) }))
  }

  /** Distinct users who logged in inside the window. */
  async loginUserCount(window: { from: Date; to: Date }, schoolId?: string): Promise<number> {
    const school = this.schoolCond('u', schoolId)
    const [r] = await this.q(Prisma.sql`SELECT count(*)::int AS c FROM users u WHERE u.last_login_at >= ${window.from} AND u.last_login_at <= ${window.to} ${school}`)
    return n(r?.c)
  }

  /** Newest logins in the window with the raw flags of the package chip. */
  async recentLogins(window: { from: Date; to: Date }, limit: number, schoolId?: string): Promise<LoginRow[]> {
    const school = this.schoolCond('u', schoolId)
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS id, u.name, u.school_id::text AS school_id, sc.name AS school_name, u.last_login_at, u.is_complimentary,
             coalesce((SELECT array_agg(ur.role ORDER BY ur.role) FROM user_roles ur WHERE ur.user_id = u.id), '{}') AS roles,
             EXISTS (SELECT 1 FROM user_packages up WHERE up.user_id = u.id) AS has_package,
             false AS has_pksk,
             EXISTS (SELECT 1 FROM school_subscriptions ss WHERE ss.school_id = u.school_id AND ss.status IN ('active', 'grace')
                      AND ss.starts_on <= ${window.to}::date AND ss.ends_on >= ${window.to}::date) AS school_subscribed
        FROM users u LEFT JOIN schools sc ON sc.id = u.school_id
       WHERE u.last_login_at >= ${window.from} AND u.last_login_at <= ${window.to} ${school}
       ORDER BY u.last_login_at DESC, u.id DESC LIMIT ${Math.max(0, Math.trunc(limit))}`)
    return rows.map((r) => ({
      userId: String(r.id),
      name: String(r.name),
      roles: (r.roles as string[]) ?? [],
      schoolId: s(r.school_id),
      schoolName: s(r.school_name),
      lastLoginAt: r.last_login_at as Date,
      isComplimentary: Boolean(r.is_complimentary),
      hasPackage: Boolean(r.has_package),
      hasPksk: Boolean(r.has_pksk),
      schoolSubscribed: Boolean(r.school_subscribed),
    }))
  }

  /** Users of ONE school who logged in inside the window, newest first (school drill `logins`). */
  async schoolLogins(schoolId: string, window: { from: Date; to: Date }): Promise<LoginRow[]> {
    return this.recentLogins(window, 1000, schoolId)
  }

  private schoolCond(alias: string, schoolId?: string): Prisma.Sql {
    if (schoolId === undefined) return Prisma.empty
    const sid = bigintOrNull(schoolId)
    return sid === null ? Prisma.sql`AND false` : Prisma.sql`AND ${Prisma.raw(alias)}.school_id = ${sid}`
  }

  // ------------------------------------------------------------------------------------------------------------------
  // Classes and enrolments (read only; BE-17 owns them)
  // ------------------------------------------------------------------------------------------------------------------

  private classSelect = Prisma.sql`
    SELECT c.id::text AS id, c.name, c.kind, c.teacher_id::text AS owner_id, o.name AS owner_name, c.school_id::text AS school_id,
           coalesce(c.school_id, o.school_id)::text AS effective_school_id, c.is_active, el.grade
      FROM classrooms c LEFT JOIN users o ON o.id = c.teacher_id LEFT JOIN education_levels el ON el.id = c.education_level_id`

  private toClass(r: Row): ClassRow {
    return {
      id: String(r.id),
      name: String(r.name),
      kind: String(r.kind),
      ownerId: s(r.owner_id),
      ownerName: s(r.owner_name),
      schoolId: s(r.school_id),
      effectiveSchoolId: s(r.effective_school_id),
      isActive: Boolean(r.is_active),
      educationGrade: r.grade === null || r.grade === undefined ? null : n(r.grade),
    }
  }

  async classById(id: string): Promise<ClassRow | null> {
    const key = bigintOrNull(id)
    if (key === null) return null
    const rows = await this.q(Prisma.sql`${this.classSelect} WHERE c.id = ${key}`)
    return rows[0] ? this.toClass(rows[0]) : null
  }

  /** Classes owned by a teacher, by id. `activeClassroomsOnly` = `kind = 'classroom'` AND active. */
  async classesOfOwner(ownerId: string, opts: { activeClassroomsOnly?: boolean } = {}): Promise<ClassRow[]> {
    const key = bigintOrNull(ownerId)
    if (key === null) return []
    const only = opts.activeClassroomsOnly ? Prisma.sql`AND c.is_active AND c.kind = 'classroom'` : Prisma.empty
    const rows = await this.q(Prisma.sql`${this.classSelect} WHERE c.teacher_id = ${key} ${only} ORDER BY c.id ASC`)
    return rows.map((r) => this.toClass(r))
  }

  /** Classes whose EFFECTIVE school (class school, else owner school) is `schoolId`, by id. */
  async classesOfSchool(schoolId: string, opts: { activeClassroomsOnly?: boolean } = {}): Promise<ClassRow[]> {
    const key = bigintOrNull(schoolId)
    if (key === null) return []
    const only = opts.activeClassroomsOnly ? Prisma.sql`AND c.is_active AND c.kind = 'classroom'` : Prisma.empty
    const rows = await this.q(Prisma.sql`${this.classSelect} WHERE coalesce(c.school_id, o.school_id) = ${key} ${only} ORDER BY c.id ASC`)
    return rows.map((r) => this.toClass(r))
  }

  /** Effective schools of a teacher's active classrooms (the schools a teacher may open). */
  async teacherSchoolIds(teacherId: string): Promise<string[]> {
    const classes = await this.classesOfOwner(teacherId, { activeClassroomsOnly: true })
    return [...new Set(classes.map((c) => c.effectiveSchoolId).filter((v): v is string => v !== null))].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
  }

  /** Active, non-test enrolments of the classes: (class, student) pairs of student users, with `joinedAt`. */
  async classMembers(classIds: string[]): Promise<{ classId: string; studentId: string; joinedAt: Date }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT e.classroom_id::text AS class_id, e.student_id::text AS student_id, e.joined_at FROM enrolments e
       WHERE e.classroom_id = ANY(${ids(classIds)}::bigint[]) AND e.status = 'active' AND e.is_test = false
       ORDER BY e.classroom_id, e.student_id`)
    return rows.map((r) => ({ classId: String(r.class_id), studentId: String(r.student_id), joinedAt: r.joined_at as Date }))
  }

  /** Active classrooms (active class, kind classroom) a student is actively enrolled in (non-test), by join time then class id. */
  async classesOfStudent(studentId: string): Promise<(ClassRow & { joinedAt: Date })[]> {
    const key = bigintOrNull(studentId)
    if (key === null) return []
    const rows = await this.q(Prisma.sql`
      SELECT c.id::text AS id, c.name, c.kind, c.teacher_id::text AS owner_id, o.name AS owner_name, c.school_id::text AS school_id,
             coalesce(c.school_id, o.school_id)::text AS effective_school_id, c.is_active, el.grade, e.joined_at
        FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id LEFT JOIN users o ON o.id = c.teacher_id
        LEFT JOIN education_levels el ON el.id = c.education_level_id
       WHERE e.student_id = ${key} AND e.status = 'active' AND e.is_test = false AND c.is_active AND c.kind = 'classroom'
       ORDER BY e.joined_at ASC, c.id ASC`)
    return rows.map((r) => ({ ...this.toClass(r), joinedAt: r.joined_at as Date }))
  }

  /** Student ids a teacher may open: active non-test members of the teacher's active classrooms. */
  async teacherStudentIds(teacherId: string): Promise<string[]> {
    const key = bigintOrNull(teacherId)
    if (key === null) return []
    const rows = await this.q(Prisma.sql`
      SELECT DISTINCT e.student_id::text AS id, e.student_id AS sort_id FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id
       WHERE c.teacher_id = ${key} AND c.is_active AND c.kind = 'classroom' AND e.status = 'active' AND e.is_test = false
       ORDER BY e.student_id`)
    return rows.map((r) => String(r.id))
  }

  /** True when the student is an active, non-test member of an active classroom the teacher owns. */
  async isTeacherStudent(teacherId: string, studentId: string): Promise<boolean> {
    const t = bigintOrNull(teacherId)
    const st = bigintOrNull(studentId)
    if (t === null || st === null) return false
    const [r] = await this.q(Prisma.sql`
      SELECT 1 AS ok FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id
       WHERE c.teacher_id = ${t} AND e.student_id = ${st} AND c.is_active AND c.kind = 'classroom' AND e.status = 'active' AND e.is_test = false LIMIT 1`)
    return r !== undefined
  }

  /** Active teachers of classes with an active member who answered: used by the board `schools[].activeTeachers`. Distinct owner ids per school. */
  async activeTeacherCounts(studentIds: string[]): Promise<Map<string, number>> {
    const rows = await this.q(Prisma.sql`
      SELECT coalesce(c.school_id, o.school_id)::text AS school_id, count(DISTINCT c.teacher_id)::int AS teachers
        FROM enrolments e JOIN classrooms c ON c.id = e.classroom_id JOIN users o ON o.id = c.teacher_id
       WHERE e.student_id = ANY(${ids(studentIds)}::bigint[]) AND e.status = 'active' AND e.is_test = false AND c.is_active AND c.kind = 'classroom'
         AND coalesce(c.school_id, o.school_id) IS NOT NULL GROUP BY 1`)
    return new Map(rows.map((r) => [String(r.school_id), n(r.teachers)]))
  }
}
