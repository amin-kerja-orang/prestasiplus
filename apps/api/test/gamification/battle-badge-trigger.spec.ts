import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { BattleEngine } from '../../src/modules/battle/engine'
import { BattleModule } from '../../src/modules/battle'
import { GamificationService } from '../../src/modules/gamification/gamification.service'
import { bareStudent, bareUser, bootGamificationApp, ledgerOf, walletOf, type GamificationTestApp } from './helpers'

/**
 * S7-T04 part 16c (FR-GM-25.2, AC-GM-25.3): a real Battle won on the arena path evaluates the badges (Juara Battle at 10 wins) in the
 * battle's transaction. A robot battle, a Mod Pelajar battle and a forfeit win do not trigger and do not count. The trigger never fails the finish.
 */
describe('Battle finish trigger for Juara Battle (S7-T04 part 16c)', () => {
  let t: GamificationTestApp
  let engine: BattleEngine
  let n = 0

  beforeAll(async () => {
    t = await bootGamificationApp({ modules: [BattleModule] })
    engine = t.app.get(BattleEngine, { strict: false })
    await t.db.query(`update gamification_settings set value = 0 where key = 'games_min_ms_per_answer'`)
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  /** A battle row of the user (side A) with its participants. */
  const battle = async (u: string, o: { status?: string; winner?: 'A' | 'B' | null; ranking?: boolean; isTest?: boolean; bot?: boolean } = {}): Promise<string> => {
    const id = (
      await t.db.query<{ id: string }>(`insert into battles (mode, question_type, status, winner, counts_for_ranking, is_test) values ('quick_match', 'biasa', $1, $2, $3, $4) returning id::text`, [
        o.status ?? 'finished',
        o.winner === undefined ? 'A' : o.winner,
        o.ranking ?? !o.bot,
        o.isTest ?? false,
      ])
    )[0]!.id
    await t.db.query(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, 'A', $2::bigint)`, [id, u])
    if (o.bot) await t.db.query(`insert into battle_participants (battle_id, side, is_bot) values ($1::uuid, 'B', true)`, [id])
    else await t.db.query(`insert into battle_participants (battle_id, side, user_id) values ($1::uuid, 'B', $2::bigint)`, [id, await bareUser(t, `Lawan ${n++}`)])
    return id
  }

  /** What the arena does at the last answer: report in the battle's transaction. */
  const report = (u: string, battleId: string, o: { winner?: 'A' | 'B' | null; forfeited?: boolean; robotsOnly?: boolean; isTest?: boolean } = {}) =>
    t.prisma.transaction((tx) =>
      engine.report({ tx, battleId, startedAt: new Date(), userId: u, side: 'A', winner: o.winner === undefined ? 'A' : o.winner, forfeited: o.forfeited ?? false, robotsOnly: o.robotsOnly ?? false, correct: 5, total: 10, isTest: o.isTest ?? false }),
    )
  const badgeRows = async (u: string) => (await ledgerOf(t, u)).filter((r) => r.description === 'Pencapaian: Juara Battle')
  const unlocked = async (u: string) =>
    (await t.db.query<{ name: string }>(`select a.name from user_achievements ua join achievements a on a.id = ua.achievement_id where ua.user_id = $1`, [u])).map((r) => r.name)

  it('9 counted wins, then a 10th real win finishing unlocks Juara Battle once: +30 syiling, +20 XP, one ledger row', async () => {
    const u = await bareStudent(t, 'Sepuluh Kemenangan')
    for (let i = 0; i < 9; i++) await battle(u)
    const id = await battle(u)
    await report(u, id)
    expect(await unlocked(u)).toContain('Juara Battle')
    const rows = await badgeRows(u)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'earn', source: 'achievement', amount: 30, is_test: false })
    // The wallet holds the battle's own reward event plus exactly the badge's +20 XP and +30 syiling.
    const game = (await t.db.query<{ xp: string; syiling: string }>(`select coalesce(sum(xp),0)::text xp, coalesce(sum(syiling),0)::text syiling from game_reward_events where user_id = $1`, [u]))[0]!
    expect(await walletOf(t, u)).toMatchObject({ xp: Number(game.xp) + 20, current_syiling: Number(game.syiling) + 30 })
    // A later win is no second unlock.
    await report(u, await battle(u))
    expect(await badgeRows(u)).toHaveLength(1)
  })

  it('a robot battle win, a Mod Pelajar battle win and a forfeit win do not unlock and do not count', async () => {
    const u = await bareStudent(t, 'Tidak Dikira')
    for (let i = 0; i < 9; i++) await battle(u)
    await report(u, await battle(u, { bot: true }), { robotsOnly: true })
    await report(u, await battle(u, { isTest: true }), { isTest: true })
    await report(u, await battle(u, { status: 'forfeited' }), { forfeited: true })
    expect(await unlocked(u)).not.toContain('Juara Battle')
    const counted = await t.db.query<{ n: string }>(
      `select count(*)::text n from battles b join battle_participants p on p.battle_id = b.id and p.side = b.winner where p.user_id = $1 and b.status = 'finished' and b.counts_for_ranking and not b.is_test`,
      [u],
    )
    expect(counted[0]!.n).toBe('9')
  })

  it('a loss does not unlock', async () => {
    const u = await bareStudent(t, 'Kalah')
    for (let i = 0; i < 9; i++) await battle(u)
    await report(u, await battle(u, { winner: 'B' }), { winner: 'B' })
    expect(await unlocked(u)).not.toContain('Juara Battle')
  })

  it('an evaluation error does not fail the finish (the savepoint keeps the battle transaction usable)', async () => {
    const u = await bareStudent(t, 'Ralat Penilaian')
    for (let i = 0; i < 9; i++) await battle(u)
    const id = await battle(u)
    const spy = vi.spyOn(GamificationService.prototype, 'evaluateAchievements').mockImplementationOnce(async (_id, o) => {
      await o.tx!.$executeRaw`SELECT 1/0`
      throw new Error('unreachable')
    })
    try {
      await expect(report(u, id)).resolves.toBeDefined()
    } finally {
      spy.mockRestore()
    }
    expect(await unlocked(u)).not.toContain('Juara Battle')
    // The next real win evaluates again and unlocks.
    await report(u, await battle(u))
    expect(await unlocked(u)).toContain('Juara Battle')
  })
})
