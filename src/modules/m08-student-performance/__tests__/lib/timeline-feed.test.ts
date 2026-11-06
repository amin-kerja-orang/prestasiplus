import { describe, expect, it } from 'vitest'

import type { TimelineEntry, TimelinePost } from '../../api/types'
import { badgeEmoji, badgeTitle, entriesOf, groupByDay, rowKey, rowTime, sessionDetail, sessionTitle } from '../../lib/timeline/feed'

const session = (id: string, at: string, over: Partial<Extract<TimelineEntry, { kind: 'session' }>> = {}): TimelineEntry => ({
  kind: 'session',
  id,
  at,
  subjectName: 'Sains',
  correct: 0,
  answered: 40,
  accuracy: 0,
  ...over,
})

const post = (id: number, createdAt: string): TimelinePost => ({
  id,
  userId: 2,
  title: `P${String(id)}`,
  category: 'cerita',
  eventDate: '2020-01-01',
  story: null,
  photos: [],
  createdAt,
})

describe('timeline feed helpers', () => {
  it('groups by the Malaysian day, keeping order; heading is the BM long date and the badge the short date', () => {
    const rows = [
      session('s:3', '2026-10-24T00:30:00+08:00'),
      session('s:2', '2026-10-23T23:30:00+08:00'),
      session('s:1', '2026-10-23T08:00:00+08:00'),
    ]
    const days = groupByDay(rows)
    expect(days.map((d) => [d.key, d.heading, d.badge, d.rows.length])).toEqual([
      ['2026-10-24', '24 Oktober 2026', '24 Okt', 1],
      ['2026-10-23', '23 Oktober 2026', '23 Okt', 2],
    ])
    expect(groupByDay([])).toEqual([])
  })

  it('words the rows as the PRD does', () => {
    const s = session('s:1', '2026-10-23T20:06:00+08:00', { correct: 0, answered: 40, accuracy: 0 }) as Extract<TimelineEntry, { kind: 'session' }>
    expect(sessionTitle(s)).toBe('Selesai latihan Sains 0/40')
    expect(sessionDetail(s)).toBe('0/40 betul · 0% ketepatan')
    expect(sessionTitle({ ...s, subjectName: ' ' })).toBe('Selesai latihan 0/40')
    expect(rowTime(s)).toBe('8:06 PM')
    expect(badgeTitle({ kind: 'badge', id: 'b:1', at: s.at, name: 'Pemula', icon: '' })).toBe('Lencana diperoleh: Pemula')
  })

  it('shows a badge icon only when it is an emoji', () => {
    expect(badgeEmoji('🏅')).toBe('🏅')
    expect(badgeEmoji('trophy')).toBeNull()
    expect(badgeEmoji('i-ph-medal')).toBeNull()
    expect(badgeEmoji('')).toBeNull()
  })

  it('keys never collide between kinds', () => {
    expect(rowKey({ kind: 'post', id: 1, at: 'x', post: post(1, '2026-10-23T10:00:00+08:00') })).toBe('post:1')
    expect(rowKey(session('s:1', '2026-10-23T10:00:00+08:00'))).toBe('session:s:1')
  })

  it('uses entries as sent; an older payload falls back to the posts by creation time, newest first (not the event date)', () => {
    const entries = [session('s:1', '2026-10-23T10:00:00+08:00')]
    expect(entriesOf({ posts: [], entries })).toBe(entries)
    const posts = [post(1, '2026-10-23T10:00:00+08:00'), post(3, '2026-10-24T10:00:00+08:00'), post(2, '2026-10-23T10:00:00+08:00')]
    expect(entriesOf({ posts }).map((e) => e.id)).toEqual([3, 2, 1])
    expect(entriesOf({ posts }).every((e) => e.kind === 'post')).toBe(true)
  })
})
