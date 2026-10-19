/**
 * `notificationBadge` store: the unread count on the user-shell bell (M01 FR-M01-53).
 *
 * Refreshed from `GET /api/me/notifications/unread-count` (M01 #14, `{data: {count}}`):
 * on page load (the router calls `refresh()` after navigation), every 60 s while the page is open
 * (the shell drives it with `useIntervalWhileVisible`), and on a simulated push. A failed refresh
 * keeps the last count; a 401 is handled by the session store's 401 policy. Not persisted.
 *
 * Display: hidden when the count is 0; "99+" when the count is above 99.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { api } from '@/api'

import { useSessionStore } from './session'

export const UNREAD_COUNT_URL = '/api/me/notifications/unread-count'

/** Badge text: "99+" above 99, else the number. */
export function badgeLabel(count: number): string {
  return count > 99 ? '99+' : String(count)
}

export const useNotificationBadgeStore = defineStore('notificationBadge', () => {
  const count = ref(0)
  const visible = computed(() => count.value > 0)
  const label = computed(() => badgeLabel(count.value))
  let seq = 0

  function set(next: number): void {
    count.value = Math.max(0, Math.trunc(next))
  }

  /** Fetches the unread count. Does nothing without a session. Resolves to the count held after. */
  async function refresh(): Promise<number> {
    const session = useSessionStore()
    if (!session.isLoggedIn) {
      seq += 1
      count.value = 0
      return 0
    }
    const id = ++seq
    try {
      const data = await api.get<{ count: number }>(UNREAD_COUNT_URL)
      if (id === seq && typeof data?.count === 'number') set(data.count)
    } catch {
      // Keep the last count (live `updateNotifBadge()` ignores failures).
    }
    return count.value
  }

  function reset(): void {
    seq += 1
    count.value = 0
  }

  return { count, visible, label, set, refresh, reset }
})

export type NotificationBadgeStore = ReturnType<typeof useNotificationBadgeStore>
