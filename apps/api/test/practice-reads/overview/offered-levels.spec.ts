import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { type Client, START, addQuestion, bootOverviewApp, clearPractice, idOf, loginAs } from './helpers'
import type { CurriculumTestApp } from '../../curriculum/helpers'

/**
 * S4-T06: the overview reads offer every active non-primary level (`offeredLevels(db)`), so a subject with T1 and T5
 * questions reports both with counts, and the practice chapter list opens on T1.
 */
let t: CurriculumTestApp
let pelajar: Client
let math: string
let t1: string
let t5: string

beforeAll(async () => {
  t = await bootOverviewApp()
  pelajar = await loginAs(t, 'pelajar@demo.test')
  math = await idOf(t.db, 'subjects', 'MATH')
  t1 = await idOf(t.db, 'education_levels', 'T1')
  t5 = await idOf(t.db, 'education_levels', 'T5')
}, 120_000)

afterAll(async () => {
  await t.close()
})

beforeEach(async () => {
  t.clock.set(START)
  await clearPractice(t.db)
  await t.db.query('delete from questions')
  await addQuestion(t.db, { subject: math, level: t1, tp: 2 })
  await addQuestion(t.db, { subject: math, level: t1, tp: 3 })
  await addQuestion(t.db, { subject: math, level: t5, tp: 4 })
})

describe('offered levels in the overview reads', () => {
  it('GET /api/practice/subjects/MATH lists T1 to T5; T1 and T5 carry their counts', async () => {
    const res = await pelajar.get('/api/practice/subjects/MATH')
    expect(res.status).toBe(200)
    const levels = res.body.data.levels as { code: string; count: number }[]
    expect(levels.map((l) => l.code)).toEqual(['T1', 'T2', 'T3', 'T4', 'T5'])
    expect(levels.find((l) => l.code === 'T1')?.count).toBe(2)
    expect(levels.find((l) => l.code === 'T5')?.count).toBe(1)
    expect(res.body.data.total).toBe(3)
  })

  it('GET /api/practice/chapter-subjects/MATH offers T1 to T5 and opens on T1', async () => {
    const res = await pelajar.get('/api/practice/chapter-subjects/MATH')
    expect(res.status).toBe(200)
    expect(res.body.data.levelId).toBe(t1)
    expect(res.body.data.levels.map((l: { id: string }) => l.id)).toContain(t5)
  })
})
