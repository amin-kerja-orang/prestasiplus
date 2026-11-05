import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bareStudent, bootGamificationApp, challengeIdByTitle, type GamificationTestApp } from './helpers'

describe('completionCountsOn / challengesForTeacher: read-only teacher reader (S6-T07)', () => {
  let t: GamificationTestApp
  let kilat: string

  beforeAll(async () => {
    t = await bootGamificationApp()
    kilat = await challengeIdByTitle(t, 'Kilat Matematik')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const insert = (user: string, day: string, isTest: boolean) =>
    t.db.query(`insert into challenge_completions (user_id, challenge_id, completion_date, completed_at, is_test) values ($1::bigint, $2::bigint, $3::date, now(), $4)`, [user, kilat, day, isTest])

  it('counts distinct pupils of the given set for today only, test rows and other days excluded', async () => {
    const a = await bareStudent(t, 'Guru Satu')
    const b = await bareStudent(t, 'Guru Dua')
    const c = await bareStudent(t, 'Guru Tiga')
    const outsider = await bareStudent(t, 'Guru Luar')
    const today = '2026-10-19' // START of the fixed clock
    await insert(a, today, false)
    await insert(b, today, false)
    await insert(c, today, true) // test row
    await insert(a, '2026-10-18', false) // yesterday
    await insert(outsider, today, false) // not this teacher's pupil

    const rows = await t.gamification.challengesForTeacher([a, b, c])
    const row = rows.find((r) => r.id === kilat)!
    expect(row.completedToday).toBe(2)
    expect(row.title).toBe('Kilat Matematik')
    expect(await t.gamification.challengesForTeacher([])).toSatisfy((r: { completedToday: number }[]) => r.every((x) => x.completedToday === 0))
  })
})
