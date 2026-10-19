/**
 * The cells of the `videos` dataset (SRS M09 v1.2 §6.5, §6.9, §6.11) built from the live capture in
 * `video-live-data.ts` (D22: no generated media rows). Every id 1–2,260 is a row with its
 * (subject, category) cell; the dataset materialises them as literal rows.
 *
 * Also the display order of BR-M09-19: the captured live list order (position 0 = first), as the
 * `listKey` sort key. `createdAt` only carries the displayed age (live does not list by age).
 *
 * Subjects: the 1,931 rows seen in a live `?subject=` list use the observed subject. The other 329
 * rows (live pagination repeats ids, so they are never listed) were assigned by the generator by, in
 * order: (1) 3 rows without subject (ids 16, 17, 19 — the live "Tanpa subjek" count); (2) the id-run
 * neighbour rule, ids 256–311 → Matematik and 512–563, 768–818 → Fizik (observed rows on both sides
 * of the run agree); (3) a title keyword rule (abbreviated "Mat/Mate" → Matematik, Kimia/Chemistry,
 * Matematik Tambahan/Add Maths, Fizik/Physics, then Matematik/Mathematics); (4) the one row no rule
 * decides (id 1052) takes the subject the live pill counts are short of (Matematik).
 * Rule counts: observed 1,931; no subject 3; id-run neighbour 159; title keyword 166; pill-count residual 1. The earlier
 * id-range table of §6.9 disagreed with 65 observed rows and is gone.
 */

import type { VideoCategory } from '../types'
import { LIVE_VIDEOS } from './video-live-data'

export const VIDEO_TOTAL = LIVE_VIDEOS.length

interface Cell {
  subjectId: number | null
  category: VideoCategory
}

const cellOfId: (Cell | undefined)[] = new Array(VIDEO_TOTAL + 1)
const positionOfId = new Uint16Array(VIDEO_TOTAL + 1)
const youtubeIdOfId: string[] = new Array(VIDEO_TOTAL + 1)
const titleOfId: string[] = new Array(VIDEO_TOTAL + 1)
const viewsOfId = new Uint32Array(VIDEO_TOTAL + 1)
const orderIds: number[] = []

LIVE_VIDEOS.forEach(([id, youtubeId, views, subjectId, category, title], position) => {
  if (id < 1 || id > VIDEO_TOTAL || cellOfId[id] !== undefined) {
    throw new Error(`M09 videos: id ${String(id)} is outside 1–${String(VIDEO_TOTAL)} or repeated`)
  }
  cellOfId[id] = { subjectId, category }
  positionOfId[id] = position
  youtubeIdOfId[id] = youtubeId
  titleOfId[id] = title
  viewsOfId[id] = views
  orderIds.push(id)
})

/** The (subject, category) cell of a video id 1–2,260. */
export function cellOf(id: number): Cell {
  return cellOfId[id] as Cell
}

/** Live title of a seeded id. */
export function liveTitleOf(id: number): string {
  return titleOfId[id] as string
}

/** Live YouTube id of a seeded id. */
export function liveYoutubeIdOf(id: number): string {
  return youtubeIdOfId[id] as string
}

/** Live view count (at capture) of a seeded id. */
export function liveViewsOf(id: number): number {
  return viewsOfId[id] as number
}

// --- Display order (BR-M09-19) ---------------------------------------------------------------------

/** Video ids, newest first (position 0 = newest): the captured live list order. */
export const VIDEO_ORDER: readonly number[] = Object.freeze(orderIds)

if (new Set(VIDEO_ORDER).size !== VIDEO_TOTAL) {
  throw new Error(`M09 videos: the display order is not a permutation of 1–${String(VIDEO_TOTAL)}`)
}

/** Position (0 = newest) of a seeded video in the BR-M09-19 order. */
export function positionOf(id: number): number {
  return positionOfId[id] as number
}

/** Display-order key (BR-M09-19): 2,260 − position, so a descending sort gives the captured order. */
export function listKeyOf(id: number): number {
  return VIDEO_TOTAL - (positionOfId[id] as number)
}

const NEWEST_MS = Date.parse('2026-03-03T12:00:00+08:00')
const OLDEST_IDS_MS = Date.parse('2026-02-10T12:00:00+08:00')
/** Ids 1–20 show "7 bulan yang lepas" on live; every other row shows "6 bulan yang lepas". */
const SEVEN_MONTHS_MAX_ID = 20

/**
 * `createdAt` (epoch ms) of a seeded video, derived from its live age text at the default clock
 * 2026-09-25T15:40:00+08:00 (live does not list by age, so this is NOT the display order, see
 * `listKeyOf`): ids 1–20 sit in "7 bulan yang lepas" (2026-02-10 minus id seconds), the others in
 * "6 bulan yang lepas" (2026-03-03 12:00:00 minus 1 s per list position, unique).
 */
export function createdMsOf(id: number): number {
  if (id <= SEVEN_MONTHS_MAX_ID) return OLDEST_IDS_MS - id * 1000
  return NEWEST_MS - (positionOfId[id] as number) * 1000
}
