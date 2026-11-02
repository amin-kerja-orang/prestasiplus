/**
 * Gamification catalogue (GAMIF-REF): the achievement catalogue (25 rows with their structured criteria) and the 10
 * gamification settings of M14. This is REFERENCE data, not demo data: `GamificationService.evaluateAchievements`
 * (SW10-03) and the pupil "Pencapaian" screen read the achievement rows, the pupil "Cabaran Harian" screen and `settleChallenges` read the challenge rows, the admin settings screen (S9) and the reward
 * control screen (S10) read the setting rows, and NO route creates either of them (the admin routes only edit
 * settings that exist and never create achievements), so on a production database both stay empty unless a seed or the
 * ETL fills them. The migration ETL adopts these rows by name / title / key (`achievementsStep`, `challengesStep`, `settingsStep`), so this module
 * runs BEFORE `migrate:all` (the `--seed-reference` step of the go-live run sheet).
 * Values are the mock catalogue (`../gamification-data.ts`, reused, never duplicated). Nothing else of the demo
 * `gamification` module moves here: Syiling rewards (no pupil route reads them), Hadiah, the sample draw and the learner badges stay demo data.
 *
 * Idempotent and safe to re-run AFTER the ETL: a row is found by its natural key WITHOUT looking at `legacy_*`
 * (achievement name or challenge title, case-insensitive; setting key), so an adopted row (`legacy_source = 'cloud'`), a legacy row the
 * ETL inserted, or an admin edit is never overwritten and never duplicated. Deterministic (the creation time is the
 * fixed seed clock), no personal data, `legacy_*` is never set.
 */
import { ACHIEVEMENT_ROWS, CHALLENGE_ROWS, SETTING_ROWS } from '../gamification-data'
import type { SeedModule } from '../index'

/** The natural key of an achievement name or a challenge title: trimmed and lower-cased (the ETL matches the same way). */
const naturalKey = (value: string): string => value.trim().toLowerCase()

export const gamificationCatalogueSeed: SeedModule = {
  name: 'core-gamification-catalogue',
  kind: 'reference',
  async run(ctx) {
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

    // Exact match on the trimmed, lower-cased key, like the ETL's `claimSeeded`. Not Prisma's `mode: 'insensitive'`: that is
    // an unescaped ILIKE, so a `%` or `_` in a key (e.g. 'Ketepatan 90%') would match another row and skip this one.
    const names = new Set((await prisma.achievement.findMany({ select: { name: true } })).map((r) => naturalKey(r.name)))
    for (const a of ACHIEVEMENT_ROWS) {
      if (names.has(naturalKey(a.name))) continue
      await prisma.achievement.create({ data: { ...a, ...stamp } })
      names.add(naturalKey(a.name))
    }

    const titles = new Set((await prisma.challenge.findMany({ select: { title: true } })).map((r) => naturalKey(r.title)))
    for (const c of CHALLENGE_ROWS) {
      if (titles.has(naturalKey(c.title))) continue
      await prisma.challenge.create({ data: { ...c, ...stamp } })
      titles.add(naturalKey(c.title))
    }
  },
}
