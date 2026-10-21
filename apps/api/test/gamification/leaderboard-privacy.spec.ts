import { GamificationLeaderboardSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { RANKING_REDACTED_ID, canSeeRankedName, shortName } from '../../src/modules/gamification/name-privacy'
import { SCHOOL_ADMIN } from '../users/helpers'
import { ADMIN, STUDENT, TEACHER, bootGamificationApp, dataOf, fail, signIn, signInMod, userIdOf, type Client, type GamificationTestApp } from './helpers'

/**
 * #76 (LEAD): the national leaderboard shows the full name and the user id only within the viewer's scope (teacher:
 * pupils of the own active classes; school admin: the own school; admin: everyone; anyone: the own row). Every other
 * row shows first name + initial and `userId: null`. Ranks and totals do not depend on the viewer.
 */
describe('GET /api/gamification/leaderboard: names only within scope (#76)', () => {
  let t: GamificationTestApp
  let ids: Record<'inClass' | 'sameSchool' | 'otherSchool' | 'testEnrolled' | 'inactiveClass' | 'testOnly' | 'student' | 'teacher', string>
  const NAMES = {
    inClass: 'Nur Aina binti Kamal',
    sameSchool: 'Hakim bin Zainal',
    otherSchool: 'Mei Ling Tan',
    testEnrolled: 'Arjun a/l Ravi',
    inactiveClass: 'Siti Hajar',
  }

  type Row = { userId: string | null; name: string; initials: string; totalSyilingEarned: number }
  async function board(who: Client): Promise<Row[]> {
    const d = GamificationLeaderboardSchema.parse(dataOf(await who.get('/gamification/leaderboard')))
    return [...d.podium, ...d.rows]
  }
  /** The row of the wallet with this (unique) lifetime total. */
  const byTotal = (rows: Row[], total: number): Row => {
    const r = rows.find((x) => x.totalSyilingEarned === total)
    expect(r, `row with total ${total}`).toBeDefined()
    return r!
  }
  const TOTAL = { inClass: 9001, sameSchool: 9002, otherSchool: 9003, testEnrolled: 9004, inactiveClass: 9005 }
  /** The teacher's own wallet: the own row is shown in full although the teacher is not a pupil of the own classes. */
  const TEACHER_TOTAL = 9006

  async function pupil(name: string, schoolId: string): Promise<string> {
    return (await t.db.query<{ id: string }>(`insert into users (name, school_id) values ($1, $2::bigint) returning id::text`, [name, schoolId]))[0]!.id
  }
  async function classOf(teacherId: string, schoolId: string, active: boolean, members: { id: string; isTest: boolean }[]): Promise<void> {
    let level = (await t.db.query<{ id: string }>(`select id::text from education_levels order by id limit 1`))[0]?.id
    level ??= (
      await t.db.query<{ id: string }>(`insert into education_levels (code, name, name_en, stage, curriculum, grade) values ('LBT4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'KSSM', 10) returning id::text`)
    )[0]!.id
    const cls = (
      await t.db.query<{ id: string }>(
        `insert into classrooms (name, teacher_id, school_id, education_level_id, academic_year, is_active) values ('Kelas Papan', $1::bigint, $2::bigint, $3::bigint, 2026, $4) returning id::text`,
        [teacherId, schoolId, level, active],
      )
    )[0]!.id
    for (const m of members) await t.db.query(`insert into enrolments (classroom_id, student_id, status, source, is_test) values ($1::bigint, $2::bigint, 'active', 'teacher', $3)`, [cls, m.id, m.isTest])
  }
  const credit = (userId: string, amount: number, isTest = false) =>
    t.wallet.credit({ userId, amount, source: 'admin_award', sourceId: `lb76-${userId}-${isTest}`, description: 'Ujian papan', isTest })

  beforeAll(async () => {
    t = await bootGamificationApp()
    const schools = await t.db.query<{ id: string; code: string }>(`select id::text, code from schools where code in ('DEMO001', 'DEMO002')`)
    const own = schools.find((s) => s.code === 'DEMO001')!.id
    const other = schools.find((s) => s.code === 'DEMO002')!.id
    const teacher = await userIdOf(t.db, TEACHER)
    ids = {
      inClass: await pupil(NAMES.inClass, own),
      sameSchool: await pupil(NAMES.sameSchool, own),
      otherSchool: await pupil(NAMES.otherSchool, other),
      testEnrolled: await pupil(NAMES.testEnrolled, other),
      inactiveClass: await pupil(NAMES.inactiveClass, other),
      testOnly: await pupil('Ujian Sahaja', own),
      student: await userIdOf(t.db, STUDENT),
      teacher,
    }
    await classOf(teacher, own, true, [
      { id: ids.inClass, isTest: false },
      { id: ids.testEnrolled, isTest: true },
    ])
    await classOf(teacher, other, false, [{ id: ids.inactiveClass, isTest: false }])
    for (const k of Object.keys(TOTAL) as (keyof typeof TOTAL)[]) await credit(ids[k], TOTAL[k])
    await credit(ids.testOnly, 20_000, true)
    await credit(ids.teacher, TEACHER_TOTAL)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('admin: every row with the full name and the real id; a Mod Pelajar test-only actor is never ranked', async () => {
    const rows = await board(await signIn(t, ADMIN))
    for (const k of Object.keys(TOTAL) as (keyof typeof TOTAL)[]) expect(byTotal(rows, TOTAL[k])).toMatchObject({ userId: ids[k], name: NAMES[k] })
    expect(rows.find((r) => r.userId === ids.testOnly || r.totalSyilingEarned >= 20_000)).toBeUndefined()
    expect(rows.every((r) => r.userId !== RANKING_REDACTED_ID)).toBe(true)
  })

  it('student: other pupils show first name + initial and the redacted id; the own row stays full', async () => {
    const student = await signIn(t, STUDENT)
    const rows = await board(student)
    expect(byTotal(rows, TOTAL.inClass)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Nur K.', initials: 'NK' })
    expect(byTotal(rows, TOTAL.sameSchool)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Hakim Z.' })
    expect(byTotal(rows, TOTAL.otherSchool)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Mei T.' })
    expect(byTotal(rows, TOTAL.testEnrolled)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Arjun R.' })
    expect(byTotal(rows, TOTAL.inactiveClass)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Siti H.' })
    const mine = rows.filter((r) => r.userId === ids.student)
    expect(mine).toHaveLength(1)
    const full = (await t.db.query<{ name: string }>(`select name from users where id = $1::bigint`, [ids.student]))[0]!.name
    expect(mine[0]!.name).toBe(full)
    // No full name of anybody else reaches the student.
    for (const n of Object.values(NAMES)) expect(rows.some((r) => r.name === n)).toBe(false)
  })

  it('teacher: full names of active, real pupils of the own active classes only', async () => {
    const rows = await board(await signIn(t, TEACHER))
    expect(byTotal(rows, TOTAL.inClass)).toMatchObject({ userId: ids.inClass, name: NAMES.inClass })
    // Same school but not in a class of the teacher, another school, a Mod Pelajar enrolment, an inactive class.
    expect(byTotal(rows, TOTAL.sameSchool)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Hakim Z.' })
    expect(byTotal(rows, TOTAL.otherSchool)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Mei T.' })
    expect(byTotal(rows, TOTAL.testEnrolled)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Arjun R.' })
    expect(byTotal(rows, TOTAL.inactiveClass)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Siti H.' })
  })

  it('school admin: full names of the own school only', async () => {
    const rows = await board(await signIn(t, SCHOOL_ADMIN))
    expect(byTotal(rows, TOTAL.inClass)).toMatchObject({ userId: ids.inClass, name: NAMES.inClass })
    expect(byTotal(rows, TOTAL.sameSchool)).toMatchObject({ userId: ids.sameSchool, name: NAMES.sameSchool })
    expect(byTotal(rows, TOTAL.otherSchool)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Mei T.' })
    expect(byTotal(rows, TOTAL.testEnrolled)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Arjun R.' })
    expect(byTotal(rows, TOTAL.inactiveClass)).toMatchObject({ userId: RANKING_REDACTED_ID, name: 'Siti H.' })
  })

  it('an admin in Mod Pelajar acts as a student: no other full name, no other id', async () => {
    const rows = await board(await signInMod(t, ADMIN))
    for (const k of Object.keys(TOTAL) as (keyof typeof TOTAL)[]) expect(byTotal(rows, TOTAL[k]).userId).toBe(RANKING_REDACTED_ID)
  })

  it('401 for an anonymous caller', async () => {
    fail(await t.http().get('/api/gamification/leaderboard'), 401, 'UNAUTHORIZED')
  })

  it('redacted rows carry userId null (contract nullable) and the raw body holds no other full name or real id', async () => {
    const res = await (await signIn(t, STUDENT)).get('/gamification/leaderboard')
    const raw = JSON.stringify(res.body)
    for (const k of Object.keys(TOTAL) as (keyof typeof TOTAL)[]) {
      expect(raw).not.toContain(NAMES[k])
      expect(raw).not.toContain(`"${ids[k]}"`)
    }
    expect(byTotal(await board(await signIn(t, STUDENT)), TOTAL.inClass).userId).toBeNull()
  })

  it('teacher: the own row stays full', async () => {
    const rows = await board(await signIn(t, TEACHER))
    expect(byTotal(rows, TEACHER_TOTAL)).toMatchObject({ userId: ids.teacher, name: 'Guru Demo' })
  })

  it('ranks and totals are the same whoever asks', async () => {
    const shape = (rows: Row[]) => rows.map((r) => r.totalSyilingEarned)
    const admin = shape(await board(await signIn(t, ADMIN)))
    expect(shape(await board(await signIn(t, STUDENT)))).toEqual(admin)
    expect(shape(await board(await signIn(t, TEACHER)))).toEqual(admin)
  })
})

describe('name-privacy helpers (#76)', () => {
  it('shortName: first name + initial of the last non-particle word', () => {
    expect(shortName('Nur Aina binti Kamal')).toBe('Nur K.')
    expect(shortName('Ahmad bin Ali')).toBe('Ahmad A.')
    expect(shortName('Kumar a/l Raju')).toBe('Kumar R.')
    expect(shortName('Mei Ling Tan')).toBe('Mei T.')
    expect(shortName('  Siti   hajar ')).toBe('Siti H.')
    expect(shortName('Amin')).toBe('Amin')
    expect(shortName('Amin bin')).toBe('Amin')
    expect(shortName('')).toBe('')
  })

  it('canSeeRankedName: role x scope matrix', () => {
    const none = { ownPupils: new Set<string>(), schoolId: null }
    const v = (role: 'admin' | 'school_admin' | 'teacher' | 'student' | 'ppd_officer' | 'parent' | 'sponsor', schoolId: string | null = null) => ({ userId: '1', role, schoolId })
    expect(canSeeRankedName(v('admin'), none, '9', '5')).toBe(true)
    expect(canSeeRankedName(v('school_admin', '5'), { ownPupils: new Set(), schoolId: '5' }, '9', '5')).toBe(true)
    expect(canSeeRankedName(v('school_admin', '5'), { ownPupils: new Set(), schoolId: '5' }, '9', '6')).toBe(false)
    expect(canSeeRankedName(v('school_admin', '5'), { ownPupils: new Set(), schoolId: '5' }, '9', null)).toBe(false)
    expect(canSeeRankedName(v('school_admin'), none, '9', null)).toBe(false)
    expect(canSeeRankedName(v('school_admin'), none, '1', null)).toBe(true)
    expect(canSeeRankedName(v('teacher'), { ownPupils: new Set(['9']), schoolId: null }, '9', '5')).toBe(true)
    expect(canSeeRankedName(v('teacher'), { ownPupils: new Set(['8']), schoolId: null }, '9', '5')).toBe(false)
    for (const role of ['student', 'ppd_officer', 'parent', 'sponsor'] as const) {
      expect(canSeeRankedName(v(role), none, '9', '5'), role).toBe(false)
      expect(canSeeRankedName(v(role), none, '1', '5'), `${role} own row`).toBe(true)
    }
  })
})
