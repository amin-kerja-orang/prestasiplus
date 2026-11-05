import { describe, expect, it } from 'vitest'

import { performanceBlock } from '../../../../src/modules/school-admin/dashboard.mapper'
import { answers, ctxOf, world, type World } from '../fakes/fixtures'

/**
 * The scenarios of `test/school-admin/dashboard-performance.spec.ts` (real database) reproduced on the in-memory fakes, so the
 * expected numbers are proven without a database: the Admin Sekolah dashboard practice block is the shared answer reader
 * (`SchoolPerformanceService` over the answer facts, S10-T07) mapped by the real `performanceBlock`.
 *
 * One pupil = one completed session of 10 answers, 7 right (the DB fixture's shape). Five such pupils: 5 sessions, 50 answers, 35/50 = 70.
 */
const ANSWERS = 10
const RIGHT = 7
const schoolAdmin = ctxOf('school_admin', 'sa1', { level: 'school', schoolId: 's1', label: 'SMK Demo Satu' })

/** `n` pupils of `schoolId` (ids `${prefix}-p1`..), the first `active` of them with one answered session. */
function pupils(w: World, schoolId: string, n: number, active: number = n, prefix: string = schoolId): string[] {
  const ids: string[] = []
  for (let i = 1; i <= n; i++) {
    const id = `${prefix}-p${String(i)}`
    w.directory.addPupil({ id, name: `Murid Ujian ${id}`, schoolId })
    if (i <= active) answers(w, id, ANSWERS, RIGHT)
    ids.push(id)
  }
  return ids
}

/**
 * The dashboard passes the XS-4 / XS-5 figures (school scope, all time) as `xs`; both read the same `practice_answers` rows as the
 * shared reader, so here they are the reader's own totals.
 */
const blockOf = async (w: World) => {
  const view = await w.school.school(schoolAdmin)
  return performanceBlock(view, { answered: view.stats.answered, accuracy: view.stats.accuracy })
}

describe('Admin Sekolah dashboard practice block over the shared answer reader (DB scenarios, in memory)', () => {
  it('5 pupils with answered sessions: the block carries accuracy 70, 5 sessions, 50 questions', async () => {
    const w = world()
    w.directory.addSchool({ id: 's1' })
    pupils(w, 's1', 5)
    const view = await w.school.school(schoolAdmin)
    expect(view.stats).toMatchObject({ students: 5, sessions: 5, answered: 5 * ANSWERS, accuracy: 70 })
    const p = performanceBlock(view, { answered: view.stats.answered, accuracy: view.stats.accuracy })
    expect(p.practice).toEqual({ accuracy: 70, sessions: 5, questions: 5 * ANSWERS })
    // t4 and t5 stay listed at 0 (no classes); no distribution rows have counts (no headcount).
    expect(p.levels.map((l) => l.code)).toEqual(['t4', 't5'])
    expect(p.levels.every((l) => l.accuracy === 0)).toBe(true)
    expect(p.total).toBe(0)
  })

  it('fewer than 5 pupils: the practice block is shown (staff screen, no minimum cohort: PO decision 2026-11-05, #503 batch 3), levels 0', async () => {
    const w = world()
    w.directory.addSchool({ id: 's1' })
    pupils(w, 's1', 4)
    const p = await blockOf(w)
    // Changed from the suppressed { null, 0, 0 }: 40 answers, 28 right.
    expect(p.practice).toEqual({ accuracy: 70, sessions: 4, questions: 4 * ANSWERS })
    expect(p.levels.every((l) => l.accuracy === 0)).toBe(true)
    expect(p.total).toBe(0)
  })

  it('another school never leaks in: its answers are not counted, whatever their number', async () => {
    const w = world()
    w.directory.addSchool({ id: 's1' }).addSchool({ id: 's2' })
    pupils(w, 's1', 5, 2) // own school: 5 pupils, only 2 answered
    pupils(w, 's2', 8) // other school: 8 pupils with answers
    const p = await blockOf(w)
    expect(p.practice).toEqual({ accuracy: 70, sessions: 2, questions: 2 * ANSWERS })
  })

  it('levels: 5 pupils with answers in one class of the level are shown; a level with fewer than 5 pupils is shown too (no minimum cohort)', async () => {
    const w = world()
    w.directory.addSchool({ id: 's1' })
    const five = pupils(w, 's1', 5)
    const small = pupils(w, 's1', 2, 2, 'small')
    w.classes.add({ id: '10', schoolId: 's1', levelSlug: 't4' }, five)
    w.classes.add({ id: '11', schoolId: 's1', levelSlug: 't5' }, small)
    const p = await blockOf(w)
    expect(p.levels.find((l) => l.code === 't4')?.accuracy).toBe(70)
    // Changed from 0 (suppressed): the small level now shows its figure.
    expect(p.levels.find((l) => l.code === 't5')?.accuracy).toBe(70)
  })

  it('a school with activity is never {accuracy: null, sessions: 0}', async () => {
    const w = world()
    w.directory.addSchool({ id: 's1' })
    pupils(w, 's1', 6, 1)
    const p = await blockOf(w)
    expect(p.practice.sessions).toBeGreaterThan(0)
    expect(p.practice.accuracy).not.toBeNull()
  })
})
