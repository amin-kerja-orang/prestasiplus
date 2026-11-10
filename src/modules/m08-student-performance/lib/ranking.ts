/**
 * S19 `/ranking` "Kedudukan" helpers (R1-MUR-18, API-RPT-13): the card title and icon of each scope, the
 * texts of a rank card, and the order the cards are shown in. The V3-only filters (Skop, Subjek, Tingkatan)
 * and the scope pills are gone (FR-MUR-18-6); the page has no query string.
 */

import type { KedudukanScope, KedudukanScopeCard } from '../api/types'

export const RANKING_PATH = '/ranking'

/** Page name of the tab title ("Kedudukan | PRESTASIPLUS", the shell format; V2 wrote "Kedudukan — PRESTASIPLUS"). */
export const RANKING_TITLE = 'Kedudukan'

/** Sub-heading of the page header (V2 `pelajar/ranking.blade.php`). */
export const RANKING_SUBTITLE = 'Di mana anda berdiri — dalam kelas, sekolah, negeri dan seluruh negara'

export const SYILING_NOTE = 'Kedudukan dikira berdasarkan baki syiling.'
export const EMPTY_TITLE = 'Kedudukan belum tersedia'
export const EMPTY_TEXT = 'Akaun anda belum dikaitkan dengan sekolah atau kelas.'
export const UNAVAILABLE = 'Belum tersedia'
export const FULL_BOARD_LABEL = 'Lihat papan pendahulu penuh'
export const FULL_BOARD_PATH = '/leaderboard'

/** Card titles and icons, as V2 (the class card reads "Dalam kelas"). */
export const SCOPE_META: Readonly<Record<KedudukanScope, { label: string; icon: string; accent: string }>> = {
  kelas: { label: 'Dalam kelas', icon: 'users', accent: 'friend' },
  sekolah: { label: 'Dalam sekolah', icon: 'student', accent: 'win' },
  negeri: { label: 'Dalam negeri', icon: 'map-pin', accent: 'heat' },
  kebangsaan: { label: 'Kebangsaan', icon: 'flag', accent: 'action' },
}

const nf = new Intl.NumberFormat('en-US')

/** "#{rank}"; null without a rank (the tile prints "-" and "Belum tersedia" under it). */
export const rankText = (c: Pick<KedudukanScopeCard, 'rank'>): string | null =>
  c.rank === null ? null : `#${nf.format(c.rank)}`

/** "/ {total} · Kumpulan {p}% teratas"; "Belum tersedia" without a rank. */
export const rankSub = (c: Pick<KedudukanScopeCard, 'total' | 'percentile'>): string =>
  c.total === null || c.percentile === null
    ? UNAVAILABLE
    : `/ ${nf.format(c.total)} · Kumpulan ${String(c.percentile)}% teratas`

/**
 * "Sekitar anda" shows the tightest scope the pupil belongs to (V2: the class, else the school, else the nation); the
 * sub-label names it.
 */
export function nearbyCard(scopes: readonly KedudukanScopeCard[]): KedudukanScopeCard | null {
  for (const scope of ['kelas', 'sekolah', 'kebangsaan'] as const) {
    const card = scopes.find((s) => s.scope === scope && s.rank !== null)
    if (card) return card
  }
  return null
}
