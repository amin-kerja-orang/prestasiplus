import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type Client, type PracticeTestApp, type World, bootPracticeApp, loadWorld, loginAs, resetPractice, startSession, START } from './helpers'

/**
 * S4-T06: the start planner and the overview reads use `offeredLevels(db)`, so a T1 pupil and a T5 pupil are both served
 * (before: only T4 and T5). A primary level is still refused. The overview side is in test/practice-reads/overview/offered-levels.spec.ts.
 */
let t: PracticeTestApp
let w: World
let pelajar: Client
let t1: string
let t5: string

const idOfLevel = async (code: string) => (await t.db.query<{ id: string }>(`select id::text id from education_levels where code = $1`, [code]))[0]?.id as string

beforeAll(async () => {
  t = await bootPracticeApp()
  w = await loadWorld(t.db)
  pelajar = await loginAs(t, 'pelajar@demo.test')
  t1 = await idOfLevel('T1')
  t5 = await idOfLevel('T5')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await resetPractice(t.db)
  t.bank.reset()
  for (const levelId of [t1, t5]) for (let i = 0; i < 8; i++) t.bank.add({ subjectId: w.subject.math, levelId, difficulty: 3, spmPool: true, correct: i % 4 })
})

describe('latih_tubi mode (was random, ERR-PRAC-07)', () => {
  it('starts at a T5 level', async () => {
    const s = await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'MATH', count: 5, difficulty: 3, levelId: t5 })
    expect(s.questions).toHaveLength(5)
    for (const q of s.questions) expect(t.bank.get(q.id).educationLevelId).toBe(t5)
  })

  // S4-T06: Latih Tubi follows `offeredLevels` (active, non-primary), so T1 starts like T5; a level that is not offered is refused.
  it('starts at a T1 level (the base offers T1 to T5)', async () => {
    const s = await startSession(pelajar, { mode: 'latih_tubi', subjectCode: 'MATH', count: 5, difficulty: 3, levelId: t1 })
    expect(s.questions).toHaveLength(5)
    for (const q of s.questions) expect(t.bank.get(q.id).educationLevelId).toBe(t1)
  })

  it('refuses an inactive secondary level (not offered)', async () => {
    const [row] = await t.db.query<{ id: string }>(
      `insert into education_levels (code, name, name_en, stage, curriculum, sort_order, is_active, grade, created_at, updated_at)
       values ('TXI', 'Tingkatan tidak aktif', 'Inactive form', 'upper_secondary', 'KSSM', 99, false, 10, now(), now()) returning id::text`,
    )
    try {
      const res = await pelajar.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 5, difficulty: 3, levelId: row!.id })
      expect(res.status).toBe(422)
      expect(res.body.error.fields.levelId).toBe('Nilai tidak sah.')
    } finally {
      await t.db.query(`delete from education_levels where id = $1`, [row!.id])
    }
  })

  it('refuses a primary level (not offered)', async () => {
    const res = await pelajar.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 5, difficulty: 3, levelId: w.level.primary })
    expect(res.status).toBe(422)
    expect(res.body.error.fields.levelId).toBe('Nilai tidak sah.')
  })
})
