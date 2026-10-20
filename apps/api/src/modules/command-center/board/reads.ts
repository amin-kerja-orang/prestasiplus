/**
 * Read-only SQL of the board that the shared repository does not offer (BE-22 board slice). Same population rules as
 * `CommandCenterRepository`: answers with `is_test = false` of ACTIVE users holding the `student` role; every input is a bound parameter.
 */
import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'

type Row = Record<string, unknown>
const n = (v: unknown): number => Number(v ?? 0)

export interface AnswerSpan {
  from?: Date
  /** Inclusive. */
  to: Date
  schoolId?: string
}

export interface LiveTallies {
  answers: number
  correct: number
  students: number
  today: number
  week: number
  lastWeek: number
  /** Distinct students with an answer since `d30From`. */
  active30d: number
}

export interface TopUser {
  userId: string
  name: string
  schoolId: string | null
  schoolName: string | null
  answers: number
  correct: number
}

export interface SchoolActivityRow {
  schoolId: string
  schoolName: string
  pupils: number
  answers: number
  correct: number
  lastAt: Date
}

export interface TeacherDrillRow {
  teacherId: string
  name: string
  students: number
  answers: number
  correct: number
  lastAt: Date | null
}

const POPULATION = Prisma.sql`a.is_test = false AND u.is_active AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')`

function schoolCond(schoolId: string | undefined): Prisma.Sql {
  if (schoolId === undefined) return Prisma.empty
  try {
    return Prisma.sql`AND u.school_id = ${idFromString(schoolId)}`
  } catch {
    return Prisma.sql`AND false`
  }
}

function span(s: AnswerSpan): Prisma.Sql {
  const from = s.from ? Prisma.sql`AND a.answered_at >= ${s.from}` : Prisma.empty
  return Prisma.sql`${POPULATION} AND a.answered_at <= ${s.to} ${from} ${schoolCond(s.schoolId)}`
}

@Injectable()
export class BoardReads {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private q(query: Prisma.Sql): Promise<Row[]> {
    return this.prisma.client.$queryRaw<Row[]>(query)
  }

  /**
   * One pass over the answers up to `now`: totals and the windows of the live board. Answers are grouped per user first (a few
   * thousand groups) and only then joined to the user filter, which avoids a sort of every answer row for `count(DISTINCT ...)`.
   */
  async liveTallies(w: { now: Date; schoolId?: string; todayFrom: Date; weekFrom: Date; lastWeekFrom: Date; d30From: Date }): Promise<LiveTallies> {
    const [r] = await this.q(Prisma.sql`
      SELECT coalesce(sum(p.answers), 0)::int AS answers, coalesce(sum(p.correct), 0)::int AS correct, count(*)::int AS students,
             coalesce(sum(p.today), 0)::int AS today, coalesce(sum(p.week), 0)::int AS week, coalesce(sum(p.last_week), 0)::int AS last_week,
             count(*) FILTER (WHERE p.d30 > 0)::int AS active30d
        FROM (SELECT a.user_id, count(*) AS answers, count(*) FILTER (WHERE a.is_correct) AS correct,
                     count(*) FILTER (WHERE a.answered_at >= ${w.todayFrom}) AS today,
                     count(*) FILTER (WHERE a.answered_at >= ${w.weekFrom}) AS week,
                     count(*) FILTER (WHERE a.answered_at >= ${w.lastWeekFrom} AND a.answered_at < ${w.weekFrom}) AS last_week,
                     count(*) FILTER (WHERE a.answered_at >= ${w.d30From}) AS d30
                FROM practice_answers a WHERE a.is_test = false AND a.answered_at <= ${w.now} GROUP BY a.user_id) p
        JOIN users u ON u.id = p.user_id
       WHERE u.is_active AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student') ${schoolCond(w.schoolId)}`)
    return {
      answers: n(r?.answers),
      correct: n(r?.correct),
      students: n(r?.students),
      today: n(r?.today),
      week: n(r?.week),
      lastWeek: n(r?.last_week),
      active30d: n(r?.active30d),
    }
  }

  /** Platform top schools: answering students desc, answers desc, id asc (students without a school are skipped). */
  async topSchools(to: Date, limit: number): Promise<{ schoolId: string; schoolName: string; students: number; answers: number }[]> {
    const rows = await this.q(Prisma.sql`
      SELECT sc.id::text AS school_id, sc.name, count(*)::int AS students, sum(p.answers)::int AS answers
        FROM (SELECT a.user_id, count(*) AS answers FROM practice_answers a WHERE a.is_test = false AND a.answered_at <= ${to} GROUP BY a.user_id) p
        JOIN users u ON u.id = p.user_id JOIN schools sc ON sc.id = u.school_id
       WHERE u.is_active AND EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = u.id AND ur.role = 'student')
       GROUP BY sc.id, sc.name ORDER BY students DESC, answers DESC, sc.id ASC LIMIT ${Math.max(0, Math.trunc(limit))}`)
    return rows.map((r) => ({ schoolId: String(r.school_id), schoolName: String(r.name), students: n(r.students), answers: n(r.answers) }))
  }

  /** Top students: answers desc, accuracy desc, id asc. */
  async topUsers(s: AnswerSpan, limit: number): Promise<TopUser[]> {
    const rows = await this.q(Prisma.sql`
      SELECT u.id::text AS user_id, u.name, u.school_id::text AS school_id, sc.name AS school_name,
             count(*)::int AS answers, count(*) FILTER (WHERE a.is_correct)::int AS correct
        FROM practice_answers a JOIN users u ON u.id = a.user_id LEFT JOIN schools sc ON sc.id = u.school_id
       WHERE ${span(s)}
       GROUP BY u.id, u.name, u.school_id, sc.name
       ORDER BY answers DESC, (count(*) FILTER (WHERE a.is_correct))::float8 / count(*) DESC, u.id ASC
       LIMIT ${Math.max(0, Math.trunc(limit))}`)
    return rows.map((r) => ({
      userId: String(r.user_id),
      name: String(r.name),
      schoolId: r.school_id === null ? null : String(r.school_id),
      schoolName: r.school_name === null ? null : String(r.school_name),
      answers: n(r.answers),
      correct: n(r.correct),
    }))
  }

  /** Per school with answering students (platform daily board); no limit. */
  async schoolActivity(s: AnswerSpan): Promise<SchoolActivityRow[]> {
    const rows = await this.q(Prisma.sql`
      SELECT sc.id::text AS school_id, sc.name, count(DISTINCT a.user_id)::int AS pupils, count(*)::int AS answers,
             count(*) FILTER (WHERE a.is_correct)::int AS correct, max(a.answered_at) AS last_at
        FROM practice_answers a JOIN users u ON u.id = a.user_id JOIN schools sc ON sc.id = u.school_id
       WHERE ${span(s)} GROUP BY sc.id, sc.name`)
    return rows.map((r) => ({
      schoolId: String(r.school_id),
      schoolName: String(r.name),
      pupils: n(r.pupils),
      answers: n(r.answers),
      correct: n(r.correct),
      lastAt: r.last_at as Date,
    }))
  }

  /** Per school: users whose last login falls in the window, and the latest of those logins. */
  async loginsBySchool(w: { from: Date; to: Date }): Promise<Map<string, { count: number; lastAt: Date }>> {
    const rows = await this.q(Prisma.sql`
      SELECT u.school_id::text AS school_id, count(*)::int AS c, max(u.last_login_at) AS last_at FROM users u
       WHERE u.school_id IS NOT NULL AND u.last_login_at >= ${w.from} AND u.last_login_at <= ${w.to} GROUP BY u.school_id`)
    return new Map(rows.map((r) => [String(r.school_id), { count: n(r.c), lastAt: r.last_at as Date }]))
  }

  /**
   * Distinct owners of an active classroom with an active (non-test) enrolment of an answering pupil, per school OF THE PUPIL
   * (mock `teacherPupils`).
   */
  async activeTeachersBySchool(s: AnswerSpan): Promise<Map<string, number>> {
    const rows = await this.q(Prisma.sql`
      SELECT p.school_id::text AS school_id, count(DISTINCT c.teacher_id)::int AS teachers
        FROM (SELECT DISTINCT a.user_id, u.school_id FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${span(s)}) p
        JOIN enrolments e ON e.student_id = p.user_id AND e.status = 'active' AND e.is_test = false
        JOIN classrooms c ON c.id = e.classroom_id AND c.is_active AND c.kind = 'classroom' AND c.teacher_id IS NOT NULL
       WHERE p.school_id IS NOT NULL GROUP BY p.school_id`)
    return new Map(rows.map((r) => [String(r.school_id), n(r.teachers)]))
  }

  /**
   * School drill teachers: class owners of answering pupils of the school with the pupils' totals (a pupil of two owners counts
   * for both). At most `limit` rows, the ones with the most pupils (the service sorts the same way).
   */
  async teacherDrill(s: AnswerSpan, limit: number): Promise<TeacherDrillRow[]> {
    const rows = await this.q(Prisma.sql`
      SELECT c.teacher_id::text AS teacher_id, o.name, count(*)::int AS students, sum(p.answers)::int AS answers, sum(p.correct)::int AS correct, max(p.last_at) AS last_at
        FROM (SELECT a.user_id, count(*) AS answers, count(*) FILTER (WHERE a.is_correct) AS correct, max(a.answered_at) AS last_at
                FROM practice_answers a JOIN users u ON u.id = a.user_id WHERE ${span(s)} GROUP BY a.user_id) p
        JOIN (SELECT DISTINCT e.student_id, c2.teacher_id FROM enrolments e JOIN classrooms c2 ON c2.id = e.classroom_id
               WHERE e.status = 'active' AND e.is_test = false AND c2.is_active AND c2.kind = 'classroom' AND c2.teacher_id IS NOT NULL) c
          ON c.student_id = p.user_id
        JOIN users o ON o.id = c.teacher_id
       GROUP BY c.teacher_id, o.name
       ORDER BY students DESC, o.name ASC, c.teacher_id ASC
       LIMIT ${Math.max(0, Math.trunc(limit))}`)
    return rows.map((r) => ({
      teacherId: String(r.teacher_id),
      name: String(r.name),
      students: n(r.students),
      answers: n(r.answers),
      correct: n(r.correct),
      lastAt: (r.last_at as Date | null) ?? null,
    }))
  }
}
