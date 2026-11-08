/**
 * Seed clock split (S0-T02, ADR-0006 Amendment 3, #481): the demo profile `poc` dates seed rows from the run date; every other profile
 * keeps SEED_NOW exactly. Unit part: the helper. Database part: the same full `poc` seed run twice, once as the tests run it (no run
 * date: fixed) and once with an injected run date; the dated rows must be the fixed ones moved by whole days, and the 7/30-day windows
 * of the demo run must be non-empty.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mytDay, RUN_DATE_SEED_PROFILES, SEED_NOW, seedClockFor, seedRunAt, startOfMytDay } from '../../src/db/clock'
import { runSeeds, seedModules, UAT_LIKE_PROFILE } from '../../prisma/seed'
import { seedUuid } from '../../prisma/seed/battle'
import { DEMO_WALLETS } from '../../prisma/seed/wallet'
import { createTestDatabase, type TestDatabase } from '../support/db'

const DAY = 86_400_000
const RUN_AT = new Date('2026-11-05T11:20:00+08:00')
const ENV = { NODE_ENV: 'test' }

describe('seedClockFor', () => {
  it('keeps SEED_NOW with a zero shift for every CI profile, with or without a run date', () => {
    for (const profile of [UAT_LIKE_PROFILE, 'e2e', 'test', 'other', 'poc']) {
      for (const runAt of profile === 'poc' ? [undefined] : [undefined, RUN_AT]) {
        const d = seedClockFor(profile, runAt)
        expect(d.shiftMs).toBe(0)
        expect(d.clock.now().toISOString()).toBe(new Date(SEED_NOW).toISOString())
        for (const iso of ['2026-02-11T05:23:00+08:00', '2026-09-20T00:00:00.000Z', '2026-08-14T00:00:00Z']) {
          expect(d.date(iso).getTime()).toBe(new Date(iso).getTime())
          expect(d.weekDate(iso).getTime()).toBe(new Date(iso).getTime())
        }
      }
    }
  })

  it('lists only poc as a run-date profile', () => {
    expect([...RUN_DATE_SEED_PROFILES]).toEqual(['poc'])
  })

  it('moves the demo clock to the run day, same time of day, by whole days', () => {
    const d = seedClockFor('poc', RUN_AT)
    expect(mytDay(d.clock.now())).toBe('2026-11-05')
    expect(d.clock.now().getTime() - startOfMytDay(d.clock.now()).getTime()).toBe(new Date(SEED_NOW).getTime() - startOfMytDay(new Date(SEED_NOW)).getTime())
    expect(d.shiftMs % DAY).toBe(0)
    expect(d.shiftMs).toBe(41 * DAY)
    expect(d.date('2026-09-22T19:00:00+08:00').toISOString()).toBe(new Date(Date.parse('2026-09-22T19:00:00+08:00') + 41 * DAY).toISOString())
  })

  it('shifts week starts by whole weeks so a Monday stays a Monday and the latest week contains the clock', () => {
    const d = seedClockFor('poc', RUN_AT)
    const monday = d.weekDate('2026-09-21T00:00:00.000Z')
    expect(monday.getUTCDay()).toBe(1)
    expect(monday.getTime()).toBeLessThanOrEqual(d.clock.now().getTime())
    expect(d.clock.now().getTime() - monday.getTime()).toBeLessThan(7 * DAY)
  })
})

interface Snap {
  ledger: Date[]
  wallets: Date[]
  battles: Date[]
  pksk: Date[]
  masteryAt: Date[]
  weeks: string[]
  leagues: Date[]
}

async function snap(db: TestDatabase): Promise<Snap> {
  const col = async (sql: string): Promise<Date[]> => (await db.query<{ t: Date }>(sql)).map((r) => r.t)
  return {
    ledger: await col(`select created_at as t from coin_ledger order by id`),
    wallets: await col(`select created_at as t from wallets order by id`),
    battles: await col(`select created_at as t from battles order by id`),
    pksk: await col(`select granted_at as t from pksk_accesses order by id`),
    masteryAt: await col(`select created_at as t from pksk_mastery order by id`).catch(() => []),
    weeks: (await db.query<{ t: string }>(`select to_char(week_start,'YYYY-MM-DD') as t from sekolah_bersaing_weeks order by id`)).map((r) => r.t),
    leagues: await col(`select created_at as t from leagues order by id`),
  }
}

describe('seedRunAt (SEED_CLOCK opt-in)', () => {
  const now = () => new Date('2026-11-05T09:00:00Z')

  it('unset SEED_CLOCK gives no run date, so poc keeps SEED_NOW', () => {
    const runAt = seedRunAt({}, now)
    expect(runAt).toBeUndefined()
    const dates = seedClockFor('poc', runAt)
    expect(dates.shiftMs).toBe(0)
    expect(dates.clock.now().getTime()).toBe(new Date(SEED_NOW).getTime())
  })

  it('SEED_CLOCK=fixed or any other value also keeps SEED_NOW', () => {
    for (const value of ['fixed', '', 'RUNDATE', 'run-date', 'true']) {
      expect(seedRunAt({ SEED_CLOCK: value }, now)).toBeUndefined()
    }
  })

  it('only SEED_CLOCK=rundate returns the real run time', () => {
    expect(seedRunAt({ SEED_CLOCK: 'rundate' }, now)?.toISOString()).toBe('2026-11-05T09:00:00.000Z')
  })
})

describe('poc seed, fixed versus run-date (database)', () => {
  let fixedDb: TestDatabase
  let demoDb: TestDatabase
  let fixed: Snap
  let demo: Snap

  beforeAll(async () => {
    fixedDb = await createTestDatabase()
    demoDb = await createTestDatabase()
    await runSeeds(seedModules, { prisma: fixedDb.prisma, profile: 'poc', env: ENV })
    await runSeeds(seedModules, { prisma: demoDb.prisma, profile: 'poc', env: ENV, runAt: RUN_AT })
    fixed = await snap(fixedDb)
    demo = await snap(demoDb)
  }, 480_000)
  afterAll(async () => {
    await fixedDb?.drop()
    await demoDb?.drop()
  })

  it('without a run date (how every test seeds) the rows carry exactly the literal dates', async () => {
    const wanted = DEMO_WALLETS.find((w) => w.email === 'pelajar@demo.test')!
    const rows = await fixedDb.query<{ t: Date }>(
      `select l.created_at as t from coin_ledger l join users u on u.id = l.user_id where u.email = 'pelajar@demo.test' order by l.id`,
    )
    expect(rows.map((r) => r.t.toISOString())).toEqual(wanted.ledger.map(([at]) => new Date(at).toISOString()))
    expect(fixed.weeks.sort()).toContain('2026-09-21')
    const [b1] = await fixedDb.query<{ t: Date }>(`select created_at as t from battles where id = $1`, [seedUuid(1)])
    expect(b1?.t.getTime()).toBe(Date.parse('2026-07-20T21:58:00+08:00'))
  })

  it('with a run date every dated row is the fixed one moved by the same whole days', () => {
    const shift = seedClockFor('poc', RUN_AT).shiftMs
    for (const k of ['ledger', 'wallets', 'battles', 'pksk', 'masteryAt', 'leagues'] as const) {
      expect(demo[k].length, k).toBe(fixed[k].length)
      expect(demo[k].map((d) => d.getTime()), k).toEqual(fixed[k].map((d) => d.getTime() + shift))
    }
    expect(demo.ledger.length).toBeGreaterThan(0)
    expect(demo.weeks.length).toBe(fixed.weeks.length)
    expect(demo.weeks.every((w) => new Date(`${w}T00:00:00Z`).getUTCDay() === 1)).toBe(true)
  })

  it('the 7-day and 30-day windows over the demo run are non-empty', async () => {
    const now = seedClockFor('poc', RUN_AT).clock.now()
    for (const days of [7, 30]) {
      const from = new Date(now.getTime() - days * DAY)
      // Wallet ledger (observed Sep 22-25 relative to SEED_NOW) and game sessions (clock-relative) both fall in the windows.
      for (const [table, col] of [['coin_ledger', 'created_at'], ['game_sessions', 'created_at']] as const) {
        const [r] = await demoDb.query<{ n: string }>(`select count(*) n from ${table} where ${col} >= $1 and ${col} <= $2`, [from, now])
        expect(Number(r?.n), `${table} ${String(days)}d`).toBeGreaterThan(0)
      }
    }
    const [m] = await demoDb.query<{ n: string }>(`select count(*) n from coin_ledger where created_at >= $1`, [startOfMytDay(new Date(now.getTime() - 3 * DAY))])
    expect(Number(m?.n)).toBeGreaterThan(0)
  })
})
