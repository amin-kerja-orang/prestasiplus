import { Inject, Injectable } from '@nestjs/common'

import type {
  GamificationBadge,
  GamificationProfile,
  GamificationReadPort,
  GamificationTier,
} from '../reports/performance/ports'
import { defaultTier, nextTierOf, nextTierProgress } from '../wallet/rules'
import { GamificationRepository, type TierRecord } from './gamification.repository'

const FALLBACK_TIER: GamificationTier = { key: '', name: '', emoji: '', ordinal: 1, progressPct: 0, toNext: null, nextName: null, nextKey: null }

/**
 * The real `GamificationReadPort` of BE-19 (public profile, rankings) over BE-11 wallets/streaks and BE-23
 * achievements. Read-only. `profile` and `profiles` are one code path: a fixed number of statements (tiers,
 * wallets, streaks) whatever the number of users. A user without a wallet row reads the BR-M14-02 defaults
 * (syiling 0, level 1, lowest tier). When anything fails the report falls back to syiling 0, ordinal 1.
 *
 * Tier ordinal (S18 "Tahap", INFERRED by the mock): the 1-based position of the tier among the active tiers by
 * `minSyiling`. `progressPct` / `toNext` / `nextName` / `nextKey` are those of the wallet's next tier
 * (100 / null / null / null at the top tier).
 */
@Injectable()
export class PerformanceGamificationAdapter implements GamificationReadPort {
  constructor(@Inject(GamificationRepository) private readonly repo: GamificationRepository) {}

  async profile(userId: string): Promise<GamificationProfile | null> {
    return (await this.profiles([userId])).get(userId) ?? null
  }

  async profiles(userIds: readonly string[]): Promise<Map<string, GamificationProfile>> {
    const out = new Map<string, GamificationProfile>()
    const unique = [...new Set(userIds)]
    if (unique.length === 0) return out
    const db = this.repo.handle()
    const [tiers, wallets, streaks] = await Promise.all([this.repo.tiers(db), this.repo.levelsOf(db, unique), this.repo.streaksOf(db, unique)])
    const active = tiers.filter((t) => t.isActive).sort((a, b) => a.minSyiling - b.minSyiling || a.sortOrder - b.sortOrder)
    for (const id of unique) {
      const w = wallets.get(id) ?? { level: 1, syiling: 0, tierId: null }
      const s = streaks.get(id) ?? { current: 0, best: 0 }
      out.set(id, { userId: id, syiling: w.syiling, level: w.level, tier: this.tierOf(tiers, active, w.tierId, w.syiling), streak: s })
    }
    return out
  }

  async badges(userId: string): Promise<GamificationBadge[]> {
    return this.repo.badgesOf(this.repo.handle(), userId)
  }

  private tierOf(all: TierRecord[], active: TierRecord[], tierId: string | null, syiling: number): GamificationTier {
    const current = (tierId === null ? undefined : all.find((t) => t.id === tierId)) ?? defaultTier(all)
    if (!current) return FALLBACK_TIER
    const next = nextTierOf(all, current.id)
    const ordinal = Math.max(1, active.findIndex((t) => t.id === current.id) + 1)
    const progress = next ? nextTierProgress(syiling, next) : null
    return {
      key: current.tierName,
      name: current.labelMs,
      emoji: current.icon,
      ordinal,
      progressPct: progress ? progress.pct : 100,
      toNext: progress ? progress.need : null,
      nextName: next ? next.labelMs : null,
      nextKey: next ? next.tierName : null,
    }
  }
}
