/**
 * Timeline helpers (SRS M08 FR-M08-99, FR-M08-101, BR-M08-34; S16 / S17 / S18). Pure functions.
 */

import { formatDateLong, toEpochMs } from '@/lib/time'

import type { TimelineCategory, TimelinePost } from '../../api/types'

/** S17 "Kategori *" options, in live order; "cerita" is selected by default (FN-M08-6.2.2). */
export const CATEGORY_OPTIONS: readonly { value: TimelineCategory; label: string }[] = [
  { value: 'sijil', label: '🏆 Sijil' },
  { value: 'pencapaian', label: '🥇 Pencapaian' },
  { value: 'aktiviti', label: '🏃 Aktiviti' },
  { value: 'cerita', label: '✍️ Cerita' },
  { value: 'lain', label: '⭐ Lain-lain' },
]

export const categoryLabel = (c: TimelineCategory): string =>
  CATEGORY_OPTIONS.find((o) => o.value === c)?.label ?? c

/** The date a post sorts and shows by: the event date, else the creation date (FR-M08-99). */
export const postDate = (p: TimelinePost): string => p.eventDate ?? p.createdAt

/** Larger id first; ids are numbers in mock mode and decimal strings on the real API (BE-19). */
function idDesc(a: number | string, b: number | string): number {
  if (typeof a === 'number' && typeof b === 'number') return b - a
  const x = String(a)
  const y = String(b)
  if (x.length !== y.length) return y.length - x.length
  return x === y ? 0 : y < x ? -1 : 1
}

/** Newest first by event date, else creation date; ties keep the newest created first. */
export function sortPosts(posts: readonly TimelinePost[]): TimelinePost[] {
  return [...posts].sort(
    (a, b) =>
      toEpochMs(postDate(b)) - toEpochMs(postDate(a)) ||
      toEpochMs(b.createdAt) - toEpochMs(a.createdAt) ||
      idDesc(a.id, b.id),
  )
}

export const postDateText = (p: TimelinePost): string => formatDateLong(postDate(p))

export const MAX_PHOTOS = 5
export const MAX_PHOTO_BYTES = 2 * 1024 * 1024
export const PHOTO_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/webp']

export interface PhotoItem<F = File> {
  key: number
  file: F
  caption: string
}

/**
 * The photo block's file handling (FR-M08-101, BR-M08-34): files over 2 MB are skipped (`onTooBig`), files
 * past the 5th are silently dropped, and every earlier item keeps its typed caption (DV-30).
 */
export function appendFiles<F extends { name: string; size: number; type: string }>(
  items: readonly PhotoItem<F>[],
  incoming: readonly F[],
  nextKey: () => number,
  onTooBig: (name: string) => void,
): PhotoItem<F>[] {
  const out = [...items]
  for (const file of incoming) {
    if (out.length >= MAX_PHOTOS) break
    // A file that is not jpeg / png / webp is skipped silently (INFERRED: the SRS has no message for it).
    if (!PHOTO_TYPES.includes(file.type)) continue
    if (file.size > MAX_PHOTO_BYTES) {
      onTooBig(file.name)
      continue
    }
    out.push({ key: nextKey(), file, caption: '' })
  }
  return out
}

/** Removes one photo with its own caption only (BR-M08-34). */
export const removeAt = <F>(items: readonly PhotoItem<F>[], index: number): PhotoItem<F>[] =>
  items.filter((_, i) => i !== index)
