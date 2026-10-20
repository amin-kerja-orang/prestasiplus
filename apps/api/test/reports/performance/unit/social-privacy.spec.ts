import { PerformanceRankingSchema } from '@pp/contract'
import { ApiError } from '../../../../src/common/errors/api-error'
import { beforeEach, describe, expect, it } from 'vitest'

import { ctxOf } from '../fakes/fixtures'
import { addPupil, socialWorld, type SocialWorld } from '../fakes/social-world'

let w: SocialWorld
const staff = ctxOf('teacher', 't1')
const student = ctxOf('student', '1')
const officer = ctxOf('ppd_officer', 'o1')

/** Negeri A: pupils 1..6 (school s1/s2). Negeri B: pupils 7..10 (4 ranked pupils, below the cohort of 5). */
beforeEach(() => {
  w = socialWorld()
  for (let i = 1; i <= 6; i++) {
    addPupil(w, String(i), `Murid${i} Penuh Nama${i}`, i <= 3 ? 's1' : 's2')
    w.practice.addAnswers(String(i), 10, 10 - i)
  }
  for (let i = 7; i <= 10; i++) {
    addPupil(w, String(i), `Murid${i} Penuh Nama${i}`, 's3')
    w.practice.addAnswers(String(i), 10, 10 - i, { levelCode: i <= 8 ? 't4' : 't5' })
  }
  w.directory.addPupil({ id: 't1', name: 'Cikgu Ujian', schoolId: 's1', isStudent: false })
})

describe('Rankings: privacy (OQ-7)', () => {
  it('names: staff see full names, others first name + last initial; ids only on the own row', async () => {
    const s = await w.ranking.rankings(student, {})
    expect(s.rows[0]).toMatchObject({ userId: '1', name: 'Murid1 Penuh Nama1' }) // own row, full name
    expect(s.rows[1]).toMatchObject({ userId: null, name: 'Murid2 N.' })
    const t = await w.ranking.rankings(staff, {})
    expect(t.rows[1]).toMatchObject({ userId: '2', name: 'Murid2 Penuh Nama2' })
    const o = await w.ranking.rankings(officer, {})
    expect(o.rows.every((r) => r.userId === null || r.userId === 'o1')).toBe(true)
    PerformanceRankingSchema.parse(s)
  })

  it('1. differencing nasional / negeri / daerah cannot isolate a cohort below 5', async () => {
    const nasional = await w.ranking.rankings(student, {})
    const negB = await w.ranking.rankings(student, { scope: 'negeri', negeri: 'Negeri B' })
    expect(negB).toMatchObject({ rows: [], total: 0 })
    // nasional rows carry no school name, so the 4 pupils of Negeri B cannot be told apart from the rest
    expect(nasional.rows.every((r) => r.schoolName === '')).toBe(true)
    // a viewer in Negeri B: the school-level scopes with < 5 pupils are empty as well
    w.directory.addPupil({ id: 'v', name: 'Viewer Ujian', schoolId: 's3' })
    const v = ctxOf('student', 'v')
    expect((await w.ranking.rankings(v, { scope: 'sekolah' })).total).toBe(0)
    expect((await w.ranking.rankings(v, { scope: 'daerah' })).total).toBe(0)
    // staff see them
    expect((await w.ranking.rankings(staff, { scope: 'negeri', negeri: 'Negeri B' })).total).toBe(4)
  })

  it('2. total is the same for staff and non-staff in a scope of 5 or more, and 0 when suppressed', async () => {
    const a = await w.ranking.rankings(staff, { scope: 'negeri', negeri: 'Negeri A' })
    const b = await w.ranking.rankings(student, { scope: 'negeri', negeri: 'Negeri A' })
    expect(a.total).toBe(6)
    expect(b.total).toBe(6)
    expect((await w.ranking.rankings(officer, { scope: 'negeri', negeri: 'Negeri B' })).total).toBe(0)
  })

  it('3. states never lists a state with fewer than 5 ranked pupils for non-staff', async () => {
    expect((await w.ranking.rankings(student, {})).states).toEqual(['Negeri A'])
    expect((await w.ranking.rankings(staff, {})).states).toEqual(['Negeri A', 'Negeri B'])
  })

  it('4. tingkatan T4 + T5 equals the unfiltered rows only under the same visibility', async () => {
    const all = await w.ranking.rankings(student, {})
    const t4 = await w.ranking.rankings(student, { tingkatan: 'T4' })
    const t5 = await w.ranking.rankings(student, { tingkatan: 'T5' })
    expect(t4.total).toBe(8)
    expect(t5.total).toBe(0) // two T5 pupils: below the cohort, hidden from a student
    expect(t4.total + t5.total).toBeLessThanOrEqual(all.total)
    const s5 = await w.ranking.rankings(staff, { tingkatan: 'T5' })
    expect(s5.total).toBe(2)
  })

  it('5. Mod Pelajar (test) activity changes nothing', async () => {
    const before = await w.ranking.rankings(student, {})
    addPupil(w, '50', 'Murid Ujian Mod', 's1')
    w.practice.addAnswers('50', 20, 20, { isTest: true })
    w.practice.addSession({ userId: '50', completedAt: new Date('2026-09-25T10:00:00+08:00'), questionCount: 10, correctCount: 10, coins: 99, isTest: true })
    expect(await w.ranking.rankings(student, {})).toEqual(before)
    expect((await w.board.leaderboard(student, 'all')).rows.map((r) => r.userId)).not.toContain('50')
  })
})

describe('Weekly report (AC6)', () => {
  it('is 403 This action is unauthorized. for every role', () => {
    expect.assertions(1)
    try {
      w.weekly.report()
    } catch (e) {
      expect((e as ApiError).getStatus()).toBe(403)
    }
  })
})
