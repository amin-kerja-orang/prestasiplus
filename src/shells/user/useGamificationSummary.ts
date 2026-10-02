/**
 * Header chips data (overview §10 "Shell data contracts"): `GET /api/me/gamification-summary`
 * → `{coins, points, streakDays}` (owner M14; provisional 0 / 0 / 0 in the mock core until the
 * M05-hosted wallet/streak repository exists).
 *
 * Live renders the chips with each page load, so the shell refetches after every navigation
 * (the caller watches the route). A failed fetch keeps the last values, like the bell badge.
 */

import { ref } from 'vue'

import { api } from '@/api'

export const GAMIFICATION_SUMMARY_URL = '/api/me/gamification-summary'

export interface GamificationSummary {
  coins: number
  points: number
  streakDays: number
}

export function useGamificationSummary() {
  const summary = ref<GamificationSummary>({ coins: 0, points: 0, streakDays: 0 })
  let seq = 0

  async function refresh(): Promise<void> {
    const id = ++seq
    try {
      const data = await api.get<GamificationSummary>(GAMIFICATION_SUMMARY_URL)
      if (id !== seq || !data) return
      summary.value = {
        coins: Number(data.coins) || 0,
        points: Number(data.points) || 0,
        streakDays: Number(data.streakDays) || 0,
      }
    } catch {
      // Keep the last values (a 401 is handled by the session store's policy).
    }
  }

  return { summary, refresh }
}
