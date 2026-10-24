import type { TestDatabase } from '../support/db'

/**
 * Raw-SQL fixtures of the school report specs (BE-21 Part B). Fictitious names only. Everything is inserted directly so the specs
 * do not depend on the practice, classes or curriculum write paths.
 */

export async function addPupil(db: TestDatabase, schoolId: string, name: string, opts: { grade?: number; loggedIn?: boolean; active?: boolean } = {}): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, is_active, school_id, grade, last_login_at, created_at, updated_at)
     values ($1, $2, $3, $4::bigint, $5, $6, now(), now()) returning id::text`,
    [
      name,
      `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${Math.random().toString(36).slice(2, 8)}@report.test`,
      opts.active ?? true,
      schoolId,
      opts.grade ?? 10,
      opts.loggedIn === false ? null : new Date('2026-10-18T10:00:00+08:00'),
    ],
  )
  const id = rows[0]?.id as string
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'student', now())`, [id])
  return id
}

export async function addTeacher(db: TestDatabase, schoolId: string, name: string, loggedIn = true): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, is_active, school_id, last_login_at, created_at, updated_at)
     values ($1, $2, true, $3::bigint, $4, now(), now()) returning id::text`,
    [name, `${name.toLowerCase().replace(/[^a-z0-9]+/g, '.')}.${Math.random().toString(36).slice(2, 8)}@report.test`, schoolId, loggedIn ? new Date('2026-10-18T10:00:00+08:00') : null],
  )
  const id = rows[0]?.id as string
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'teacher', now())`, [id])
  return id
}

export interface SessionSeed {
  mode?: string
  questions: number
  correct: number
  completedAt: string
  seconds?: number
  subjectId?: string | null
}

/** One completed practice session; when `subjectId` is given, one answer per question is also written (correct ones first). */
export async function addSession(db: TestDatabase, userId: string, s: SessionSeed): Promise<void> {
  const rows = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, question_count, status, correct_count, time_spent_sec, started_at, completed_at, subject_id, created_at, updated_at)
     values ($1::bigint, $2, $3, 'completed', $4, $5, $6::timestamptz, $6::timestamptz, $7::bigint, now(), now()) returning id::text`,
    [userId, s.mode ?? 'chapter', s.questions, s.correct, s.seconds ?? 60, s.completedAt, s.subjectId ?? null],
  )
  const sessionId = rows[0]?.id as string
  if (s.subjectId) {
    for (let i = 0; i < s.questions; i++) {
      await db.query(
        `insert into practice_answers (session_id, user_id, subject_id, is_correct, answered_at, created_at)
         values ($1::uuid, $2::bigint, $3::bigint, $4, $5::timestamptz, now())`,
        [sessionId, userId, s.subjectId, i < s.correct, s.completedAt],
      )
    }
  }
}

export async function addSubject(db: TestDatabase, code: string, name: string): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into subjects (code, name, name_en, color, is_active, sort_order, created_at, updated_at)
     values ($1, $2, $2, '#112233', true, 0, now(), now()) returning id::text`,
    [code, name],
  )
  return rows[0]?.id as string
}

export async function addLevel(db: TestDatabase, code: string, name: string, grade: number): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into education_levels (code, name, name_en, stage, curriculum, sort_order, is_active, grade, created_at, updated_at)
     values ($1, $2, $2, 'upper_secondary', 'KSSM', $3::int, true, $3::int, now(), now()) returning id::text`,
    [code, name, grade],
  )
  return rows[0]?.id as string
}

export async function addClassroom(
  db: TestDatabase,
  o: { schoolId: string; name: string; levelId: string; teacherId?: string | null; subjectId?: string | null; active?: boolean; kind?: string; joinCode?: string | null },
): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into classrooms (kind, name, teacher_id, school_id, subject_id, education_level_id, academic_year, join_code, is_active, created_at, updated_at)
     values ($1, $2, $3::bigint, $4::bigint, $5::bigint, $6::bigint, 2026, $7, $8, now(), now()) returning id::text`,
    [o.kind ?? 'classroom', o.name, o.teacherId ?? null, o.schoolId, o.subjectId ?? null, o.levelId, o.joinCode ?? null, o.active ?? true],
  )
  return rows[0]?.id as string
}

export async function enrol(db: TestDatabase, classroomId: string, studentId: string): Promise<void> {
  await db.query(`insert into enrolments (classroom_id, student_id, status, source, created_at, updated_at) values ($1::bigint, $2::bigint, 'active', 'teacher', now(), now())`, [classroomId, studentId])
}

/** A second school admin (for the cross-school checks): same demo password hash as `adminsekolah@demo.test`. */
export async function addSchoolAdmin(db: TestDatabase, schoolId: string, email: string): Promise<void> {
  const rows = await db.query<{ id: string }>(
    `insert into users (name, email, password_hash, is_active, school_id, created_at, updated_at)
     select 'Admin Sekolah Lain', $1, password_hash, true, $2::bigint, now(), now() from users where email = 'adminsekolah@demo.test' returning id::text`,
    [email, schoolId],
  )
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, 'school_admin', now())`, [rows[0]?.id as string])
}

/** Managed accounts of one role in a school, as S0/S6/S7 and the reports count them: the role, no role outside student/teacher, any status. */
async function managedCount(db: TestDatabase, schoolId: string, role: 'student' | 'teacher'): Promise<number> {
  const rows = await db.query<{ n: number }>(
    `select count(*)::int as n from users u where u.school_id = $1::bigint
       and exists (select 1 from user_roles r where r.user_id = u.id and r.role = $2)
       and not exists (select 1 from user_roles r where r.user_id = u.id and r.role not in ('student', 'teacher'))`,
    [schoolId, role],
  )
  return rows[0]?.n ?? 0
}

export const managedPupilCount = (db: TestDatabase, schoolId: string) => managedCount(db, schoolId, 'student')
export const managedTeacherCount = (db: TestDatabase, schoolId: string) => managedCount(db, schoolId, 'teacher')

/** Marks an account suspended (it stays active and is still counted as a managed account). */
export async function suspend(db: TestDatabase, userId: string): Promise<void> {
  await db.query(`update users set is_suspended = true where id = $1::bigint`, [userId])
}

/** Gives an existing account one more role (e.g. a teacher who is also a school_admin). */
export async function addRole(db: TestDatabase, userId: string, role: string): Promise<void> {
  await db.query(`insert into user_roles (user_id, role, created_at) values ($1::bigint, $2, now())`, [userId, role])
}

/** Adds `n` pupils to a school, each with one completed session (the cohort rule needs 5 distinct pupils). */
export async function addPupilsWithSessions(
  db: TestDatabase,
  schoolId: string,
  n: number,
  s: SessionSeed,
  prefix = 'Murid Ujian',
): Promise<string[]> {
  const ids: string[] = []
  for (let i = 1; i <= n; i++) {
    const id = await addPupil(db, schoolId, `${prefix} ${i}`)
    await addSession(db, id, s)
    ids.push(id)
  }
  return ids
}
