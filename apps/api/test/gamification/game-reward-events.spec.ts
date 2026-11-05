import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { capGameReward } from '../../src/modules/gamification/helpers'
import { bareUser, bootGamificationApp, ledgerOf, walletOf, type GamificationTestApp } from './helpers'

/** DM-87, FR-GM-00.6, 48 section 3.4 rules 4 and 6, on `GamificationService.onGameResult`. Real Postgres. */
describe('game reward events', () => {
  let t: GamificationTestApp
  let sequence = 0

  const session = (gameKey = 'betul-salah') => ({ id: `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, gameKey })
  const finish = (xp: number, coins: number, s = session()) => ({ game: 'betul_salah', event: 'finish', coins, xp, correct: 3, total: 5, detail: { maxStreak: 2 }, session: s })
  const setting = (key: string, value: number) => t.db.query(`update gamification_settings set value = $1 where key = $2`, [value, key])
  const eventsOf = (userId: string) =>
    t.db.query<{ game_session_id: string; xp: number; syiling: number; capped_reason: string | null }>(
      `select game_session_id::text, xp, syiling, capped_reason from game_reward_events where user_id = $1::bigint order by id`,
      [userId],
    )
  /** MYT noon of the test day, so that a case stays inside one Malaysia day. */
  const NOON = new Date('2026-10-20T04:00:00Z')

  beforeAll(async () => {
    t = await bootGamificationApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    await setting('games_award_syiling', 1)
    await t.db.query(`update gamification_settings set value = 500 where key = 'games_daily_xp_cap'`)
    await t.db.query(`update gamification_settings set value = 100 where key = 'games_daily_syiling_cap'`)
    t.clock.set(NOON)
  })

  describe('capGameReward', () => {
    const caps = { xp: 500, syiling: 100 }

    it('below both caps: all of it, no reason', () => {
      expect(capGameReward({ xp: 30, syiling: 10 }, { xp: 0, syiling: 0 }, caps)).toEqual({ xp: 30, syiling: 10, cappedReason: null })
    })
    it('exactly reaching a cap is not capped', () => {
      expect(capGameReward({ xp: 30, syiling: 10 }, { xp: 470, syiling: 90 }, caps)).toEqual({ xp: 30, syiling: 10, cappedReason: null })
    })
    it('the part over a cap is not credited, each cap with its reason', () => {
      expect(capGameReward({ xp: 30, syiling: 1 }, { xp: 490, syiling: 0 }, caps)).toEqual({ xp: 10, syiling: 1, cappedReason: 'xp_cap' })
      expect(capGameReward({ xp: 1, syiling: 10 }, { xp: 0, syiling: 95 }, caps)).toEqual({ xp: 1, syiling: 5, cappedReason: 'syiling_cap' })
      expect(capGameReward({ xp: 30, syiling: 10 }, { xp: 500, syiling: 100 }, caps)).toEqual({ xp: 0, syiling: 0, cappedReason: 'xp_and_syiling_cap' })
    })
    it('asking for nothing at the cap is not capped', () => {
      expect(capGameReward({ xp: 0, syiling: 0 }, { xp: 500, syiling: 100 }, caps)).toEqual({ xp: 0, syiling: 0, cappedReason: null })
    })
    it('a cap lowered below what was earned leaves nothing, and never a negative amount', () => {
      expect(capGameReward({ xp: 5, syiling: 5 }, { xp: 90, syiling: 90 }, { xp: 50, syiling: 50 })).toEqual({ xp: 0, syiling: 0, cappedReason: 'xp_and_syiling_cap' })
    })
  })

  describe('replay (AC-GM-00.3)', () => {
    it('the same session and pupil: one event row, one ledger row, the first result', async () => {
      const u = await bareUser(t, 'Ulang Main')
      const s = session()
      const first = await t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })
      expect(first).toEqual({ coinsCredited: 9, xpAdded: 40, cappedReason: null })
      expect(await t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })).toEqual(first)
      // a repeat with other amounts is still the first result
      expect(await t.gamification.onGameResult(u, finish(99, 77, s), { isTest: false })).toEqual(first)
      expect(await eventsOf(u)).toEqual([{ game_session_id: s.id, xp: 40, syiling: 9, capped_reason: null }])
      const ledger = await ledgerOf(t, u)
      expect(ledger).toHaveLength(1)
      expect(ledger[0]).toMatchObject({ type: 'earn', source: 'game:betul-salah', source_id: `game:${s.id}`, amount: 9, description: 'Betul/Salah: 3 betul, streak 2', is_test: false })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 9, xp: 40 })
    })

    it('a replay on a later day still answers the first result and credits nothing', async () => {
      const u = await bareUser(t, 'Ulang Esok')
      const s = session()
      const first = await t.gamification.onGameResult(u, finish(10, 2, s), { isTest: false })
      t.clock.advance(3 * 86_400_000)
      expect(await t.gamification.onGameResult(u, finish(10, 2, s), { isTest: false })).toEqual(first)
      expect(await eventsOf(u)).toHaveLength(1)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 2, xp: 10 })
    })

    it('a capped first result is what the replay answers', async () => {
      const u = await bareUser(t, 'Ulang Had')
      await setting('games_daily_xp_cap', 5)
      const s = session()
      const first = await t.gamification.onGameResult(u, finish(40, 0, s), { isTest: false })
      expect(first).toEqual({ coinsCredited: 0, xpAdded: 5, cappedReason: 'xp_cap' })
      expect(await t.gamification.onGameResult(u, finish(40, 0, s), { isTest: false })).toEqual(first)
      expect(await walletOf(t, u)).toMatchObject({ xp: 5 })
    })

    it('another pupil in the same session, or another session of the pupil, is its own event', async () => {
      const [u, other] = [await bareUser(t, 'Bilik Satu'), await bareUser(t, 'Bilik Dua')]
      const s = session('benteng-ilmu')
      await t.gamification.onGameResult(u, { game: 'benteng_ilmu', event: 'win', coins: 8, xp: 0, session: s }, { isTest: false })
      await t.gamification.onGameResult(other, { game: 'benteng_ilmu', event: 'play', coins: 3, xp: 0, session: s }, { isTest: false })
      await t.gamification.onGameResult(u, { game: 'benteng_ilmu', event: 'play', coins: 3, xp: 0, session: session('benteng-ilmu') }, { isTest: false })
      expect(await eventsOf(u)).toHaveLength(2)
      expect(await eventsOf(other)).toHaveLength(1)
      expect((await ledgerOf(t, other))[0]).toMatchObject({ source: 'game:benteng-ilmu', source_id: `game:${s.id}`, amount: 3, description: 'Penyertaan Benteng Ilmu' })
    })
  })

  describe('concurrency', () => {
    it('simultaneous reports for one session and pupil: one row, one credit, the first result for all', async () => {
      const u = await bareUser(t, 'Serentak')
      const s = session()
      const out = await Promise.all(Array.from({ length: 6 }, () => t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })))
      expect(out).toEqual(Array.from({ length: 6 }, () => ({ coinsCredited: 9, xpAdded: 40, cappedReason: null })))
      expect(await eventsOf(u)).toHaveLength(1)
      expect(await ledgerOf(t, u)).toHaveLength(1)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 9, xp: 40 })
    })

    it('parallel games of one pupil cannot pass a daily cap together', async () => {
      const u = await bareUser(t, 'Serentak Had')
      await setting('games_daily_xp_cap', 100)
      await setting('games_daily_syiling_cap', 50)
      const out = await Promise.all(Array.from({ length: 6 }, () => t.gamification.onGameResult(u, finish(30, 20), { isTest: false })))
      expect(out.reduce((n, r) => n + r.xpAdded, 0)).toBe(100)
      expect(out.reduce((n, r) => n + r.coinsCredited, 0)).toBe(50)
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 50, xp: 100 })
      expect(await eventsOf(u)).toHaveLength(6)
    })
  })

  describe('one transaction', () => {
    it('a failed credit leaves no event row and no XP, and the retry pays', async () => {
      const u = await bareUser(t, 'Gagal Kredit')
      const s = session()
      const credit = vi.spyOn(t.wallet, 'credit').mockRejectedValueOnce(new Error('credit fails'))
      await expect(t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })).rejects.toThrow('credit fails')
      credit.mockRestore()
      expect(await eventsOf(u)).toEqual([])
      expect(await walletOf(t, u)).toBeUndefined()
      expect(await t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })).toEqual({ coinsCredited: 9, xpAdded: 40, cappedReason: null })
    })

    it('inside a rolled-back caller transaction nothing is kept', async () => {
      const u = await bareUser(t, 'Undur Permainan')
      await expect(
        t.prisma.transaction(async (tx) => {
          await t.gamification.onGameResult(u, finish(40, 9), { isTest: false, tx })
          throw new Error('caller fails after the report')
        }),
      ).rejects.toThrow('caller fails')
      expect(await eventsOf(u)).toEqual([])
      expect(await ledgerOf(t, u)).toEqual([])
    })
  })

  describe('syiling off', () => {
    it('with games_award_syiling off the event records the XP and 0 syiling, and no ledger row', async () => {
      const u = await bareUser(t, 'Tanpa Syiling')
      await setting('games_award_syiling', 0)
      const s = session()
      expect(await t.gamification.onGameResult(u, finish(40, 9, s), { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 40, cappedReason: null })
      expect(await eventsOf(u)).toEqual([{ game_session_id: s.id, xp: 40, syiling: 0, capped_reason: null }])
      expect(await ledgerOf(t, u)).toEqual([])
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 0, xp: 40 })
    })

    it('a pupil with coins disabled: the same', async () => {
      const u = await bareUser(t, 'Tajaan')
      await t.db.query(`update users set is_complimentary = true where id = $1::bigint`, [u])
      expect(await t.gamification.onGameResult(u, finish(5, 9), { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 5, cappedReason: null })
      expect(await ledgerOf(t, u)).toEqual([])
    })

    it('papan_bijak without coins pays the tier rate, under the caps', async () => {
      const u = await bareUser(t, 'Papan Had')
      await setting('games_daily_syiling_cap', 3)
      const out = await t.gamification.onGameResult(u, { game: 'papan_bijak', event: 'correct', xp: 0, session: session('papan-bijak') }, { isTest: false })
      expect(out).toEqual({ coinsCredited: 3, xpAdded: 0, cappedReason: 'syiling_cap' }) // bronze: 5 a correct answer
      expect((await ledgerOf(t, u))[0]).toMatchObject({ source: 'game:papan-bijak', amount: 3, description: 'Jawab betul dalam Papan Bijak 🎲' })
    })
  })

  describe('daily caps (48 section 3.4 rule 4)', () => {
    it('AC-GM-00.5: a pupil with 500 game XP today wins another game: 0 XP added, the event says why', async () => {
      const u = await bareUser(t, 'Lima Ratus')
      await t.gamification.onGameResult(u, finish(500, 0), { isTest: false })
      const s = session()
      expect(await t.gamification.onGameResult(u, { game: 'betul_salah', event: 'win', coins: 0, xp: 90, session: s }, { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 0, cappedReason: 'xp_cap' })
      expect(await walletOf(t, u)).toMatchObject({ xp: 500 })
      expect((await eventsOf(u)).at(-1)).toEqual({ game_session_id: s.id, xp: 0, syiling: 0, capped_reason: 'xp_cap' })
    })

    it('a pupil at the syiling cap: no ledger row, a recorded event with the reason, XP still paid', async () => {
      const u = await bareUser(t, 'Had Syiling')
      await t.gamification.onGameResult(u, finish(0, 100), { isTest: false })
      const s = session()
      expect(await t.gamification.onGameResult(u, finish(10, 20, s), { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 10, cappedReason: 'syiling_cap' })
      expect(await ledgerOf(t, u)).toHaveLength(1)
      expect((await eventsOf(u)).at(-1)).toEqual({ game_session_id: s.id, xp: 10, syiling: 0, capped_reason: 'syiling_cap' })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 100, xp: 10 })
    })

    it('near both caps only the rest is credited, and the ledger holds the capped amount', async () => {
      const u = await bareUser(t, 'Hampir Had')
      await t.gamification.onGameResult(u, finish(490, 95), { isTest: false })
      const s = session()
      expect(await t.gamification.onGameResult(u, finish(30, 10, s), { isTest: false })).toEqual({ coinsCredited: 5, xpAdded: 10, cappedReason: 'xp_and_syiling_cap' })
      expect((await ledgerOf(t, u)).at(-1)).toMatchObject({ source_id: `game:${s.id}`, amount: 5 })
      expect(await walletOf(t, u)).toMatchObject({ current_syiling: 100, xp: 500 })
    })

    it('all games count together; other credits and a result without a session do not', async () => {
      const u = await bareUser(t, 'Semua Permainan')
      await setting('games_daily_syiling_cap', 10)
      await t.wallet.credit({ userId: u, amount: 500, source: 'daily_challenge', sourceId: 'challenge:x', description: 'Cabaran selesai', isTest: false })
      await t.gamification.onGameResult(u, { game: 'roda_nasib', event: 'spin', coins: 20, xp: 0, key: 'spin:2026-10-20' }, { isTest: false })
      expect((await t.gamification.onGameResult(u, finish(0, 6, session('betul-salah')), { isTest: false })).coinsCredited).toBe(6)
      expect((await t.gamification.onGameResult(u, { game: 'jutawan', event: 'finish', coins: 6, xp: 0, session: session('jutawan') }, { isTest: false })).coinsCredited).toBe(4)
    })

    it('the caps are per pupil', async () => {
      const [u, other] = [await bareUser(t, 'Had Seorang'), await bareUser(t, 'Had Lain')]
      await t.gamification.onGameResult(u, finish(500, 100), { isTest: false })
      expect(await t.gamification.onGameResult(other, finish(5, 5), { isTest: false })).toEqual({ coinsCredited: 5, xpAdded: 5, cappedReason: null })
    })

    it('the MYT day decides: 23:59 +08:00 is full, 00:00 +08:00 starts again, and UTC midnight starts nothing', async () => {
      const u = await bareUser(t, 'Tengah Malam')
      const at = (iso: string) => ({ isTest: false, at: new Date(iso) })
      await t.gamification.onGameResult(u, finish(500, 0), at('2026-10-20T01:00:00Z')) // 09:00 MYT on the 20th
      expect((await t.gamification.onGameResult(u, finish(5, 0), at('2026-10-20T15:59:59Z'))).xpAdded).toBe(0) // 23:59:59 MYT on the 20th
      expect((await t.gamification.onGameResult(u, finish(5, 0), at('2026-10-20T16:00:00Z'))).xpAdded).toBe(5) // 00:00:00 MYT on the 21st
      await t.gamification.onGameResult(u, finish(495, 0), at('2026-10-21T00:30:00Z')) // 08:30 MYT on the 21st, UTC has moved to the 21st too
      expect((await t.gamification.onGameResult(u, finish(5, 0), at('2026-10-21T15:59:59Z'))).xpAdded).toBe(0) // still the 21st in MYT
    })

    it('a saved cap applies to the next event; a missing row falls back to the default of 48 section 2', async () => {
      const u = await bareUser(t, 'Tetapan Baharu')
      await setting('games_daily_xp_cap', 10)
      expect((await t.gamification.onGameResult(u, finish(30, 0), { isTest: false })).xpAdded).toBe(10)
      await setting('games_daily_xp_cap', 40)
      expect((await t.gamification.onGameResult(u, finish(50, 0), { isTest: false })).xpAdded).toBe(30)
      await t.db.query(`delete from gamification_settings where key = 'games_daily_xp_cap'`)
      expect((await t.gamification.onGameResult(u, finish(600, 0), { isTest: false })).xpAdded).toBe(460) // 500 - 40
      await t.db.query(`insert into gamification_settings (key, value, label) values ('games_daily_xp_cap', 500, 'Had mata permainan sehari')`)
    })
  })

  describe('Mod Pelajar (AC-GM-00.12)', () => {
    it('no event row, ledger row, XP or wallet, also on a repeat', async () => {
      const u = await bareUser(t, 'Mod Pelajar')
      const s = session()
      for (let i = 0; i < 2; i++) expect(await t.gamification.onGameResult(u, finish(40, 9, s), { isTest: true })).toEqual({ coinsCredited: 0, xpAdded: 0, cappedReason: null })
      expect(await eventsOf(u)).toEqual([])
      expect(await ledgerOf(t, u)).toEqual([])
      expect(await walletOf(t, u)).toBeUndefined()
    })
  })

  describe('a result without a session (Roda Nasib) stays as it was', () => {
    it('no event row; the old source and key; a retry adds nothing', async () => {
      const u = await bareUser(t, 'Roda')
      const input = { game: 'roda_nasib', event: 'spin', coins: 5, xp: 0, key: 'spin:2026-10-20' }
      expect(await t.gamification.onGameResult(u, input, { isTest: false })).toEqual({ coinsCredited: 5, xpAdded: 0 })
      expect(await t.gamification.onGameResult(u, input, { isTest: false })).toEqual({ coinsCredited: 0, xpAdded: 0 })
      expect(await eventsOf(u)).toEqual([])
      expect((await ledgerOf(t, u))[0]).toMatchObject({ source: 'roda_nasib', source_id: 'game:spin:2026-10-20' })
    })
  })
})
