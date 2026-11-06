/**
 * Feed helpers for S16 "Timeline Saya" (R1-MUR-39). Pure functions. The server sends `entries` newest first;
 * the page only groups them by Malaysian day and words each row.
 */

import { formatDateKey, formatDateLong, formatMyt, formatTime12, toEpochMs } from '@/lib/time'

import type { Timeline, TimelineEntry } from '../../api/types'

const idDesc = (a: number | string, b: number | string): number => {
  const x = String(a)
  const y = String(b)
  return x.length !== y.length ? y.length - x.length : x === y ? 0 : y < x ? -1 : 1
}

/**
 * The rows to show: `entries` as sent (the server has merged and ordered them), or, for an older payload without
 * them, the own posts as `post` rows by creation time, newest first.
 */
export function entriesOf(t: Pick<Timeline, 'posts' | 'entries'>): TimelineEntry[] {
  if (t.entries) return t.entries
  return [...t.posts]
    .sort((a, b) => toEpochMs(b.createdAt) - toEpochMs(a.createdAt) || idDesc(a.id, b.id))
    .map((post): TimelineEntry => ({ kind: 'post', id: post.id, at: post.createdAt, post }))
}

export interface FeedDay {
  /** `yyyy-MM-dd` in Malaysian time. */
  key: string
  /** "23 Oktober 2026". */
  heading: string
  /** "23 Okt". */
  badge: string
  rows: TimelineEntry[]
}

/** Groups consecutive rows of the same MYT day, keeping the given order. */
export function groupByDay(entries: readonly TimelineEntry[]): FeedDay[] {
  const days: FeedDay[] = []
  for (const row of entries) {
    const key = formatDateKey(row.at)
    const last = days[days.length - 1]
    if (last && last.key === key) last.rows.push(row)
    else days.push({ key, heading: formatDateLong(row.at), badge: formatMyt(row.at, 'd MMM'), rows: [row] })
  }
  return days
}

/** A stable list key: the kind keeps a post id from meeting a session key. */
export const rowKey = (e: TimelineEntry): string => `${e.kind}:${String(e.id)}`

/** "Selesai latihan Sains 3/4" (a session with no subject name: "Selesai latihan 3/4"). */
export const sessionTitle = (e: Extract<TimelineEntry, { kind: 'session' }>): string =>
  ['Selesai latihan', e.subjectName.trim(), `${String(e.correct)}/${String(e.answered)}`].filter((x) => x !== '').join(' ')

/** "3/4 betul · 75% ketepatan". */
export const sessionDetail = (e: Extract<TimelineEntry, { kind: 'session' }>): string =>
  `${String(e.correct)}/${String(e.answered)} betul · ${String(e.accuracy)}% ketepatan`

/** "Lencana diperoleh: Pemula". */
export const badgeTitle = (e: Extract<TimelineEntry, { kind: 'badge' }>): string => `Lencana diperoleh: ${e.name}`

/** "8:06 PM". */
export const rowTime = (e: TimelineEntry): string => formatTime12(e.at)

const EMOJI = /\p{Extended_Pictographic}/u

/** The badge icon is shown only when it is an emoji; an icon name or an empty value gets the generic badge icon. */
export const badgeEmoji = (icon: string): string | null => (EMOJI.test(icon) ? icon : null)
