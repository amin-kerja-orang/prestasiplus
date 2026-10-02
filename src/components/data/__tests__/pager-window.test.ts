import { describe, expect, it } from 'vitest'

import { pageHref } from '../page-href'
import { pagerNumbers, pagerWindow, type PagerItem } from '../pager-window'

/** Renders the window like the live strip: numbers and "..." */
function show(current: number, last: number): string {
  return pagerWindow(current, last)
    .map((i: PagerItem) => (i.kind === 'gap' ? '...' : String(i.page)))
    .join(' ')
}

describe('pagerWindow (Laravel UrlWindow, onEachSide 3)', () => {
  it('lists every page up to 13 pages (M01 E2E-39: 167 items / 20 = 9 pages)', () => {
    expect(show(1, 9)).toBe('1 2 3 4 5 6 7 8 9')
    expect(show(5, 13)).toBe('1 2 3 4 5 6 7 8 9 10 11 12 13')
  })

  it('a single page lists just "1"', () => {
    expect(show(1, 1)).toBe('1')
  })

  it('from 14 pages shows 1-10 ... last two on pages 1-7 (M09 "1 ... 10 ... 94 95")', () => {
    expect(show(1, 14)).toBe('1 2 3 4 5 6 7 8 9 10 ... 13 14')
    expect(show(1, 95)).toBe('1 2 3 4 5 6 7 8 9 10 ... 94 95')
    expect(show(7, 95)).toBe('1 2 3 4 5 6 7 8 9 10 ... 94 95')
    expect(show(1, 207)).toBe('1 2 3 4 5 6 7 8 9 10 ... 206 207')
    expect(show(1, 28)).toBe('1 2 3 4 5 6 7 8 9 10 ... 27 28')
  })

  it('shows first two ... last ten on the last 7 pages', () => {
    expect(show(95, 95)).toBe('1 2 ... 86 87 88 89 90 91 92 93 94 95')
    expect(show(89, 95)).toBe('1 2 ... 86 87 88 89 90 91 92 93 94 95')
    expect(show(14, 14)).toBe('1 2 ... 5 6 7 8 9 10 11 12 13 14')
  })

  it('slides current +/- 3 between two gaps in the middle', () => {
    expect(show(8, 95)).toBe('1 2 ... 5 6 7 8 9 10 11 ... 94 95')
    expect(show(50, 95)).toBe('1 2 ... 47 48 49 50 51 52 53 ... 94 95')
    expect(show(88, 95)).toBe('1 2 ... 85 86 87 88 89 90 91 ... 94 95')
  })

  it('has no gaps or duplicates and always contains the current page', () => {
    for (const last of [14, 20, 40]) {
      for (let cur = 1; cur <= last; cur++) {
        const pages = pagerWindow(cur, last).flatMap((i) => (i.kind === 'page' ? [i.page] : []))
        expect(new Set(pages).size).toBe(pages.length)
        expect(pages).toContain(cur)
        expect(pages).toEqual([...pages].sort((a, b) => a - b))
      }
    }
  })
})

describe('pagerNumbers', () => {
  it('computes from/to/lastPage (M01 167 items, 20 per page)', () => {
    expect(pagerNumbers(167, 20, 1)).toEqual({ lastPage: 9, count: 20, from: 1, to: 20 })
    expect(pagerNumbers(167, 20, 9)).toEqual({ lastPage: 9, count: 7, from: 161, to: 167 })
  })

  it('reads 2260 videos at 24 per page as 95 pages (M09 E2E-47)', () => {
    expect(pagerNumbers(2260, 24, 1)).toMatchObject({ lastPage: 95, from: 1, to: 24 })
  })

  it('has no items beyond the last page or with no results', () => {
    expect(pagerNumbers(59, 50, 3)).toEqual({ lastPage: 2, count: 0, from: null, to: null })
    expect(pagerNumbers(0, 20, 1)).toEqual({ lastPage: 1, count: 0, from: null, to: null })
  })
})

describe('pageHref', () => {
  it('keeps the other values in order and puts page last', () => {
    expect(pageHref('', { category: 'TIPS_BELAJAR' }, 1)).toBe('?category=TIPS_BELAJAR&page=1')
    expect(pageHref('/notifikasi', { filter: 'unread', type: '' }, 2)).toBe(
      '/notifikasi?filter=unread&page=2',
    )
  })

  it('drops empty values and a stale page, keeps 0 and false', () => {
    expect(pageHref('', { a: null, b: undefined, c: '', page: 9, d: 0, e: false }, 3)).toBe(
      '?d=0&e=false&page=3',
    )
  })

  it('serialises arrays as key[]', () => {
    expect(pageHref('/x', { ids: ['1', '2'] }, 2)).toBe('/x?ids%5B%5D=1&ids%5B%5D=2&page=2')
  })
})
