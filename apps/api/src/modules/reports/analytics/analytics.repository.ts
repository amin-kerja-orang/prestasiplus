import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../../db/generated/client'
import { idFromString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { M1_START_MS } from './domain/rules'

/**
 * The one doorway to `monitoring_flags` and the read-only aggregates behind the M11 reports. Every query is
 * parameterised. The aggregates read `users`, `user_roles`, `schools`, `school_subscriptions`, `practice_sessions`,
 * `practice_answers` and the question bank directly (a deliberate, read-only exception to "users only through
 * UsersRepository", recorded in docs/architecture/v2-backend-deviations.md): a per-school roll-up of the whole T4/T5
 * population cannot be expressed through the per-user repository API. Rows written under Mod Pelajar (`is_test`,
 * on sessions and answers) are excluded from every figure. Classes come from `ClassesRepository`, not from here.
 *
 * Ids on the wire are decimal strings; a school scope is a list of ids (`null` = every school, `[]` = none).
 */

const KL = 'Asia/Kuala_Lumpur'

const toIds = (ids: readonly string[]): bigint[] => [...new Set(ids)].flatMap((i) => (isIdString(i) ? [idFromString(i)] : []))

export interface SchoolFact {
  id: string
  name: string
  code: string | null
  state: string
}

export interface UserFact {
  id: string
  name: string
  email: string
  schoolId: string | null
  grade: number | null
  isActive: boolean
  isStudent: boolean
  isTeacher: boolean
  lastLoginAt: Date | null
  createdAt: Date
}

export interface PupilLine {
  id: string
  name: string
  email: string
  grade: number | null
  lastLoginAt: Date | null
}

export interface PupilStat {
  answers: number
  correct: number
  last: Date | null
}

export interface TeacherLine {
  id: string
  name: string
  email: string
  lastLoginAt: Date | null
  createdAt: Date
}

export interface SubscriptionFact {
  status: string
  endsOn: string
}

export interface AnswerFact {
  questionId: string | null
  versionNo: number | null
  subjectId: string | null
  chapterId: string | null
  topicId: string | null
  difficulty: number | null
  selectedLabel: string | null
  isCorrect: boolean
  answeredAt: Date
  id: string
}

export interface QuestionFact {
  questionId: string
  versionNo: number
  versionId: string
  stem: string
  explanation: string | null
  chapterId: string | null
  topicId: string | null
  subjectId: string | null
  difficulty: number | null
  source: string | null
  options: { label: string; text: string }[]
  correctLabel: string | null
}

export interface ItemTally {
  questionId: string
  attempts: number
  correct: number
  subjectId: string | null
}

export interface SessionDayRow {
  userId: string
  mode: string
  day: string
  sessions: number
  correct: number
  questions: number
}

/** The answer log without Mod Pelajar rows and without unfinished sessions: a (practice_answers a) joined to its session s. */
const CLEAN_ANSWERS = Prisma.sql`practice_answers a LEFT JOIN practice_sessions s ON s.id = a.session_id`
const CLEAN_WHERE = Prisma.sql`NOT a.is_test AND (s.id IS NULL OR (s.status = 'completed' AND NOT s.is_test))`

@Injectable()
export class AnalyticsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  private clause(ids: readonly string[] | null, column: Prisma.Sql): Prisma.Sql {
    return ids === null ? Prisma.empty : Prisma.sql`AND ${column} = ANY(${toIds(ids)}::bigint[])`
  }

  /** The T4/T5 segment (BR-M11-01): active pupils of grade 10 or 11 with a school, in scope. */
  private segment(schoolIds: readonly string[] | null): Prisma.Sql {
    return Prisma.sql`SELECT u.id AS user_id, u.school_id
      FROM users u
      WHERE u.is_active AND u.grade IN (10, 11) AND u.school_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student')
        ${this.clause(schoolIds, Prisma.sql`u.school_id`)}`
  }

  // --- schools -------------------------------------------------------------------------------------------------

  async schools(ids: readonly string[] | null): Promise<SchoolFact[]> {
    if (ids !== null && ids.length === 0) return []
    return this.db.$queryRaw<SchoolFact[]>`
      SELECT s.id::text AS id, s.name, s.code, coalesce(s.state, '') AS state FROM schools s
      WHERE (s.type IS NULL OR s.type NOT IN ('SK', 'SJK(C)', 'SJK(T)')) ${this.clause(ids, Prisma.sql`s.id`)}`
  }

  async school(id: string): Promise<SchoolFact | null> {
    if (!isIdString(id)) return null
    return (await this.schools([id]))[0] ?? null
  }

  /** Schools with at least one user of any role (BR-M11-08 "Jumlah Sekolah"). */
  async schoolsWithUsers(ids: readonly string[] | null): Promise<string[]> {
    if (ids !== null && ids.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT s.id::text AS id FROM schools s
      WHERE (s.type IS NULL OR s.type NOT IN ('SK', 'SJK(C)', 'SJK(T)')) AND EXISTS (SELECT 1 FROM users u WHERE u.school_id = s.id) ${this.clause(ids, Prisma.sql`s.id`)}`
    return rows.map((r) => r.id)
  }

  /** Registered T4/T5 pupils per school (Q-M11-T45). */
  async registeredBySchool(ids: readonly string[] | null): Promise<Map<string, number>> {
    if (ids !== null && ids.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ school_id: string; n: number }[]>`
      WITH seg AS (${this.segment(ids)}) SELECT school_id::text AS school_id, count(*)::int AS n FROM seg GROUP BY school_id`
    return new Map(rows.map((r) => [r.school_id, r.n]))
  }

  /** Teachers and teachers who logged in per school (Q-M11-TEACHERS). */
  async teachersBySchool(ids: readonly string[] | null): Promise<Map<string, { n: number; logged: number }>> {
    if (ids !== null && ids.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ school_id: string; n: number; logged: number }[]>`
      SELECT u.school_id::text AS school_id, count(*)::int AS n, count(*) FILTER (WHERE u.last_login_at IS NOT NULL)::int AS logged
      FROM users u
      WHERE u.is_active AND u.school_id IS NOT NULL
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'teacher')
        ${this.clause(ids, Prisma.sql`u.school_id`)}
      GROUP BY u.school_id`
    return new Map(rows.map((r) => [r.school_id, { n: r.n, logged: r.logged }]))
  }

  /** Answering pupils and answers per school since `from` (null = all time), over the T4/T5 segment (Q-ANS-SEG). */
  async engagement(ids: readonly string[] | null, from: Date | null): Promise<Map<string, { engaged: number; answers: number }>> {
    if (ids !== null && ids.length === 0) return new Map()
    const since = from === null ? Prisma.empty : Prisma.sql`AND a.answered_at >= ${from}`
    const rows = await this.db.$queryRaw<{ school_id: string; engaged: number; answers: number }[]>`
      WITH seg AS (${this.segment(ids)})
      SELECT seg.school_id::text AS school_id, count(DISTINCT a.user_id)::int AS engaged, count(*)::int AS answers
      FROM ${CLEAN_ANSWERS} JOIN seg ON seg.user_id = a.user_id
      WHERE ${CLEAN_WHERE} ${since}
      GROUP BY seg.school_id`
    return new Map(rows.map((r) => [r.school_id, { engaged: r.engaged, answers: r.answers }]))
  }

  /** Answers per school per Monday-based week since M1 (BR-M11-15): `school -> week -> n`. */
  async answersByWeek(ids: readonly string[] | null): Promise<Map<string, Map<number, number>>> {
    if (ids !== null && ids.length === 0) return new Map()
    const m1 = new Date(M1_START_MS)
    const rows = await this.db.$queryRaw<{ school_id: string; week: number; n: number }[]>`
      WITH seg AS (${this.segment(ids)})
      SELECT seg.school_id::text AS school_id,
        (floor(extract(epoch FROM (a.answered_at - ${m1}::timestamptz)) / 604800))::int + 1 AS week,
        count(*)::int AS n
      FROM ${CLEAN_ANSWERS} JOIN seg ON seg.user_id = a.user_id
      WHERE ${CLEAN_WHERE} AND a.answered_at >= ${m1}::timestamptz
      GROUP BY 1, 2`
    const out = new Map<string, Map<number, number>>()
    for (const r of rows) {
      const m = out.get(r.school_id) ?? new Map<number, number>()
      m.set(r.week, r.n)
      out.set(r.school_id, m)
    }
    return out
  }

  // --- school and teacher detail ----------------------------------------------------------------------------------------

  async pupilsOfSchool(schoolId: string): Promise<PupilLine[]> {
    if (!isIdString(schoolId)) return []
    const rows = await this.db.$queryRaw<{ id: string; name: string; email: string | null; grade: number | null; last_login_at: Date | null }[]>`
      SELECT u.id::text AS id, u.name, u.email, u.grade, u.last_login_at
      FROM (${this.segment([schoolId])}) seg JOIN users u ON u.id = seg.user_id
      ORDER BY u.id`
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email ?? '', grade: r.grade, lastLoginAt: r.last_login_at }))
  }

  async teachersOfSchool(schoolId: string): Promise<TeacherLine[]> {
    if (!isIdString(schoolId)) return []
    const rows = await this.db.$queryRaw<{ id: string; name: string; email: string | null; last_login_at: Date | null; created_at: Date }[]>`
      SELECT u.id::text AS id, u.name, u.email, u.last_login_at, u.created_at
      FROM users u
      WHERE u.is_active AND u.school_id = ${idFromString(schoolId)}
        AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'teacher')
      ORDER BY u.id`
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email ?? '', lastLoginAt: r.last_login_at, createdAt: r.created_at }))
  }

  /** The given teacher accounts (any status), id ascending. The caller picks the ids; nothing is filtered by school or activity here. */
  async teachersAmong(ids: readonly string[]): Promise<TeacherLine[]> {
    const keys = toIds(ids)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: string; name: string; email: string | null; last_login_at: Date | null; created_at: Date }[]>`
      SELECT u.id::text AS id, u.name, u.email, u.last_login_at, u.created_at
      FROM users u
      WHERE u.id = ANY(${keys}::bigint[]) AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'teacher')
      ORDER BY u.id`
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email ?? '', lastLoginAt: r.last_login_at, createdAt: r.created_at }))
  }

  /** Answers, correct answers and the latest answer per pupil, over the whole log (Q-ANS-USER). */
  async pupilStats(userIds: readonly string[]): Promise<Map<string, PupilStat>> {
    const ids = toIds(userIds)
    if (ids.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ user_id: string; answers: number; correct: number; last: Date }[]>`
      SELECT a.user_id::text AS user_id, count(*)::int AS answers, count(*) FILTER (WHERE a.is_correct)::int AS correct,
        max(a.answered_at) AS last
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.user_id = ANY(${ids}::bigint[])
      GROUP BY a.user_id`
    return new Map(rows.map((r) => [r.user_id, { answers: r.answers, correct: r.correct, last: r.last }]))
  }

  /** Flag level per pupil (DATA-M11-01). */
  async flagsOf(userIds: readonly string[]): Promise<Map<string, 'review' | 'excluded'>> {
    const ids = toIds(userIds)
    if (ids.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ user_id: string; level: string }[]>`
      SELECT user_id::text AS user_id, level FROM monitoring_flags WHERE user_id = ANY(${ids}::bigint[])`
    return new Map(rows.map((r) => [r.user_id, r.level as 'review' | 'excluded']))
  }

  /** The subscription with the latest end date (BR-M11-33). */
  async latestSubscription(schoolId: string): Promise<SubscriptionFact | null> {
    if (!isIdString(schoolId)) return null
    const rows = await this.db.$queryRaw<{ status: string; ends_on: string }[]>`
      SELECT status, to_char(ends_on, 'YYYY-MM-DD') AS ends_on FROM school_subscriptions
      WHERE school_id = ${idFromString(schoolId)} ORDER BY ends_on DESC, id DESC LIMIT 1`
    const r = rows[0]
    return r ? { status: r.status, endsOn: r.ends_on } : null
  }

  async user(id: string): Promise<UserFact | null> {
    if (!isIdString(id)) return null
    const rows = await this.db.$queryRaw<
      {
        id: string
        name: string
        email: string | null
        school_id: string | null
        grade: number | null
        is_active: boolean
        is_student: boolean
        is_teacher: boolean
        last_login_at: Date | null
        created_at: Date
      }[]
    >`
      SELECT u.id::text AS id, u.name, u.email, u.school_id::text AS school_id, u.grade, u.is_active,
        EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student') AS is_student,
        EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'teacher') AS is_teacher,
        u.last_login_at, u.created_at
      FROM users u WHERE u.id = ${idFromString(id)}`
    const r = rows[0]
    return r
      ? {
          id: r.id,
          name: r.name,
          email: r.email ?? '',
          schoolId: r.school_id,
          grade: r.grade,
          isActive: r.is_active,
          isStudent: r.is_student,
          isTeacher: r.is_teacher,
          lastLoginAt: r.last_login_at,
          createdAt: r.created_at,
        }
      : null
  }

  // --- pupil detail (S4) -------------------------------------------------------------------------------------------------

  async answersOf(userId: string): Promise<AnswerFact[]> {
    const rows = await this.db.$queryRaw<
      {
        id: string
        question_id: string | null
        question_version_no: number | null
        subject_id: string | null
        chapter_id: string | null
        topic_id: string | null
        difficulty: number | null
        selected_label: string | null
        is_correct: boolean
        answered_at: Date
      }[]
    >`
      SELECT a.id::text AS id, a.question_id::text AS question_id, a.question_version_no, a.subject_id::text AS subject_id,
        a.chapter_id::text AS chapter_id, a.topic_id::text AS topic_id, a.difficulty, a.selected_label, a.is_correct, a.answered_at
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.user_id = ${idFromString(userId)}
      ORDER BY a.answered_at, a.id`
    return rows.map((r) => ({
      id: r.id,
      questionId: r.question_id,
      versionNo: r.question_version_no,
      subjectId: r.subject_id,
      chapterId: r.chapter_id,
      topicId: r.topic_id,
      difficulty: r.difficulty,
      selectedLabel: r.selected_label,
      isCorrect: r.is_correct,
      answeredAt: r.answered_at,
    }))
  }

  /**
   * The question content as served: the answer's version when known, else the live version, else the latest.
   * Keyed `questionId:versionNo|` where an unknown version uses the key `questionId:`.
   */
  async questionFacts(pairs: readonly { questionId: string; versionNo: number | null }[]): Promise<Map<string, QuestionFact>> {
    const wanted = new Map<string, { q: bigint; v: number | null }>()
    for (const p of pairs) {
      if (!isIdString(p.questionId)) continue
      wanted.set(`${p.questionId}:${p.versionNo ?? ''}`, { q: idFromString(p.questionId), v: p.versionNo })
    }
    const out = new Map<string, QuestionFact>()
    if (wanted.size === 0) return out
    const list = [...wanted.values()]
    const versions = await this.db.$queryRaw<
      {
        want_version: number | null
        question_id: string
        version_id: string
        version_no: number
        stem_ms: string | null
        explanation_ms: string | null
        chapter_id: string | null
        topic_id: string | null
        subject_id: string | null
        difficulty_tp: number | null
        exam_type: string | null
        year: number | null
        set_label: string | null
      }[]
    >`
      WITH want AS (SELECT * FROM unnest(${list.map((w) => w.q)}::bigint[], ${list.map((w) => w.v ?? 0)}::int[]) AS w(question_id, version_no))
      SELECT nullif(w.version_no, 0) AS want_version, q.id::text AS question_id, v.id::text AS version_id, v.version_no, v.stem_ms, v.explanation_ms,
        v.chapter_id::text AS chapter_id, v.topic_id::text AS topic_id, v.subject_id::text AS subject_id, v.difficulty_tp,
        v.exam_type, v.year, v.set_label
      FROM want w
      JOIN questions q ON q.id = w.question_id
      JOIN LATERAL (
        SELECT * FROM question_versions v2 WHERE v2.question_id = q.id
        ORDER BY (v2.version_no = nullif(w.version_no, 0)) DESC NULLS LAST, (v2.version_no = q.live_version_no) DESC NULLS LAST, v2.version_no DESC
        LIMIT 1
      ) v ON true`
    if (versions.length === 0) return out
    const versionIds = versions.map((v) => idFromString(v.version_id))
    const parts = await this.db.$queryRaw<{ part_id: string; version_id: string }[]>`
      SELECT DISTINCT ON (p.question_version_id) p.id::text AS part_id, p.question_version_id::text AS version_id
      FROM question_parts p
      WHERE p.question_version_id = ANY(${versionIds}::bigint[]) AND p.mode = 'mcq'
      ORDER BY p.question_version_id, p.depth, p.position, p.id`
    const partIds = parts.map((p) => idFromString(p.part_id))
    const options =
      partIds.length === 0
        ? []
        : await this.db.$queryRaw<{ part_id: string; label: string; body_ms: string | null }[]>`
            SELECT part_id::text AS part_id, label, body_ms FROM part_options WHERE part_id = ANY(${partIds}::bigint[]) ORDER BY part_id, position`
    const keys =
      partIds.length === 0
        ? []
        : await this.db.$queryRaw<{ part_id: string; correct: string | null }[]>`
            SELECT part_id::text AS part_id, content->>'correct' AS correct FROM answer_keys WHERE part_id = ANY(${partIds}::bigint[]) AND kind = 'option'`
    const partOf = new Map(parts.map((p) => [p.version_id, p.part_id]))
    for (const v of versions) {
      const partId = partOf.get(v.version_id)
      const source = [v.exam_type === null ? null : v.exam_type.charAt(0).toUpperCase() + v.exam_type.slice(1), v.year === null ? null : String(v.year), v.set_label].filter((x): x is string => x !== null && x !== '').join(' ')
      const fact: QuestionFact = {
        questionId: v.question_id,
        versionNo: v.version_no,
        versionId: v.version_id,
        stem: v.stem_ms ?? '',
        explanation: v.explanation_ms === null || v.explanation_ms === '' ? null : v.explanation_ms,
        chapterId: v.chapter_id,
        topicId: v.topic_id,
        subjectId: v.subject_id,
        difficulty: v.difficulty_tp,
        source: source === '' ? null : source,
        options: partId === undefined ? [] : options.filter((o) => o.part_id === partId).map((o) => ({ label: o.label, text: o.body_ms ?? '' })),
        correctLabel: partId === undefined ? null : (keys.find((k) => k.part_id === partId)?.correct ?? null),
      }
      out.set(`${v.question_id}:${v.want_version ?? ''}`, fact)
    }
    return out
  }

  async subjectNames(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = toIds(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: string; name: string }[]>`SELECT id::text AS id, name FROM subjects WHERE id = ANY(${keys}::bigint[])`
    return new Map(rows.map((r) => [r.id, r.name]))
  }

  async chapters(ids: readonly string[]): Promise<Map<string, { name: string; number: number | null }>> {
    const keys = toIds(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: string; name: string | null; chapter_number: number | null }[]>`
      SELECT id::text AS id, name, chapter_number FROM chapters WHERE id = ANY(${keys}::bigint[])`
    return new Map(rows.map((r) => [r.id, { name: r.name ?? '', number: r.chapter_number }]))
  }

  async topics(ids: readonly string[]): Promise<Map<string, { name: string; chapterId: string }>> {
    const keys = toIds(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: string; name: string; chapter_id: string }[]>`
      SELECT id::text AS id, name, chapter_id::text AS chapter_id FROM topics WHERE id = ANY(${keys}::bigint[])`
    return new Map(rows.map((r) => [r.id, { name: r.name, chapterId: r.chapter_id }]))
  }

  /** Published, active, non-PKSK questions per chapter (the "available questions" of a gap). */
  async availableByChapter(chapterIds: readonly string[]): Promise<Map<string, number>> {
    const keys = toIds(chapterIds)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ chapter_id: string; n: number }[]>`
      SELECT v.chapter_id::text AS chapter_id, count(*)::int AS n
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
      WHERE q.is_active AND v.chapter_id = ANY(${keys}::bigint[])
        AND NOT EXISTS (SELECT 1 FROM question_tags t WHERE t.question_id = q.id AND t.kind = 'pksk_domain')
      GROUP BY v.chapter_id`
    return new Map(rows.map((r) => [r.chapter_id, r.n]))
  }

  /** Active subjects taught at a grade (the "untried" list of S4), in curriculum order. */
  async subjectsOfGrade(grade: number): Promise<{ id: string; name: string }[]> {
    return this.db.$queryRaw<{ id: string; name: string }[]>`
      SELECT DISTINCT s.id::text AS id, s.name, s.sort_order
      FROM subjects s JOIN subject_levels sl ON sl.subject_id = s.id JOIN education_levels l ON l.id = sl.education_level_id
      WHERE s.is_active AND l.is_active AND l.grade = ${grade}
      ORDER BY s.sort_order, s.name`
  }

  /** Active subjects, name order is applied by the caller (S6 options). */
  async activeSubjects(): Promise<{ id: string; name: string }[]> {
    return this.db.$queryRaw<{ id: string; name: string }[]>`SELECT id::text AS id, name FROM subjects WHERE is_active`
  }

  // --- teacher report (S1) ----------------------------------------------------------------------------------------------------

  /** Pupils among `ids` (students only) with their login time. */
  async studentsAmong(ids: readonly string[]): Promise<(PupilLine & { avatar: null })[]> {
    const keys = toIds(ids)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: string; name: string; email: string | null; grade: number | null; last_login_at: Date | null }[]>`
      SELECT u.id::text AS id, u.name, u.email, u.grade, u.last_login_at FROM users u
      WHERE u.id = ANY(${keys}::bigint[]) AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'student')`
    return rows.map((r) => ({ id: r.id, name: r.name, email: r.email ?? '', grade: r.grade, lastLoginAt: r.last_login_at, avatar: null }))
  }

  /** Completed non-test sessions in the window, grouped by pupil, mode and MYT day. */
  async sessionsByDay(userIds: readonly string[], from: Date, to: Date): Promise<SessionDayRow[]> {
    const keys = toIds(userIds)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ user_id: string; mode: string; day: string; sessions: number; correct: number; questions: number }[]>`
      SELECT s.user_id::text AS user_id, s.mode, to_char(s.completed_at AT TIME ZONE ${KL}, 'YYYY-MM-DD') AS day,
        count(*)::int AS sessions, coalesce(sum(s.correct_count), 0)::int AS correct, coalesce(sum(s.question_count), 0)::int AS questions
      FROM practice_sessions s
      WHERE s.user_id = ANY(${keys}::bigint[]) AND s.status = 'completed' AND NOT s.is_test
        AND s.completed_at >= ${from} AND s.completed_at <= ${to}
      GROUP BY 1, 2, 3`
    return rows.map((r) => ({ userId: r.user_id, mode: r.mode, day: r.day, sessions: r.sessions, correct: r.correct, questions: r.questions }))
  }

  /** Pupils among `userIds` with at least one completed non-test session, optionally in one subject. */
  async practisedAmong(userIds: readonly string[], subjectId: string | null = null): Promise<Set<string>> {
    const keys = toIds(userIds)
    if (keys.length === 0) return new Set()
    const bySubject = subjectId === null ? Prisma.empty : Prisma.sql`AND s.subject_id = ${idFromString(subjectId)}`
    const rows = await this.db.$queryRaw<{ user_id: string }[]>`
      SELECT DISTINCT s.user_id::text AS user_id FROM practice_sessions s
      WHERE s.user_id = ANY(${keys}::bigint[]) AND s.status = 'completed' AND NOT s.is_test ${bySubject}`
    return new Set(rows.map((r) => r.user_id))
  }

  // --- item analysis (S6) --------------------------------------------------------------------------------------------------------

  private subjectClause(subjectId: string | null): Prisma.Sql {
    return subjectId === null ? Prisma.empty : Prisma.sql`AND a.subject_id = ${idFromString(subjectId)}`
  }

  async itemTallies(userIds: readonly string[], subjectId: string | null): Promise<ItemTally[]> {
    const keys = toIds(userIds)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ question_id: string; attempts: number; correct: number; subject_id: string | null }[]>`
      SELECT a.question_id::text AS question_id, count(*)::int AS attempts, count(*) FILTER (WHERE a.is_correct)::int AS correct,
        min(a.subject_id)::text AS subject_id
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.question_id IS NOT NULL AND a.user_id = ANY(${keys}::bigint[]) ${this.subjectClause(subjectId)}
      GROUP BY a.question_id`
    return rows.map((r) => ({ questionId: r.question_id, attempts: r.attempts, correct: r.correct, subjectId: r.subject_id }))
  }

  /** Answers and correct answers per pupil in the S6 scope. */
  async memberTotals(userIds: readonly string[], subjectId: string | null): Promise<Map<string, { n: number; c: number }>> {
    const keys = toIds(userIds)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ user_id: string; n: number; c: number }[]>`
      SELECT a.user_id::text AS user_id, count(*)::int AS n, count(*) FILTER (WHERE a.is_correct)::int AS c
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.question_id IS NOT NULL AND a.user_id = ANY(${keys}::bigint[]) ${this.subjectClause(subjectId)}
      GROUP BY a.user_id`
    return new Map(rows.map((r) => [r.user_id, { n: r.n, c: r.c }]))
  }

  /** Per-question tallies of one group of pupils (the upper or lower group of the discrimination). */
  async groupTallies(userIds: readonly string[], subjectId: string | null): Promise<Map<string, { n: number; c: number }>> {
    const keys = toIds(userIds)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ question_id: string; n: number; c: number }[]>`
      SELECT a.question_id::text AS question_id, count(*)::int AS n, count(*) FILTER (WHERE a.is_correct)::int AS c
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.question_id IS NOT NULL AND a.user_id = ANY(${keys}::bigint[]) ${this.subjectClause(subjectId)}
      GROUP BY a.question_id`
    return new Map(rows.map((r) => [r.question_id, { n: r.n, c: r.c }]))
  }

  /** The stem and subject of a question as last served (the live version, else the latest). */
  async questionStems(ids: readonly string[]): Promise<Map<string, { stem: string; subjectId: string | null }>> {
    const keys = toIds(ids)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ id: string; stem_ms: string | null; subject_id: string | null }[]>`
      SELECT q.id::text AS id, v.stem_ms, v.subject_id::text AS subject_id
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = coalesce(q.live_version_no, q.latest_version_no)
      WHERE q.id = ANY(${keys}::bigint[])`
    return new Map(rows.map((r) => [r.id, { stem: r.stem_ms ?? '', subjectId: r.subject_id }]))
  }

  // --- school admin reports (BE-21 Part B, additive read-only) -----------------------------------------------------------

  /** Seconds spent in completed non-test sessions per pupil in the window (`time_spent_sec`). */
  async secondsByUser(userIds: readonly string[], from: Date, to: Date): Promise<Map<string, number>> {
    const keys = toIds(userIds)
    if (keys.length === 0) return new Map()
    const rows = await this.db.$queryRaw<{ user_id: string; seconds: number }[]>`
      SELECT s.user_id::text AS user_id, coalesce(sum(s.time_spent_sec), 0)::int AS seconds
      FROM practice_sessions s
      WHERE s.user_id = ANY(${keys}::bigint[]) AND s.status = 'completed' AND NOT s.is_test
        AND s.completed_at >= ${from} AND s.completed_at <= ${to}
      GROUP BY 1`
    return new Map(rows.map((r) => [r.user_id, r.seconds]))
  }

  /** Answers and correct answers per subject and pupil in the window (clean log only); rows without a subject are left out. */
  async subjectTallies(
    userIds: readonly string[],
    from: Date,
    to: Date,
  ): Promise<{ subjectId: string; userId: string; answers: number; correct: number }[]> {
    const keys = toIds(userIds)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ subject_id: string; user_id: string; answers: number; correct: number }[]>`
      SELECT a.subject_id::text AS subject_id, a.user_id::text AS user_id, count(*)::int AS answers,
        count(*) FILTER (WHERE a.is_correct)::int AS correct
      FROM ${CLEAN_ANSWERS}
      WHERE ${CLEAN_WHERE} AND a.subject_id IS NOT NULL AND a.user_id = ANY(${keys}::bigint[])
        AND a.answered_at >= ${from} AND a.answered_at <= ${to}
      GROUP BY 1, 2`
    return rows.map((r) => ({ subjectId: r.subject_id, userId: r.user_id, answers: r.answers, correct: r.correct }))
  }
}
