import { computed, ref, shallowRef } from 'vue'
import { useRoute } from 'vue-router'

import { isHttpMode } from '@/api/mode'

import { fetchSoloGame, submitSoloGame } from '../../api'
import type { SoloGame, SoloPayloads, SoloSubmitBody, SoloSubmitResponse } from '../../api'
import { errorInfo } from './solo-check'
import { parseDarjah } from './solo-lib'

/**
 * Loads one game session (§7 #32) for the darjah of the route. `requiresDarjah` games (S13-S16) load
 * nothing without `?darjah`, so the picker covers an idle page (DV-M16-18). A new `load()` is a new
 * session ("Main Lagi" draws fresh items, as a live reload does).
 */
export function useSoloGame<G extends SoloGame>(game: G, requiresDarjah = true) {
  const route = useRoute()
  const darjah = computed(() => parseDarjah(route.query.darjah))
  const payload = shallowRef<SoloPayloads[G] | null>(null)
  const loading = ref(false)
  const error = ref('')
  let seq = 0

  async function load(): Promise<boolean> {
    if (requiresDarjah && darjah.value === null) return false
    const mine = ++seq
    loading.value = true
    error.value = ''
    payload.value = null
    try {
      const data = await fetchSoloGame(game, darjah.value ?? undefined)
      if (mine !== seq) return false
      payload.value = data
      return true
    } catch (e) {
      if (mine === seq) error.value = e instanceof Error ? e.message : 'Ralat memuatkan permainan.'
      return false
    } finally {
      if (mine === seq) loading.value = false
    }
  }

  return { darjah, payload, loading, error, load }
}

/**
 * Submits a finished game (§7 #33). A failed submit logs "Submit error:" and the result screen stays
 * (URS FN-M16-6.7.2, as live): the answer is `null`, so no record and no credited syiling show.
 * D58a, http mode: the body is only the session id (the server computes everything from the stored checks),
 * and `before` (the checks still in flight) is awaited first, so no check arrives after the submit.
 */
export async function submitResult(
  game: SoloGame,
  body: SoloSubmitBody,
  before?: { idle(): Promise<void> },
): Promise<SoloSubmitResponse | null> {
  try {
    if (before) await before.idle()
    const res = await submitSoloGame(game, isHttpMode() ? { session_id: body.session_id } : body)
    if (res.status >= 200 && res.status < 300) return res.body
    console.error('Submit error:', res.status)
    return null
  } catch (e) {
    console.error('Submit error:', errorInfo(e))
    return null
  }
}

/** The in-play syiling counter: the computed amount when the payload says the viewer can earn, else 0. */
export function playCoins(canEarn: boolean | undefined, computedCoins: number): number {
  return canEarn === true ? computedCoins : 0
}
