/**
 * M21-T1: the `sponsors` store taken over from M17 (F-33) against M21 SRS v1.2 §6.2, §6.7, §6.8,
 * §6.11 A, §6.13: the observed seed and figures, ownership (`owner: 'M21'`, `provisional: false`),
 * the exposed contract, the empty anak-angkat / application stores, and the test hooks.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { defineMockModule, defineTable, floor } from '@/mock/define'
import { bootMock, type MockRuntime } from '@/mock/index'
import {
  checkRepositoryConventions,
  createRepositoryRegistry,
  repositoryInfo,
  RepositoryError,
} from '@/mock/repository'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import m21, { anakAngkat, fosterApplications, sponsors, sponsorship } from '../../mock'
import { m21Hooks } from '../../mock/hooks'
import { defineSponsorsRepo } from '../../mock/repository/sponsors'
import type { SponsorRow } from '../../mock/repository/types'

let runtime: MockRuntime

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m21],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 120_000)

beforeEach(async () => {
  await runtime.reset()
})

describe('Q-M21-SPONSOR-STATS / Q-M17-SPONSORS (taken over from M17)', () => {
  it('holds 6 sponsors, all suspended', () => {
    expect(sponsors.count('Q-M17-SPONSORS')).toBe(6)
    expect(sponsors.count('Q-M17-SPONSORS', 'APPROVED')).toBe(0)
    expect(sponsors.count('Q-M17-SPONSORS', 'PENDING')).toBe(0)
    expect(sponsors.count('Q-M17-SPONSORS', 'REJECTED')).toBe(0)
    expect(sponsors.count('Q-M17-SPONSORS', 'SUSPENDED')).toBe(6)
    expect(sponsors.statusCounts()).toEqual({
      total: 6,
      active: 0,
      pending: 0,
      rejected: 0,
      suspended: 6,
    })
  })

  it('uses the observed ids 6-11 and the M21 §6.11 A values', () => {
    const list = sponsors.list()
    expect(list.map((s) => s.id)).toEqual([6, 7, 8, 9, 10, 11])
    expect(list.every((s) => s.category === 'SYARIKAT_SWASTA' && s.status === 'SUSPENDED')).toBe(
      true,
    )
    expect(list.map((s) => s.userId)).toEqual([5501, 5502, 5503, 5504, 5505, 7])
    expect(list.map((s) => s.name)).toEqual([
      'Kedai Buku Popular',
      'Faber-Castell Malaysia',
      'KidZania Kuala Lumpur',
      'Petrosains Discovery Centre',
      'PRESTASIPLUS Official',
      'Alesa It Services',
    ])
    expect(list.slice(0, 5).every((s) => s.createdAt === '2026-02-06T12:00:00+08:00')).toBe(true)
    expect(sponsors.get(11)?.createdAt).toBe('2026-03-31T12:00:00+08:00')
  })

  it('keeps sponsor 11 contact person name empty (no person name is seeded)', () => {
    expect(sponsors.get(11)?.contactPersonName).toBeNull()
  })
})

describe('sponsor logins', () => {
  // Users 5503-5505 exist in the M02 users dataset today as students, not sponsors: XR-M21-01
  // (sponsor logins 5501-5505) is not applied in M02 yet. Delete entries when M02 lands XR-M21-01.
  const PENDING_XR_M21_01 = [5503, 5504, 5505]

  it('links every sponsor to a sponsor user, or to an id on the pending allow-list', () => {
    for (const s of sponsors.list()) {
      if (s.userId === null || PENDING_XR_M21_01.includes(s.userId)) continue
      expect(users.get(s.userId)?.role, 'sponsor ' + String(s.id)).toBe('sponsor')
    }
  })

  it('keeps the allow-list honest: its ids are not sponsor users yet', () => {
    // Fails when M02 lands XR-M21-01, which is the signal to delete the entries.
    for (const id of PENDING_XR_M21_01) expect(users.get(id)?.role).not.toBe('sponsor')
  })
})

describe('ownership (D12)', () => {
  it('records M21 as the owner, not provisional; the conventions pass', () => {
    for (const repo of [sponsors, anakAngkat, fosterApplications]) {
      expect(repositoryInfo(repo)).toMatchObject({ owner: 'M21', provisional: false })
    }
    expect(checkRepositoryConventions([m21])).toEqual([])
  })

  it('rejects a write from outside the repository (single owner)', () => {
    const tables = m21.tables as unknown as Record<string, { insert(row: unknown): unknown }>
    expect(() => tables.sponsors?.insert({ name: 'Tanpa kebenaran', status: 'APPROVED' })).toThrow(
      RepositoryError,
    )
  })

  it('the definition registers unchanged in either form (hosted or owned)', () => {
    for (const provisional of [true, false]) {
      const table = defineTable<SponsorRow>({
        name: `t.sponsors.${String(provisional)}`,
        ids: floor({ start: 12 }),
      })
      const repo = defineSponsorsRepo(table, { provisional, registry: createRepositoryRegistry() })
      expect(repositoryInfo(repo)).toMatchObject({ owner: 'M21', provisional })
      const issues = checkRepositoryConventions([
        defineMockModule({ id: 'M21', tables: { t: table }, repositories: { sponsors: repo } }),
      ])
      // Only the owner's own registration may be `provisional: false` (the hosted form is M17's).
      expect(issues).toEqual(
        provisional
          ? ["M21: repository 'sponsors' is provisional in its own owner; drop the flag"]
          : [],
      )
    }
  })
})

describe('contract sponsorship (§6.7)', () => {
  it('sponsorSummary() returns the unchanged M17 figures', () => {
    expect(sponsorship.sponsorSummary()).toEqual({
      total: 6,
      active: 0,
      pending: 0,
      rejected: 0,
      suspended: 6,
    })
  })

  it('sponsorForUser(userId) finds the linked sponsor, or null', () => {
    expect(sponsorship.sponsorForUser(7)?.id).toBe(11)
    expect(sponsorship.sponsorForUser(5501)?.id).toBe(6)
    expect(sponsorship.sponsorForUser(2)).toBeNull()
  })
})

describe('anak angkat and applications (seed deferred to M21-T3)', () => {
  it('start empty with the runtime ids of the SRS (3 and 4)', () => {
    expect(anakAngkat.tabs()).toEqual({ all: 0, active: 0, graduated: 0, withdrawn: 0, expired: 0 })
    expect(fosterApplications.tabs()).toEqual({ pending: 0, approved: 0, matched: 0, rejected: 0 })
    const a = fosterApplications.submit({
      studentId: 2,
      applicantUserId: 2,
      applicantRole: 'student',
      studentCategory: 'B40',
      familyIncomeRange: null,
      reason: 'x',
    })
    expect(a.id).toBe(4)
  })
})

describe('test hooks (§6.13)', () => {
  it('m21-many adds 19 suspended sponsors (ids 12-30); a reset discards them', async () => {
    m21Hooks.m21LoadFixture('m21-many')
    expect(sponsors.count('Q-M17-SPONSORS')).toBe(25)
    expect(sponsors.count('Q-M17-SPONSORS', 'SUSPENDED')).toBe(25)
    expect(sponsors.get(30)?.status).toBe('SUSPENDED')
    await runtime.reset()
    expect(sponsors.count('Q-M17-SPONSORS')).toBe(6)
  })

  it('m21-approved makes sponsor 6 APPROVED; m21-pending adds one PENDING sponsor', () => {
    m21Hooks.m21LoadFixture('m21-approved')
    expect(sponsorship.sponsorSummary()).toMatchObject({ active: 1, suspended: 5 })
    m21Hooks.m21LoadFixture('m21-pending')
    expect(sponsorship.sponsorSummary()).toMatchObject({ total: 7, pending: 1 })
  })

  it('rejects an unknown fixture; the mail log starts empty', () => {
    expect(() => m21Hooks.m21LoadFixture('nope')).toThrow(RangeError)
    expect(m21Hooks.m21MailLog()).toEqual([])
  })
})
