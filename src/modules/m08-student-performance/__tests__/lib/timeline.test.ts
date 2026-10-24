import { describe, expect, it } from 'vitest'

import type { TimelinePost } from '../../api/types'
import { IMAGE_PLACEHOLDER, photoSrc } from '../../lib/timeline/image-src'
import {
  CATEGORY_OPTIONS,
  appendFiles,
  categoryLabel,
  removeAt,
  sortPosts,
  type PhotoItem,
} from '../../lib/timeline/posts'
import { absoluteUrl, percent, tierColour, tierName } from '../../lib/timeline/profile'

const post = (id: number, eventDate: string | null, createdAt: string): TimelinePost => ({
  id,
  userId: 2,
  title: `P${String(id)}`,
  category: 'cerita',
  eventDate,
  story: null,
  photos: [],
  createdAt,
})

describe('timeline posts', () => {
  it('lists the five categories in live order', () => {
    expect(CATEGORY_OPTIONS.map((o) => o.label)).toEqual([
      '🏆 Sijil',
      '🥇 Pencapaian',
      '🏃 Aktiviti',
      '✍️ Cerita',
      '⭐ Lain-lain',
    ])
    expect(categoryLabel('lain')).toBe('⭐ Lain-lain')
  })

  it('sorts newest first by event date, else creation date', () => {
    const sorted = sortPosts([
      post(1, '2026-08-14', '2026-08-15T09:00:00+08:00'),
      post(2, null, '2026-09-10T09:00:00+08:00'),
      post(3, '2026-09-05', '2026-09-06T09:00:00+08:00'),
    ])
    expect(sorted.map((p) => p.id)).toEqual([2, 3, 1])
  })
})

describe('photo block (FR-M08-101, BR-M08-34)', () => {
  const f = (name: string, size = 100, type = 'image/png') => ({ name, size, type })
  let k = 0
  const next = () => ++k

  it('skips a file over 2 MB with its name and silently drops files after the 5th', () => {
    const tooBig: string[] = []
    const out = appendFiles(
      [],
      [f('a'), f('big', 3 * 1024 * 1024), f('b'), f('c'), f('d'), f('e'), f('g'), f('h')],
      next,
      (n) => tooBig.push(n),
    )
    expect(tooBig).toEqual(['big'])
    expect(out.map((i) => i.file.name)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('skips files that are not jpeg, png or webp without a message', () => {
    const told: string[] = []
    const out = appendFiles(
      [],
      [f('a.gif', 10, 'image/gif'), f('b.png'), f('c', 10, '')],
      next,
      (n) => told.push(n),
    )
    expect(out.map((i) => i.file.name)).toEqual(['b.png'])
    expect(told).toEqual([])
  })

  it('keeps typed captions with their files when files are added or removed (DV-30)', () => {
    let items: PhotoItem<{ name: string; size: number; type: string }>[] = appendFiles(
      [],
      [f('1'), f('2')],
      next,
      () => undefined,
    )
    items[0]!.caption = 'satu'
    items[1]!.caption = 'dua'
    items = appendFiles(items, [f('3')], next, () => undefined)
    expect(items.map((i) => i.caption)).toEqual(['satu', 'dua', ''])
    items = removeAt(items, 0)
    expect(items.map((i) => i.caption)).toEqual(['dua', ''])
  })
})

describe('photo source and profile helpers', () => {
  it('shows a neutral placeholder for blob:mock names and other values as they are', () => {
    expect(photoSrc('blob:mock/abc.png')).toBe(IMAGE_PLACEHOLDER)
    expect(photoSrc('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
  })
  it('falls back to the placeholder for any value that is not a safe image source', () => {
    expect(photoSrc('javascript:alert(1)')).toBe(IMAGE_PLACEHOLDER)
    expect(photoSrc('data:text/html;base64,AA')).toBe(IMAGE_PLACEHOLDER)
    expect(photoSrc('https://evil.test/x.png')).toBe(IMAGE_PLACEHOLDER)
    expect(photoSrc('data:image/webp;base64,AA')).toBe('data:image/webp;base64,AA')
    expect(photoSrc('blob:http://localhost/abc')).toBe('blob:http://localhost/abc')
  })

  it('maps tier labels and colours, formats percent and the absolute URL', () => {
    expect(tierName('bronze')).toBe('Gangsa')
    expect(tierName('silver')).toBe('Perak')
    expect(tierColour('bronze')).toBe('#cd7f32')
    expect(percent(0)).toBe('0%')
    expect(percent(93.48)).toBe('93.5%')
    expect(absoluteUrl('/pelajar/1', 'https://x.test')).toBe('https://x.test/pelajar/1')
  })
})
