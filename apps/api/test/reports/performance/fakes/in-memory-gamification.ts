import type {
  GamificationBadge,
  GamificationProfile,
  GamificationReadPort,
  GamificationTier,
} from '../../../../src/modules/reports/performance/ports'

const TIER: GamificationTier = { key: 'perunggu', name: 'Perunggu', emoji: 'B', ordinal: 1, progressPct: 40, toNext: 60, nextName: 'Perak', nextKey: 'perak' }

/** In-memory `GamificationReadPort`; pupils not added read as level 1, syiling 0. */
export class InMemoryGamification implements GamificationReadPort {
  private readonly rows = new Map<string, GamificationProfile>()
  private readonly badgeRows = new Map<string, GamificationBadge[]>()

  add(userId: string, over: Partial<Omit<GamificationProfile, 'userId'>> = {}): this {
    this.rows.set(userId, { userId, syiling: 0, level: 1, tier: TIER, streak: { current: 0, best: 0 }, ...over })
    return this
  }
  addBadge(userId: string, b: GamificationBadge): this {
    this.badgeRows.set(userId, [...(this.badgeRows.get(userId) ?? []), b])
    return this
  }

  async profile(userId: string): Promise<GamificationProfile | null> {
    return this.rows.get(userId) ?? null
  }
  async profiles(userIds: readonly string[]): Promise<Map<string, GamificationProfile>> {
    const out = new Map<string, GamificationProfile>()
    for (const id of userIds) {
      const r = this.rows.get(id)
      if (r) out.set(id, r)
    }
    return out
  }
  async badges(userId: string): Promise<GamificationBadge[]> {
    return this.badgeRows.get(userId) ?? []
  }
}
