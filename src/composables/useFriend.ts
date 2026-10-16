/**
 * The learner's chosen study friend (design v2-shells 5.4): Aiman or Aisyah. The choice lives in
 * `localStorage['pp.friend']` (try/catch: blocked storage keeps it for this page view only). One
 * shared state, so the header avatar, the Home greeting and the picker stay in step.
 */
import { computed, ref } from 'vue'

import type { FriendId, FriendOption } from '@/ds'

export const FRIEND_STORAGE_KEY = 'pp.friend'

export const FRIEND_OPTIONS: FriendOption[] = [
  { value: 'aiman', name: 'Aiman', trait: 'Tenang & suka cabaran' },
  { value: 'aisyah', name: 'Aisyah', trait: 'Ceria & sentiasa beri semangat' },
]

function read(): FriendId | null {
  try {
    const value = localStorage.getItem(FRIEND_STORAGE_KEY)
    return value === 'aiman' || value === 'aisyah' ? value : null
  } catch {
    return null
  }
}

const stored = ref<FriendId | null>(read())
const pickerOpen = ref(false)
let offered = false

export function resetFriendForTests(): void {
  stored.value = read()
  pickerOpen.value = false
  offered = false
}

export function useFriend() {
  /** Dismissing the first-run picker without a choice falls back to Aiman (not stored). */
  const friend = computed<FriendId>(() => stored.value ?? 'aiman')
  const friendName = computed(
    () => FRIEND_OPTIONS.find((f) => f.value === friend.value)?.name ?? 'Aiman',
  )

  function choose(value: FriendId): void {
    stored.value = value
    try {
      localStorage.setItem(FRIEND_STORAGE_KEY, value)
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
  }

  function openPicker(): void {
    pickerOpen.value = true
  }

  /** First visit: offer the picker once per page view when no friend was ever chosen. */
  function offerFirstRun(): void {
    if (offered || stored.value !== null) return
    offered = true
    pickerOpen.value = true
  }

  return {
    friend,
    friendName,
    hasChosen: computed(() => stored.value !== null),
    pickerOpen,
    choose,
    openPicker,
    offerFirstRun,
  }
}
