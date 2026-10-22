import { type CcTestApp, createAnswers, createClass, createUser, enrol } from './helpers'

/**
 * Deterministic world of the drill-down specs, relative to the fixed clock (Mon 2026-10-19 09:00 +08:00). Two private schools
 * (A and B) so nothing depends on the demo seed:
 *
 *   school A (6 students, all in an active class): teacher TA (classes A1: P1 P2 P5(inactive), A2: P3), teacher TB (class B1: P4), owner-only teacher TO of school B
 *             (class O1 at school A: P6), an INACTIVE class A3 of TA (P7, school-less), one is_test member of A1 (school-less).
 *   school B: teacher TC (class C1: Q1), a loose pupil.
 *
 * Every student of school A is in exactly one active class, so the counts must add up across the levels (AC 2).
 */
export interface DrillWorld {
  schoolA: string
  schoolB: string
  ta: { id: string; email: string }
  tb: { id: string; email: string }
  to: { id: string; email: string }
  tc: { id: string; email: string }
  schoolAdminA: { id: string; email: string }
  a1: string
  a2: string
  a3: string
  b1: string
  o1: string
  c1: string
  p: Record<'p1' | 'p2' | 'p3' | 'p4' | 'p5' | 'p6' | 'p7' | 'q1' | 'loose' | 'test', string>
}

const TODAY = '2026-10-19T08:00:00+08:00'

export async function buildDrillWorld(t: CcTestApp): Promise<DrillWorld> {
  const { db } = t
  const school = async (name: string): Promise<string> => (await db.query<{ id: string }>(`insert into schools (name) values ($1) returning id::text`, [name]))[0]?.id as string
  const schoolA = await school('Sekolah Kajian A')
  const schoolB = await school('Sekolah Kajian B')
  const ta = await createUser(db, { role: 'teacher', schoolId: schoolA, name: 'Guru Alpha' })
  const tb = await createUser(db, { role: 'teacher', schoolId: schoolA, name: 'Guru Beta' })
  const to = await createUser(db, { role: 'teacher', schoolId: schoolB, name: 'Guru Pemilik' })
  const tc = await createUser(db, { role: 'teacher', schoolId: schoolB, name: 'Guru Cenderawasih' })
  const schoolAdminA = await createUser(db, { role: 'school_admin', schoolId: schoolA, name: 'Admin Sekolah A' })
  await db.query(`insert into teacher_profiles (user_id, subject) values ($1::bigint, '  Matematik  ')`, [ta.id])
  const a1 = await createClass(db, { teacherId: ta.id, schoolId: schoolA, name: 'Kelas A1', grade: 10 })
  const a2 = await createClass(db, { teacherId: ta.id, schoolId: schoolA, name: 'Kelas A2', grade: 3 })
  const a3 = await createClass(db, { teacherId: ta.id, schoolId: schoolA, name: 'Kelas A3 Lama', grade: 10, isActive: false })
  const b1 = await createClass(db, { teacherId: tb.id, schoolId: schoolA, name: 'Kelas B1', grade: 11 })
  const o1 = await createClass(db, { teacherId: to.id, schoolId: schoolA, name: 'Kelas O1', grade: 7 })
  const c1 = await createClass(db, { teacherId: tc.id, schoolId: schoolB, name: 'Kelas C1', grade: 8 })

  const pupil = async (name: string, schoolId: string | null, classId: string | null, isActive = true): Promise<string> => {
    const u = await createUser(db, { role: 'student', schoolId, name, isActive })
    if (classId) await enrol(db, classId, u.id, { joinedAt: '2026-01-05T08:00:00+08:00' })
    return u.id
  }
  const p1 = await pupil('Murid Satu', schoolA, a1)
  const p2 = await pupil('Murid Dua', schoolA, a1)
  const p5 = await pupil('Murid Lima Tidak Aktif', schoolA, a1, false)
  const p3 = await pupil('Murid Tiga', schoolA, a2)
  const p4 = await pupil('Murid Empat', schoolA, b1)
  const p6 = await pupil('Murid Enam', schoolA, o1)
  const p7 = await pupil('Murid Tujuh', null, a3)
  const q1 = await pupil('Murid Sekolah B', schoolB, c1)
  const loose = await pupil('Murid Tanpa Kelas', schoolB, null)
  const test = await pupil('Murid Ujian', null, null)
  await enrol(db, a1, test, { isTest: true })

  await createAnswers(db, { userId: p1, at: TODAY, count: 10, correct: 7, subjectCode: 'BM' })
  await createAnswers(db, { userId: p1, at: '2026-10-12T10:00:00+08:00', count: 4, correct: 4, subjectCode: 'MATH' })
  await createAnswers(db, { userId: p2, at: '2026-10-08T10:00:00+08:00', count: 5, correct: 2, subjectCode: 'BM' })
  await createAnswers(db, { userId: p4, at: '2026-10-17T10:00:00+08:00', count: 4, correct: 1, subjectCode: 'MATH' })
  await createAnswers(db, { userId: p6, at: TODAY, count: 3, correct: 3, subjectCode: 'BM' })
  await createAnswers(db, { userId: p7, at: TODAY, count: 9, correct: 9, subjectCode: 'BM' })
  await createAnswers(db, { userId: q1, at: TODAY, count: 6, correct: 3, subjectCode: 'BM' })
  await createAnswers(db, { userId: loose, at: TODAY, count: 2, correct: 1, subjectCode: 'BM' })
  await createAnswers(db, { userId: test, at: TODAY, count: 50, correct: 50, subjectCode: 'BM', isTest: true })

  return {
    schoolA, schoolB, ta, tb, to, tc, schoolAdminA, a1, a2, a3, b1, o1, c1,
    p: { p1, p2, p3, p4, p5, p6, p7, q1, loose, test },
  }
}
