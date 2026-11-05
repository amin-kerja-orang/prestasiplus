/** Hub and lane copy (R1-ADM-Q-01, Q-02). The cards themselves come from the API (`overview.cards`). */
import { SERVABILITY_HUB_COPY, type ServabilityHubLane, type SpmAdminTrackingACandidate } from '@pp/contract'
import type { RouteLocationRaw, Router } from 'vue-router'

import { KANDUNGAN_ROUTES, laneRouteOf } from './api'

/** Strings of the hub (FR-ADM-Q01.1, SR-3, FR-ADM-Q01.5). */
export const hubCopy = {
  ...SERVABILITY_HUB_COPY,
  failed: 'Tidak dapat dimuatkan.',
  retry: 'Cuba lagi',
  pupil: 'lihat sisi pelajar',
} as const

/**
 * The pupil page of each lane's admin screen. The link `lihat sisi pelajar` shows only when the route is registered, so no dead link
 * ships (FR-ADM-Q01.5). Kertas Subjektif has no pupil route yet (S3-T06).
 */
const PUPIL_ROUTES: Readonly<Record<string, string>> = {
  [KANDUNGAN_ROUTES.databank]: 'm06.spm.databank',
  [KANDUNGAN_ROUTES.trackingA]: 'm06.spm.ramalan',
  [KANDUNGAN_ROUTES.subjektif]: 'm06.spm.subjektif',
  [KANDUNGAN_ROUTES.simulasi]: 'm28.bijak',
  [KANDUNGAN_ROUTES.latihTubi]: 'm06.spm.latih-tubi',
}

export function pupilRouteOf(router: Router, lane: ServabilityHubLane): RouteLocationRaw | undefined {
  const name = PUPIL_ROUTES[laneRouteOf(lane)]
  return name !== undefined && router.hasRoute(name) ? { name } : undefined
}

/** Strings of a lane list (R1-ADM-Q-02, fields 02-01 to 02-06). */
export const laneCopy = {
  back: '← Semua laluan SPM',
  items: 'item ·',
  pupil: hubCopy.pupil,
  allSubjects: 'Semua Subjek',
  allStatuses: 'Semua Status',
  search: 'Cari',
  apply: 'Tapis',
  reset: 'Set Semula',
  colList: 'Senarai',
  colTitle: 'Tajuk',
  colStatus: 'Status',
  colAttention: 'Perhatian',
  colActions: 'Tindakan',
  preview: 'Pratonton',
  copy: 'Salin',
  edit: 'Sunting',
  /** V2 (A2/P2): the attention text of a published paper. Kept for the zero-question case. */
  noQuestions: 'Disajikan tetapi tiada soalan',
  /** Field 02-05, when nothing is wrong. */
  noAttention: '—',
  empty: 'Tiada item untuk penapis ini.',
  searchTooLong: 'Carian tidak boleh melebihi 100 aksara.',
} as const

/**
 * Status of a question in the Databank and Subjektif lanes (section 0). `Ditolak` is the fifth label: it arrives in a later part
 * of S3-T03, once `rejection_reason` (DM-58, S1-T02) exists. Without the column it would filter nothing.
 */
export const QUESTION_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draf' },
  { value: 'review', label: 'Menunggu Semakan' },
  { value: 'approved', label: 'Diluluskan' },
  { value: 'archived', label: 'Diarkibkan' },
]
export const questionStatusLabel = (code: string): string => QUESTION_STATUS_OPTIONS.find((s) => s.value === code)?.label ?? code

/**
 * Status of a paper in the "Bijak SPM" lane (`SERVABILITY_PAPER_STATUSES`). "Terbit" / "Draf" are V2 `paper_statuses.label`;
 * "Sedia" / "Ditarik balik" are [PROPOSED] (UX-79).
 */
export const PAPER_STATUS_OPTIONS = [
  { value: 'draft', label: 'Draf' },
  { value: 'ready', label: 'Sedia' },
  { value: 'published', label: 'Terbit' },
  { value: 'withdrawn', label: 'Ditarik balik' },
]
export const paperStatusLabel = (code: string): string => PAPER_STATUS_OPTIONS.find((s) => s.value === code)?.label ?? code

/** Badge look of a paper status (the label always comes from `paperStatusLabel`). */
export const paperStatusBadge = (code: string): 'draft' | 'awaiting-review' | 'published' | 'inactive' =>
  code === 'published' ? 'published' : code === 'ready' ? 'awaiting-review' : code === 'withdrawn' ? 'inactive' : 'draft'

/** A unit of the Tracking A draft: a question outside a group, or a whole group. Nothing is committed until `Simpan` (R1-ADM-Q-17). */
export type TrackingUnit = SpmAdminTrackingACandidate

export const trackingUnitKey = (u: Pick<TrackingUnit, 'kind' | 'id'>): string => `${u.kind}:${u.id}`
/** What the draft serves, as the lane's `filled` counts it: a group as its number of questions (FR-ADM-Q17.6), a row that is not served as nothing. */
export const trackingCount = (units: readonly TrackingUnit[]): number => units.reduce((sum, u) => sum + u.members.filter((m) => m.servable).length, 0)

/** What the draft does not hold yet. */
export const trackingFree = (draft: readonly TrackingUnit[], candidates: readonly TrackingUnit[]): TrackingUnit[] => {
  const held = new Set(draft.map(trackingUnitKey))
  return candidates.filter((c) => !held.has(trackingUnitKey(c)))
}

export interface TrackingFill {
  units: TrackingUnit[]
  added: number
  /** The group that does not fit, where `Isi set` stopped; the admin decides what to do with it (PO 15). */
  stopped: { label: string; questions: number; free: number } | null
}

/** `Isi set`: takes the candidates in order until the set is full, and stops at a group that does not fit. It skips nothing and never splits a group. */
export function fillTrackingSet(draft: readonly TrackingUnit[], candidates: readonly TrackingUnit[], target: number): TrackingFill {
  const units = [...draft]
  let free = target - trackingCount(units)
  let added = 0
  for (const unit of trackingFree(draft, candidates)) {
    if (free <= 0) break
    if (unit.questions > free) return { units, added, stopped: { label: unit.label, questions: unit.questions, free } }
    units.push(unit)
    free -= unit.questions
    added += 1
  }
  return { units, added, stopped: null }
}

/** `tukar`: the first other candidate that fits in the place of the unit at `index`, a group whole; `null` when none does. */
export function swapTrackingUnit(draft: readonly TrackingUnit[], index: number, candidates: readonly TrackingUnit[], target: number): TrackingUnit[] | null {
  const old = draft[index]
  if (old === undefined) return null
  const room = target - trackingCount(draft) + trackingCount([old])
  const next = trackingFree(draft, candidates).find((c) => c.questions <= room)
  if (next === undefined) return null
  return [...draft.slice(0, index), next, ...draft.slice(index + 1)]
}

/** `Naik` and `Turun`: a group moves as one row. */
export function moveTrackingUnit(draft: readonly TrackingUnit[], index: number, by: -1 | 1): TrackingUnit[] {
  const to = index + by
  const moved = draft[index]
  if (moved === undefined || to < 0 || to >= draft.length) return [...draft]
  const out = draft.filter((_, i) => i !== index)
  out.splice(to, 0, moved)
  return out
}

