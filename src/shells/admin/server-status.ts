/**
 * Server-status pill logic (shells.md §2.3, design-system §5 "Server status pill thresholds").
 * The contract is overview §10: `GET /api/admin/server-status`. It is admin-only (403 for a
 * teacher, FR-M17-06), so only the admin header mounts the pill and starts the poll.
 */

import { readonly, shallowRef, type Ref } from 'vue'

import { api } from '@/api'
import { useIntervalWhileVisible } from '@/composables/useIntervalWhileVisible'

export const SERVER_STATUS_URL = '/api/admin/server-status'
/** Live polls every 30 s. */
export const SERVER_STATUS_POLL_MS = 30_000

/**
 * Overview §10 fields. `diskUsedGb` and `diskTotalGb` are INFERRED (spec gap): the contract lists
 * `ramUsedGb`/`ramTotalGb` but the Disk tooltip needs "used GB / total GB" too (live shows
 * "199.3GB / 398.7GB").
 */
export interface ServerStatus {
  cpuPct: number
  ramPct: number
  diskPct: number
  /** Ready-made text, for example "204d 2h". */
  uptime: string
  load: number
  cores: number
  ramUsedGb: number
  ramTotalGb: number
  diskUsedGb?: number
  diskTotalGb?: number
}

export type StatusTone = 'ok' | 'warn' | 'bad'

/** Thresholds (strictly greater than): CPU 50/80, RAM 60/85, Disk 75/90. */
const THRESHOLDS = {
  cpu: [50, 80],
  ram: [60, 85],
  disk: [75, 90],
} as const

export function statusTone(metric: keyof typeof THRESHOLDS, pct: number): StatusTone {
  const [warn, bad] = THRESHOLDS[metric]
  if (pct > bad) return 'bad'
  if (pct > warn) return 'warn'
  return 'ok'
}

/** Text colour classes per tone (red / amber / emerald, design-system §5). */
export const TONE_CLASS: Readonly<Record<StatusTone, string>> = {
  ok: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
}

export function useServerStatus(): { status: Readonly<Ref<ServerStatus | null>> } {
  // A failed poll keeps the last good values (nothing shown for errors); none yet = "--".
  const status = shallowRef<ServerStatus | null>(null)
  let seq = 0

  async function poll(): Promise<void> {
    const id = ++seq
    try {
      const data = await api.get<ServerStatus>(SERVER_STATUS_URL)
      if (id === seq && data && typeof data.cpuPct === 'number') status.value = data
    } catch {
      // Keep the last values.
    }
  }

  useIntervalWhileVisible(() => void poll(), SERVER_STATUS_POLL_MS, { immediate: true })
  return { status: readonly(status) }
}
