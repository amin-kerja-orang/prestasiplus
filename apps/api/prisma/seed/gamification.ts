/**
 * Gamification and rewards-shop seed (BE-23 data layer, M14 beyond the wallet core and M15). Demo kind: refused
 * in production unless ALLOW_DEMO_SEED (the reference set is pinned and needs LEAD approval). Fictitious data only.
 *
 * The achievements, the daily challenges and the 10 settings are ALSO reference data (`core/gamification-catalogue.ts`, GAMIF-REF), which runs earlier
 * in every environment; the by-key / by-name / by-title lookups below then find those rows and add nothing, and this module still seeds them when run alone.
 *
 * Source of every value: the mock (`src/modules/m14-gamification/mock/data/catalogue.ts`,
 * `src/modules/m15-rewards-shop/mock/data/rewards-seed.ts`), copied into `gamification-data.ts`; nothing is
 * invented and no total is tuned:
 *  - 10 daily challenges, 25 achievements, 10 gamification settings, 11 Syiling rewards, 3 learner badges;
 *  - the 59 observed Hadiah (all inactive, as on live) with their observed stock and monthly limits;
 *  - one sample lucky draw, `Cabutan Demo` (the mock hook `m14-draw-open`: 50 syiling a ticket, 10 tickets a
 *    student), with an ordered prize pool of two lines (`Hadiah Demo` 1000 sen x1 from the hook, `Baucar RM5`
 *    500 sen x10 from the mock draw tests), closing 90 days after the seed clock.
 * Not seeded: wallets and ledger (BE-11), tier rows (BE-11), claims, redemptions, tickets, completions and unlocks
 * (they need users and runtime activity), learner badge holdings (the mock holdings belong to a mock user id with no
 * seeded account), mystery boxes (constants in code, no table), teacher economy (D53/OWN-10).
 *
 * Idempotent: settings are upserted by their unique `key`; every other row is found by its natural key (challenge
 * title, achievement name, badge name, Syiling reward name, Hadiah vendor + title, draw title) and created only when
 * missing, so an admin edit or a loaded .cloud row is never overwritten and a re-run adds nothing. `legacy_*` is
 * never set. The seed clock is the only time source.
 */
import { assertSeedAllowed } from './guard'
import {
  ACHIEVEMENT_ROWS,
  CHALLENGE_ROWS,
  HADIAH_ROWS,
  LEARNER_BADGE_ROWS,
  SETTING_ROWS,
  SYILING_REWARD_ROWS,
} from './gamification-data'
import type { SeedModule } from './index'

export { ACHIEVEMENT_ROWS, CHALLENGE_ROWS, HADIAH_ROWS, LEARNER_BADGE_ROWS, SETTING_ROWS, SYILING_REWARD_ROWS }

/** The sample draw (`draws` + ordered `draw_prizes`). */
export const SAMPLE_DRAW = {
  title: 'Cabutan Demo',
  description: '',
  ticketCostSyiling: 50,
  maxTicketsPerStudent: 10,
  status: 'open',
  closesInDays: 90,
  prizes: [
    { label: 'Hadiah Demo', valueSen: 1000, qty: 1 },
    { label: 'Baucar RM5', valueSen: 500, qty: 10 },
  ],
} as const

const DAY_MS = 24 * 60 * 60 * 1000

export const gamificationSeed: SeedModule = {
  name: 'gamification',
  kind: 'demo',
  async run(ctx) {
    // Defence in depth: the runner already refuses demo modules in production without the flag.
    assertSeedAllowed()
    const { prisma } = ctx
    const seededAt = ctx.clock.now()
    const stamp = { createdAt: seededAt, updatedAt: seededAt }

    for (const s of SETTING_ROWS) {
      await prisma.gamificationSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, value: s.value, label: s.label, ...stamp },
        update: {},
      })
    }

    for (const c of CHALLENGE_ROWS) {
      if (await prisma.challenge.findFirst({ where: { title: c.title, legacySource: null } })) continue
      await prisma.challenge.create({ data: { ...c, ...stamp } })
    }

    for (const a of ACHIEVEMENT_ROWS) {
      if (await prisma.achievement.findFirst({ where: { name: a.name, legacySource: null } })) continue
      await prisma.achievement.create({ data: { ...a, ...stamp } })
    }

    for (const b of LEARNER_BADGE_ROWS) {
      if (await prisma.learnerBadge.findFirst({ where: { name: b.name } })) continue
      await prisma.learnerBadge.create({ data: { ...b, ...stamp } })
    }

    for (const r of SYILING_REWARD_ROWS) {
      if (await prisma.syilingReward.findFirst({ where: { name: r.name, legacySource: null } })) continue
      await prisma.syilingReward.create({ data: { ...r, ...stamp } })
    }

    for (const h of HADIAH_ROWS) {
      if (await prisma.reward.findFirst({ where: { vendor: h.vendor, title: h.title, legacySource: null } })) continue
      await prisma.reward.create({ data: { ...h, deliveryMethod: 'manual', isActive: false, ...stamp } })
    }

    await prisma.$transaction(async (tx) => {
      if (await tx.draw.findFirst({ where: { title: SAMPLE_DRAW.title, legacySource: null } })) return
      const draw = await tx.draw.create({
        data: {
          title: SAMPLE_DRAW.title,
          description: SAMPLE_DRAW.description,
          ticketCostSyiling: SAMPLE_DRAW.ticketCostSyiling,
          maxTicketsPerStudent: SAMPLE_DRAW.maxTicketsPerStudent,
          status: SAMPLE_DRAW.status,
          closesAt: new Date(seededAt.getTime() + SAMPLE_DRAW.closesInDays * DAY_MS),
          ...stamp,
        },
      })
      let position = 0
      for (const p of SAMPLE_DRAW.prizes) {
        await tx.drawPrize.create({ data: { drawId: draw.id, label: p.label, valueSen: p.valueSen, qty: p.qty, position, ...stamp } })
        position += 1
      }
    })
  },
}
