/**
 * v2-secondary-only (D72, 2026-10-29): schools of a primary TYPE (SK, SJK(C), SJK(T)) and the people of
 * those schools are hidden from the admin lists, the filters and the search, by type and never by name
 * (AC-01.1, AC-06.2, AC-09.1). The rows stay stored; the switch restores them (reversible).
 */

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { MockRuntime } from '@/mock/index'

import { users } from '@/modules/m01-authentication/mock'

import { schools } from '../../mock'
import { schoolSubscriptionsRepo } from '../../mock/repository/subscriptions'
import { showPrimarySchools } from '../../mock/repository/schools'
import { ADMIN, bootM02, callAs } from './helpers'

interface Page<T> {
  data: T[]
  meta: { totalItems?: number; types?: string[]; counts?: { total: number } }
}

let runtime: MockRuntime
let call: ReturnType<typeof callAs>

beforeAll(async () => {
  runtime = await bootM02()
  call = callAs(runtime)
}, 120_000)

afterAll(async () => {
  showPrimarySchools(false)
  await runtime.reset()
})

describe('primary-type schools are hidden (default)', () => {
  it('the admin school list offers only secondary types and no SK filter', async () => {
    const res = await call<Page<{ type: string }>>('GET', '/api/admin/schools', ADMIN)
    expect(res.status).toBe(200)
    expect(res.body.data.every((s) => ['SMK', 'MRSM', 'SBP'].includes(s.type))).toBe(true)
    expect(res.body.meta.types).toEqual(['SMK'])
    const sk = await call<Page<unknown>>('GET', '/api/admin/schools?type=SK', ADMIN)
    expect(sk.body.data).toEqual([])
  })

  it('the school search and options never return a primary-type school', () => {
    // Non-vacuous: the primary school is stored, found by the same query once the switch is off.
    expect(schools.get(987)).toMatchObject({
      type: 'SK',
      name: 'SEKOLAH KEBANGSAAN BANDAR BARU BANGI',
    })
    expect(schools.search({ q: 'BANDAR BARU BANGI' }).map((s) => s.id)).not.toContain(987)
    showPrimarySchools()
    try {
      expect(schools.search({ q: 'BANDAR BARU BANGI' }).map((s) => s.id)).toContain(987)
    } finally {
      showPrimarySchools(false)
    }
    expect(schools.search({ q: 'SK Demo' }).some((s) => s.type === 'SK')).toBe(false)
    expect(schools.search({ limit: 500 }).some((s) => s.type !== 'SMK')).toBe(false)
    expect(schools.isHidden(900_002)).toBe(true)
    expect(schools.isHidden(900_001)).toBe(false)
  })

  it('the hidden fixture schools answer 404 on the admin screens', async () => {
    expect((await call('GET', '/api/admin/schools/900002', ADMIN)).status).toBe(404)
  })

  it('the admin user list and school filter do not show people of "SK Demo" schools', async () => {
    const list = await call<Page<{ school: { name: string } | null }>>(
      'GET',
      '/api/admin/users?page=1&pageSize=100',
      ADMIN,
    )
    expect(list.status).toBe(200)
    expect(list.body.data.length).toBeGreaterThan(0)
    expect(list.body.data.some((u) => /^SK /i.test(u.school?.name ?? ''))).toBe(false)
    // Positive: the re-homed demo pupil of SMK DEMO (account 4, Tingkatan 5) is listed.
    const demo = await call<Page<{ id: number; school: { id: number } | null }>>(
      'GET',
      '/api/admin/users?search=pelajarmaju@demo.test',
      ADMIN,
    )
    expect(demo.body.data.map((u) => [u.id, u.school?.id])).toEqual([[4, 900_001]])
    const filters = await call<{ data: { schools: { name: string }[] } }>(
      'GET',
      '/api/admin/users/filters',
      ADMIN,
    )
    expect(filters.body.data.schools.some((s) => /^SK /i.test(s.name))).toBe(false)
  })
})

describe('a hidden user answers "not found" on every by-id route (one predicate with the lists)', () => {
  it('3105 (grade 6) is hidden on every by-id route, 2 (Tingkatan 4) is not', async () => {
    // The premise: 3105 exists (stored) and is a Darjah 6 pupil; 2 is a Tingkatan 4 pupil.
    expect(users.get(3105)).toMatchObject({ role: 'student', grade: 6 })
    expect(users.get(2)).toMatchObject({ grade: 10 })
    expect((await call('GET', '/api/admin/users/3105', ADMIN)).status).toBe(404)
    expect((await call('PUT', '/api/admin/users/3105', ADMIN, {})).status).toBe(404)
    expect((await call('POST', '/api/admin/users/3105/toggle-active', ADMIN)).status).toBe(404)
    expect((await call('POST', '/api/admin/users/3105/impersonate', ADMIN)).status).toBe(404)
    expect((await call('DELETE', '/api/admin/users/3105', ADMIN)).status).toBe(404)
    expect((await call('GET', '/api/admin/users/2', ADMIN)).status).toBe(200)
  })
})

describe('the hiding is reversible', () => {
  it('shows the stored primary schools again when the switch is off', () => {
    const hidden = schools.counts().total
    showPrimarySchools()
    try {
      expect(schools.counts().total).toBeGreaterThan(hidden)
      expect(schools.isHidden(900_002)).toBe(false)
    } finally {
      showPrimarySchools(false)
    }
    expect(schools.counts().total).toBe(hidden)
  })
})

describe('school subscriptions (S12) hold secondary schools only', () => {
  it('every subscription row belongs to a secondary-type school, so no primary filter is needed', () => {
    const rows = schoolSubscriptionsRepo.all()
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(schools.isHidden(row.schoolId), `school ${String(row.schoolId)}`).toBe(false)
    }
  })
})
