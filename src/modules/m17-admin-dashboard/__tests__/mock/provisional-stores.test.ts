/**
 * F-33: the provisional stores hosted in M17 (mood check-ins and tuition centres, owner M26) against
 * M17 SRS §6.4 (Q-M17-MOOD, Q-M17-TUITION), XR-M17-17/18. The sponsors store moved to M21 (M21-T1);
 * its tests are in `m21-sponsorship/__tests__/mock/sponsors.test.ts`; here only the contract
 * `sponsorship.sponsorSummary()` that Q-M17-SPONSORS reads is asserted.
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
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m21, { sponsorship } from '@/modules/m21-sponsorship/mock'

import m17, { moodCheckins, tuitionCentres } from '../../mock'
import { defineMoodCheckinsRepo } from '../../mock/repository/provisional-mood'
import { defineTuitionCentresRepo } from '../../mock/repository/provisional-tuition'
import type {
  MoodCheckinRow,
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

describe('Q-M17-SPONSORS through the M21 contract (XR-M21-03)', () => {
  it('reads the unchanged figures from sponsorship.sponsorSummary()', async () => {
    await boot([m01, m02, m17, m21])
    expect(sponsorship.sponsorSummary()).toEqual({
      total: 6,
      active: 0,
      pending: 0,
      rejected: 0,
      suspended: 6,
    })
  }, 120_000)
})

describe('registration and ownership (D12)', () => {
  it('records the true owner and the provisional flag; the conventions pass', () => {
    expect(repositoryInfo(moodCheckins)).toMatchObject({ owner: 'M26', provisional: true })
    expect(repositoryInfo(tuitionCentres)).toMatchObject({ owner: 'M26', provisional: true })
    expect(checkRepositoryConventions([m17])).toEqual([])
    expect(() => {
      assertRepositoryConventions([m17])
    }).not.toThrow()
  })

  it('rejects a write from outside the repository (single owner)', () => {
    const table = m17.tables.tuitionCentres as unknown as { insert(row: unknown): unknown }
    expect(() => table.insert({ name: 'Tanpa kebenaran', city: 'X', state: 'Y', activePupils: 1 })).toThrow(
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
      const reg = provisional ? registry : createRepositoryRegistry()
      const opts = { provisional, registry: reg }
      return {
        tables: { mood, tuition },
        repos: {
          moodCheckins: defineMoodCheckinsRepo(mood, opts),
          tuitionCentres: defineTuitionCentresRepo(tuition, opts),
        },
      }
    }
    const hosted = make(true)
    const moved = make(false)

    // Before: M17 hosts both. After: M26 owns both, M17 registers none (sponsors moved to M21, M21-T1).
    expect(
      checkRepositoryConventions([
        defineMockModule({
          id: 'M17',
          tables: { a: hosted.tables.mood, b: hosted.tables.tuition },
          repositories: hosted.repos,
        }),
      ]),
    ).toEqual([])
    expect(
      checkRepositoryConventions([
        defineMockModule({ id: 'M17' }),
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
    expect(repositoryInfo(hosted.repos.tuitionCentres)).toMatchObject({
      owner: 'M26',
      provisional: true,
    })
    expect(repositoryInfo(moved.repos.tuitionCentres)).toMatchObject({
      owner: 'M26',
      provisional: false,
    })
  })
})
