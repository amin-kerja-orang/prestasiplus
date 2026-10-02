/**
 * `GET /api/admin/server-status` (overview §10; moved to F-18 by build-plan v1.11). Admin only:
 * any other role answers 403 (FR-M17-06, SEC-M17-10). Provisional fixture: deterministic samples
 * that step every 30 s (the pill's poll period), so the header pill shows every colour of its
 * thresholds (CPU 50/80, RAM 60/85, Disk 75/90) without randomness.
 *
 * Contract: `{cpuPct, ramPct, diskPct, uptime, load, cores, ramUsedGb, ramTotalGb}` (overview §10)
 * plus `diskUsedGb` / `diskTotalGb`, INFERRED: the Disk tooltip needs "used GB / total GB"
 * (live "199.3GB / 398.7GB"). Confirmed for now by the Delivery Lead.
 */

import { CLOCK_ANCHOR_MS, clock } from '@/lib/time'

import { requireRole } from '../auth/middleware'
import { ok } from '../server/respond'
import { route } from '../server/router'

export interface ServerStatusData {
  cpuPct: number
  ramPct: number
  diskPct: number
  uptime: string
  load: number
  cores: number
  ramUsedGb: number
  ramTotalGb: number
  diskUsedGb: number
  diskTotalGb: number
}

const CORES = 8
const RAM_TOTAL_GB = 31.1
const DISK_TOTAL_GB = 398.7
/** The observed live reading first (ok/ok/ok), then amber and red steps. */
/**
 * OBSERVED on live (00-global-ui §3.3, SHA-admin-shell inventory): CPU 2%..6%, RAM 52% (16.2GB /
 * 31.1GB), Disk 50% (199.3GB / 398.7GB), load 0.15 / 8 cores, uptime 204d 2h. The first sample
 * carries the observed disk usage and load explicitly (a derived 50% of 398.7 would read 199.4). The other
 * samples are fixture values chosen to cross the amber and red thresholds.
 */
const SAMPLES: readonly {
  cpu: number
  ram: number
  disk: number
  diskUsedGb?: number
  load?: number
}[] = [
  { cpu: 6, ram: 52, disk: 50, diskUsedGb: 199.3, load: 0.15 },
  { cpu: 55, ram: 65, disk: 78 },
  { cpu: 85, ram: 90, disk: 93 },
  { cpu: 30, ram: 58, disk: 50 },
]
export const SERVER_STATUS_STEP_MS = 30_000
/** Uptime at the clock anchor: "204d 2h" (observed). */
const UPTIME_AT_ANCHOR_HOURS = 204 * 24 + 2

const round1 = (n: number): number => Math.round(n * 10) / 10

/** The reading for an instant (ms since epoch). Pure. */
export function serverStatusAt(nowMs: number): ServerStatusData {
  const step = Math.floor(nowMs / SERVER_STATUS_STEP_MS)
  const s = SAMPLES[step % SAMPLES.length]!
  const hours =
    UPTIME_AT_ANCHOR_HOURS + Math.max(0, Math.floor((nowMs - CLOCK_ANCHOR_MS) / 3_600_000))
  return {
    cpuPct: s.cpu,
    ramPct: s.ram,
    diskPct: s.disk,
    uptime: `${Math.floor(hours / 24)}d ${hours % 24}h`,
    load: s.load ?? Math.round(s.cpu * CORES) / 100,
    cores: CORES,
    ramUsedGb: round1((s.ram / 100) * RAM_TOTAL_GB),
    ramTotalGb: RAM_TOTAL_GB,
    diskUsedGb: s.diskUsedGb ?? round1((s.disk / 100) * DISK_TOTAL_GB),
    diskTotalGb: DISK_TOTAL_GB,
  }
}

export const serverStatusGuard = requireRole('admin')

export const serverStatusRoute = route('GET', '/api/admin/server-status', [serverStatusGuard], () =>
  ok(serverStatusAt(clock.now())),
)
