/**
 * Read port over gamification and the wallet (owner M14/M12: BE-23 and BE-11). The real adapter lives in
 * `modules/gamification/performance-gamification.adapter.ts` and is bound from
 * `GamificationModule.onModuleInit` through `PerformancePorts.provideGamification`.
 */
export interface GamificationTier {
  key: string
  name: string
  emoji: string
  /** 1-based position among the active tiers ordered by minimum syiling. */
  ordinal: number
  /** At the top tier: 100. */
  progressPct: number
  /** Syiling to the next tier; null at the top tier. */
  toNext: number | null
  nextName: string | null
  nextKey: string | null
}

export interface GamificationProfile {
  userId: string
  syiling: number
  /** The wallet level ("tahap"). */
  level: number
  tier: GamificationTier
  streak: { current: number; best: number }
}

export interface GamificationBadge {
  key: string
  name: string
  /** The achievement icon (emoji or icon name); '' when it has none. */
  icon: string
  earnedAt: Date
}

export interface GamificationReadPort {
  /** Null for an unknown user. */
  profile(userId: string): Promise<GamificationProfile | null>
  /** Batch of profile; unknown ids are absent. */
  profiles(userIds: readonly string[]): Promise<Map<string, GamificationProfile>>
  badges(userId: string): Promise<GamificationBadge[]>
}

export const GAMIFICATION_READ_PORT = Symbol('GAMIFICATION_READ_PORT')

export const EMPTY_TIER: GamificationTier = {
  key: '',
  name: '',
  emoji: '',
  ordinal: 1,
  progressPct: 0,
  toNext: null,
  nextName: null,
  nextKey: null,
}

const emptyProfile = (userId: string): GamificationProfile => ({
  userId,
  syiling: 0,
  level: 0,
  tier: EMPTY_TIER,
  streak: { current: 0, best: 0 },
})

/** Default until BE-23's adapter is registered: nothing earned (syiling 0, ordinal 1, no badges). */
export class EmptyGamificationRead implements GamificationReadPort {
  async profile(userId: string): Promise<GamificationProfile | null> {
    return emptyProfile(userId)
  }
  async profiles(userIds: readonly string[]): Promise<Map<string, GamificationProfile>> {
    return new Map(userIds.map((id) => [id, emptyProfile(id)]))
  }
  async badges(): Promise<GamificationBadge[]> {
    return []
  }
}
