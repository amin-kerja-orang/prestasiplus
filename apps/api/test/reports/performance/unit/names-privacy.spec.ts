import type { RoleCode } from '@pp/contract'
import { beforeEach, describe, expect, it } from 'vitest'

import { canSeeName, displayName } from '../../../../src/modules/reports/performance/domain/privacy'
import { resolveNameScope } from '../../../../src/modules/reports/performance/services/name-scope'
import { ctxOf } from '../fakes/fixtures'
import { addPupil, socialWorld, type SocialWorld } from '../fakes/social-world'

/**
 * One naming rule for /rankings and /leaderboard (children's privacy, security M1+M2). Pupils: 1 (school s1,
 * class c1 of teacher t1), 2 (s1, no class), 3 to 6 (s2). Viewers are placed in s1 unless stated.
 */
let w: SocialWorld
const FULL = (id: string) => `Murid${id} Penuh Nama${id}`
const SHORT = (id: string) => `Murid${id} N.`

beforeEach(() => {
  w = socialWorld()
  for (let i = 1; i <= 6; i++) {
    const id = String(i)
    addPupil(w, id, FULL(id), i <= 2 ? 's1' : 's2')
    w.practice.addAnswers(id, 10, 10 - i)
    w.practice.addSession({ userId: id, completedAt: new Date('2026-09-23T10:00:00+08:00'), questionCount: 10, correctCount: 10 - i, coins: 100 - i })
  }
  w.directory.addPupil({ id: 't1', name: 'Cikgu Ujian', schoolId: 's1', isStudent: false })
  w.directory.addPupil({ id: 'sa1', name: 'Admin Sekolah Satu', schoolId: 's1', isStudent: false })
  w.directory.addPupil({ id: 'sa2', name: 'Admin Sekolah Dua', schoolId: 's2', isStudent: false })
  w.classes.add({ id: 'c1', schoolId: 's1', teacherId: 't1' }, ['1'])
})

type Row = { userId: string | null; name: string }
const routes: Record<string, (viewer: ReturnType<typeof ctxOf>) => Promise<Map<string, Row>>> = {
  rankings: async (v) => {
    const r = await w.ranking.rankings(v, {})
    return new Map(r.rows.map((x, i) => [String(i + 1), x] as const))
  },
  leaderboard: async (v) => {
    const r = await w.board.leaderboard(v, 'all')
    return new Map(r.rows.map((x, i) => [String(i + 1), x] as const))
  },
}

/** viewer, and for each pupil id whether the full name + id is expected. */
const cases: { who: string; viewer: () => ReturnType<typeof ctxOf>; full: string[] }[] = [
  { who: 'student (own row 2; others short)', viewer: () => ctxOf('student', '2'), full: ['2'] },
  { who: 'student in class c1 (own row 1)', viewer: () => ctxOf('student', '1'), full: ['1'] },
  { who: 'teacher: own class pupil only, own school pupil 2 and other school are short', viewer: () => ctxOf('teacher', 't1'), full: ['1'] },
  { who: 'teacher who is also a ranked pupil row 5: own row + own class', viewer: () => ctxOf('teacher', '5'), full: ['5'] },
  { who: 'school_admin of s1: own school pupils 1, 2; other school short', viewer: () => ctxOf('school_admin', 'sa1'), full: ['1', '2'] },
  { who: 'school_admin of s2: pupils 3 to 6 only', viewer: () => ctxOf('school_admin', 'sa2'), full: ['3', '4', '5', '6'] },
  { who: 'school_admin with an own row (pupil 4 of s2) sees s2 pupils', viewer: () => ctxOf('school_admin', '4'), full: ['3', '4', '5', '6'] },
  { who: 'ppd_officer: nobody', viewer: () => ctxOf('ppd_officer', 'o1'), full: [] },
  { who: 'ppd_officer with an own row 3: only that', viewer: () => ctxOf('ppd_officer', '3'), full: ['3'] },
  { who: 'admin: everybody', viewer: () => ctxOf('admin', 'a1'), full: ['1', '2', '3', '4', '5', '6'] },
]

describe.each(Object.keys(routes))('%s naming', (route) => {
  it.each(cases)('$who', async ({ viewer, full }) => {
    const rows = await (routes[route] as (v: ReturnType<typeof ctxOf>) => Promise<Map<string, Row>>)(viewer())
    const byPupil = new Map<string, Row>()
    for (const r of rows.values()) {
      const id = [1, 2, 3, 4, 5, 6].map(String).find((p) => r.name === FULL(p) || r.name === SHORT(p)) as string
      byPupil.set(id, r)
    }
    expect(byPupil.size).toBe(6)
    for (const [id, r] of byPupil) {
      if (full.includes(id)) expect(r).toEqual(expect.objectContaining({ userId: id, name: FULL(id) }))
      else expect(r).toEqual(expect.objectContaining({ userId: null, name: SHORT(id) }))
    }
  })
})

describe('national scope: staff of another school see short names', () => {
  it('a school_admin looking at the nasional ranking sees other schools short, a teacher without classes only the own row', async () => {
    const sa = await w.ranking.rankings(ctxOf('school_admin', 'sa1'), { scope: 'nasional' })
    expect(sa.rows.filter((r) => r.userId !== null).map((r) => r.userId)).toEqual(['1', '2'])
    const t = await w.ranking.rankings(ctxOf('teacher', 't9'), { scope: 'nasional' })
    expect(t.rows.every((r) => r.userId === null)).toBe(true)
  })
})

describe('canSeeName and displayName', () => {
  const own = new Set(['1'])
  const school = new Set(['1', '2'])
  it('canSeeName per role', () => {
    expect(canSeeName('student', '2', '2', own)).toBe(true)
    expect(canSeeName('student', '2', '1', own, school)).toBe(false)
    expect(canSeeName('teacher', 't', '1', own, school)).toBe(true)
    expect(canSeeName('teacher', 't', '2', own, school)).toBe(false)
    expect(canSeeName('school_admin', 'sa', '2', own, school)).toBe(true)
    expect(canSeeName('school_admin', 'sa', '3', own, school)).toBe(false)
    expect(canSeeName('school_admin', 'sa', '3', own)).toBe(true) // legacy: caller already school scoped
    expect(canSeeName('admin', 'a', '3', own, school)).toBe(true)
    expect(canSeeName('ppd_officer', 'o', '1', own, school)).toBe(false)
  })
  it('displayName: full when visible, else first name + last initial', () => {
    expect(displayName('Siti Nur Aini', true)).toBe('Siti Nur Aini')
    expect(displayName('Siti Nur Aini', false)).toBe('Siti A.')
    expect(displayName('Siti', false)).toBe('Siti')
  })
})

describe('resolveNameScope: batch reads, no N+1', () => {
  it('a teacher costs 2 reads and a school admin 1, whatever the number of pupils', async () => {
    const calls: string[] = []
    const spy = <T extends object>(target: T, names: (keyof T & string)[], prefix: string) => {
      for (const n of names) {
        const original = (target[n] as (...a: unknown[]) => unknown).bind(target)
        ;(target as Record<string, unknown>)[n] = (...a: unknown[]) => (calls.push(`${prefix}${n}`), original(...a))
      }
    }
    spy(w.classes, ['classesForTeacher', 'membersOf', 'classIdsOfStudents', 'classIdsOfStudent', 'memberIds'], '')
    spy(w.directory, ['users'], 'dir.')
    const ids = ['1', '2', '3', '4', '5', '6']
    const t = await resolveNameScope({ userId: 't1', role: 'teacher' as RoleCode }, ids, w.classes, w.directory)
    expect([...t.ownPupils]).toEqual(['1'])
    expect(calls).toEqual(['classesForTeacher', 'membersOf'])
    calls.length = 0
    const sa = await resolveNameScope({ userId: 'sa1', role: 'school_admin' as RoleCode }, ids, w.classes, w.directory)
    expect([...sa.schoolPupils].sort()).toEqual(['1', '2'])
    expect(calls).toEqual(['dir.users'])
    calls.length = 0
    await resolveNameScope({ userId: 'a1', role: 'admin' as RoleCode }, ids, w.classes, w.directory)
    await resolveNameScope({ userId: '1', role: 'student' as RoleCode }, ids, w.classes, w.directory)
    expect(calls).toEqual([])
  })
})
