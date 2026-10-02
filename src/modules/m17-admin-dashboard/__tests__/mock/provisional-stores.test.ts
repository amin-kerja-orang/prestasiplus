/**
 * F-33: the provisional stores hosted in M17 (mood check-ins and tuition centres, owner M26;
 * sponsors, owner M21) against M17 SRS §6.4 (Q-M17-MOOD, Q-M17-TUITION, Q-M17-SPONSORS), XR-M17-16/17/18
 * and M21 SRS §6.11 A.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { defineTable, floor, defineMockModule } from '@/mock/define'
import { bootMock } from '@/mock/index'
import {
  assertRepositoryConventions,
  checkRepositoryConventions,
  createRepositoryRegistry,
  repositoryInfo,
  RepositoryError,
} from '@/mock/repository'
import { fnv1a32 } from '@/mock/determinism/hash'
import m01, { users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import m17, { moodCheckins, sponsors, tuitionCentres } from '../../mock'
import { defineMoodCheckinsRepo } from '../../mock/repository/provisional-mood'
import { defineSponsorsRepo } from '../../mock/repository/provisional-sponsors'
import { defineTuitionCentresRepo } from '../../mock/repository/provisional-tuition'
import type {
  MoodCheckinRow,
  SponsorRow,
  TuitionCentreRow,
} from '../../mock/repository/provisional-types'
import { EXCLUDED_MOOD_USERS } from '../../mock/seeds/provisional-data'

async function boot(plugins: NonNullable<Parameters<typeof bootMock>[0]>['plugins']) {
  await bootMock({
    mode: 'test',
    plugins,
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}

/** Hash of all 750 seeded check-ins (ids 1-750, every field). */
function moodHash(): number {
  const rows = Array.from({ length: 750 }, (_, i) => moodCheckins.get(i + 1))
  return fnv1a32(JSON.stringify(rows))
}

let firstBootHash = 0

beforeAll(async () => {
  await boot([m01, m02, m17])
  firstBootHash = moodHash()
}, 120_000)

describe('Q-M17-MOOD (M26, provisional; XR-M17-18)', () => {
  it('holds 750 check-ins: happy 307, okay 280, sad 72, stressed 91', () => {
    expect(moodCheckins.count('Q-M17-MOOD')).toBe(750)
    expect(moodCheckins.count('Q-M17-MOOD', 'happy')).toBe(307)
    expect(moodCheckins.count('Q-M17-MOOD', 'okay')).toBe(280)
    expect(moodCheckins.count('Q-M17-MOOD', 'sad')).toBe(72)
    expect(moodCheckins.count('Q-M17-MOOD', 'stressed')).toBe(91)
    expect(moodCheckins.countByMood()).toEqual({ happy: 307, okay: 280, sad: 72, stressed: 91 })
    expect(moodCheckins.total()).toBe(750)
  })

  it('has every check-in before 1 Sep 2026, so the month window (Sep 2026) is 0', () => {
    const month = { from: '2026-09-01', to: '2026-09-30' }
    expect(moodCheckins.total(month)).toBe(0)
    expect(moodCheckins.countByMood(month)).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect(moodCheckins.total({ to: '2026-08-31' })).toBe(750)
  })

  it('has no check-in in the 30 days before the clock (Sep 25 2026)', () => {
    expect(moodCheckins.total({ from: '2026-08-26' })).toBe(0)
  })

  it('has none for pupil 2022 (S6 "-", S7 "Tiada data mood")', () => {
    expect(moodCheckins.total(undefined, 2022)).toBe(0)
    expect(moodCheckins.forUser(2022)).toEqual([])
    expect(moodCheckins.latestForUser(2022)).toBeUndefined()
    for (const id of EXCLUDED_MOOD_USERS) expect(moodCheckins.total(undefined, id)).toBe(0)
  })

  it('has ids 1-750 and INFERRED dates inside 2026-01-05 … 2026-08-14', () => {
    expect(moodCheckins.get(1)?.date).toMatch(/^2026-0[1-8]-\d{2}$/)
    expect(moodCheckins.get(750)).toBeDefined()
    expect(moodCheckins.get(751)).toBeUndefined()
    expect(moodCheckins.total({ from: '2026-01-05', to: '2026-08-14' })).toBe(750)
  })

  it('adds a runtime check-in outside the seeded ids', () => {
    const row = moodCheckins.add({ userId: 3009, mood: 'sad', reason: 'Ujian', date: '2026-09-25' })
    expect(row.id).toBeGreaterThan(750)
    expect(moodCheckins.count('Q-M17-MOOD')).toBe(751)
    expect(moodCheckins.latestForUser(3009)?.id).toBe(row.id)
  })
})

describe('determinism and boot safety', () => {
  it('seeds the same 750 rows on a second boot (hash of every row)', async () => {
    expect(firstBootHash).not.toBe(fnv1a32('[]'))
    await boot([m01, m02, m17])
    expect(moodHash()).toBe(firstBootHash)
  }, 120_000)

  it('boots without M02 (M17 depends on core and M01 only)', async () => {
    await boot([m01, m17])
    expect(moodCheckins.total()).toBe(750)
    expect(sponsors.count('Q-M17-SPONSORS')).toBe(6)
    expect(tuitionCentres.count('Q-M17-TUITION')).toBe(2)
  }, 120_000)
})

describe('Q-M17-TUITION (M26, provisional; XR-M17-17)', () => {
  it('holds the 2 observed centres', () => {
    expect(tuitionCentres.count('Q-M17-TUITION')).toBe(2)
    expect(tuitionCentres.list()).toEqual([
      {
        id: 1,
        name: 'Pusat Tuisyen Demo PrestasiPlus',
        city: 'Johor Bahru',
        state: 'Johor',
        activePupils: 18,
      },
      { id: 2, name: 'Alesa IT Tuisyen', city: 'KLUANG', state: 'Johor', activePupils: 0 },
    ])
  })
})

describe('Q-M17-SPONSORS (M21, provisional; XR-M17-16)', () => {
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
})

describe('sponsor logins', () => {
  // Users 5503-5505 exist in the M02 users dataset today as students, not sponsors: M21 XR-M21-01
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

  it('keeps sponsor 11 contact person name empty (no person name is seeded)', () => {
    expect(sponsors.get(11)?.contactPersonName).toBeNull()
  })
})

describe('registration and ownership (D12)', () => {
  it('records the true owner and the provisional flag; the conventions pass', () => {
    expect(repositoryInfo(moodCheckins)).toMatchObject({ owner: 'M26', provisional: true })
    expect(repositoryInfo(tuitionCentres)).toMatchObject({ owner: 'M26', provisional: true })
    expect(repositoryInfo(sponsors)).toMatchObject({ owner: 'M21', provisional: true })
    expect(checkRepositoryConventions([m17])).toEqual([])
    expect(() => {
      assertRepositoryConventions([m17])
    }).not.toThrow()
  })

  it('rejects a write from outside the repository (single owner)', () => {
    const table = m17.tables.sponsors as unknown as { insert(row: unknown): unknown }
    expect(() => table.insert({ name: 'Tanpa kebenaran', status: 'APPROVED' })).toThrow(
      RepositoryError,
    )
  })
})

describe('move to the owner (overview §6.7.2)', () => {
  it('the same definition is registered by the owner plugin unchanged', () => {
    const registry = createRepositoryRegistry()
    const make = (provisional: boolean) => {
      const mood = defineTable<MoodCheckinRow>({
        name: `t.mood.${String(provisional)}`,
        ids: floor({ start: 9_000_001 }),
      })
      const tuition = defineTable<TuitionCentreRow>({
        name: `t.tuition.${String(provisional)}`,
        ids: floor({ start: 3 }),
      })
      const sponsor = defineTable<SponsorRow>({
        name: `t.sponsors.${String(provisional)}`,
        ids: floor({ start: 12 }),
      })
      const reg = provisional ? registry : createRepositoryRegistry()
      const opts = { provisional, registry: reg }
      return {
        tables: { mood, tuition, sponsor },
        repos: {
          moodCheckins: defineMoodCheckinsRepo(mood, opts),
          tuitionCentres: defineTuitionCentresRepo(tuition, opts),
          sponsors: defineSponsorsRepo(sponsor, opts),
        },
      }
    }
    const hosted = make(true)
    const moved = make(false)

    // Before: M17 hosts all three. After: M26 owns two, M21 owns one, M17 registers none.
    expect(
      checkRepositoryConventions([
        defineMockModule({
          id: 'M17',
          tables: { a: hosted.tables.mood, b: hosted.tables.tuition, c: hosted.tables.sponsor },
          repositories: hosted.repos,
        }),
      ]),
    ).toEqual([])
    expect(
      checkRepositoryConventions([
        defineMockModule({ id: 'M17' }),
        defineMockModule({
          id: 'M21',
          tables: { sponsor: moved.tables.sponsor },
          repositories: { sponsors: moved.repos.sponsors },
        }),
        defineMockModule({
          id: 'M26',
          tables: { mood: moved.tables.mood, tuition: moved.tables.tuition },
          repositories: {
            moodCheckins: moved.repos.moodCheckins,
            tuitionCentres: moved.repos.tuitionCentres,
          },
        }),
      ]),
    ).toEqual([])

    // The contract behaves the same in both places.
    for (const set of [hosted, moved]) {
      set.repos.tuitionCentres.seed([{ id: 1, name: 'X', city: 'A', state: 'B', activePupils: 3 }])
      set.repos.moodCheckins.seed([
        { id: 1, userId: 9, mood: 'sad', reason: null, date: '2026-01-05' },
      ])
      expect(set.repos.tuitionCentres.count('Q-M17-TUITION')).toBe(1)
      expect(set.repos.moodCheckins.countByMood().sad).toBe(1)
    }
    expect(repositoryInfo(hosted.repos.sponsors)).toMatchObject({ owner: 'M21', provisional: true })
    expect(repositoryInfo(moved.repos.sponsors)).toMatchObject({ owner: 'M21', provisional: false })
  })
})
