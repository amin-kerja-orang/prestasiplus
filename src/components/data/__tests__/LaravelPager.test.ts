// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LaravelPager from '../LaravelPager.vue'

type Props = InstanceType<typeof LaravelPager>['$props']

function pager(props: Props) {
  return mount(LaravelPager, { props })
}

/** The numbered strip's visible tokens: page numbers and "..." (arrows have no text). */
function strip(w: ReturnType<typeof pager>): string {
  const nodes = w.get('.sm\\:flex-1 span.relative.z-0').element.children
  return Array.from(nodes)
    .map((n) => n.textContent?.trim() ?? '')
    .filter(Boolean)
    .join(' ')
}

function summary(w: ReturnType<typeof pager>): string {
  return w.get('p').text().replace(/\s+/g, ' ')
}

describe('LaravelPager: M01 E2E-39 (167 items, 20 per page)', () => {
  it('reads "Showing 1 to 20 of 167 results" with links 1-9', () => {
    const w = pager({ page: 1, total: 167, perPage: 20 })
    expect(summary(w)).toBe('Showing 1 to 20 of 167 results')
    expect(strip(w)).toBe('1 2 3 4 5 6 7 8 9')
  })

  it('page 9 has 7 items: "Showing 161 to 167 of 167 results"', () => {
    expect(summary(pager({ page: 9, total: 167, perPage: 20 }))).toBe(
      'Showing 161 to 167 of 167 results',
    )
  })

  it('keeps the filter on every link (`?filter=unread&page=2`)', () => {
    const w = pager({ page: 1, total: 167, perPage: 20, query: { filter: 'unread' } })
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('?filter=unread&page=2')
    expect(hrefs.every((h) => h?.startsWith('?filter=unread&page='))).toBe(true)
  })

  it('mobile: "« Previous" is plain text on page 1, "Next »" is a link', () => {
    const w = pager({ page: 1, total: 167, perPage: 20 })
    const mobile = w.get('.sm\\:hidden')
    const prev = mobile.findAll('span').find((s) => s.text() === '« Previous')
    expect(prev).toBeDefined()
    expect(mobile.findAll('a').map((a) => a.text())).toEqual(['Next »'])
    expect(mobile.get('a').attributes('href')).toBe('?page=2')
  })
})

describe('LaravelPager: window variants (M02 E2E-04, M04 E2E-05, M05 §8.1, M09 E2E-47)', () => {
  it('page 1 of 207 (25 per page shape, M02): 1-10 ... last two', () => {
    const w = pager({ page: 1, total: 5150, perPage: 25 })
    expect(summary(w)).toBe('Showing 1 to 25 of 5150 results')
    expect(strip(w)).toBe('1 2 3 4 5 6 7 8 9 10 ... 205 206')
  })

  it('M04: 465278 questions, 20 per page, page 1: window 1-10 ... 23263 23264', () => {
    const w = pager({ page: 1, total: 465278, perPage: 20 })
    expect(summary(w)).toBe('Showing 1 to 20 of 465278 results')
    expect(strip(w)).toBe('1 2 3 4 5 6 7 8 9 10 ... 23263 23264')
  })

  it('M09 S17: 2260 videos, 24 per page: 1-10 ... 94 95', () => {
    const w = pager({ page: 1, total: 2260, perPage: 24 })
    expect(summary(w)).toBe('Showing 1 to 24 of 2260 results')
    expect(strip(w)).toBe('1 2 3 4 5 6 7 8 9 10 ... 94 95')
  })

  it('M05 S10 page 2 of 4061 (20 per page)', () => {
    expect(summary(pager({ page: 2, total: 4061, perPage: 20 }))).toBe(
      'Showing 21 to 40 of 4061 results',
    )
  })

  it('sliding window in the middle and first two ... last ten at the end', () => {
    expect(strip(pager({ page: 50, total: 1900, perPage: 20 }))).toBe(
      '1 2 ... 47 48 49 50 51 52 53 ... 94 95',
    )
    expect(strip(pager({ page: 95, total: 1900, perPage: 20 }))).toBe(
      '1 2 ... 86 87 88 89 90 91 92 93 94 95',
    )
  })

  it('M07 S5: 763 items, 20 per page, 39 pages, 1-10 ... 38 39', () => {
    expect(strip(pager({ page: 1, total: 763, perPage: 20 }))).toBe(
      '1 2 3 4 5 6 7 8 9 10 ... 38 39',
    )
  })
})

describe('LaravelPager: markup and copy', () => {
  it('is a navigation landmark with the live label', () => {
    const nav = pager({ page: 1, total: 100, perPage: 20 }).get('nav')
    expect(nav.attributes('role')).toBe('navigation')
    expect(nav.attributes('aria-label')).toBe('Pagination Navigation')
  })

  it('page 1: previous arrow is a disabled span, next arrow a link, with the live aria-labels', () => {
    const w = pager({ page: 1, total: 100, perPage: 20 })
    const desk = w.get('span.relative.z-0')
    const disabled = desk.get('span[aria-disabled="true"]')
    expect(disabled.attributes('aria-label')).toBe('&laquo; Previous')
    expect(desk.find('a[rel="prev"]').exists()).toBe(false)
    const next = desk.get('a[rel="next"]')
    expect(next.attributes('aria-label')).toBe('Next &raquo;')
    expect(next.attributes('href')).toBe('?page=2')
  })

  it('last page: next arrow is a disabled span, previous a link', () => {
    const w = pager({ page: 5, total: 100, perPage: 20 })
    const desk = w.get('span.relative.z-0')
    expect(desk.find('a[rel="next"]').exists()).toBe(false)
    expect(desk.get('span[aria-disabled="true"]').attributes('aria-label')).toBe('Next &raquo;')
    expect(desk.get('a[rel="prev"]').attributes('href')).toBe('?page=4')
  })

  it('page links are labelled "Go to page n"; the current page is unlinked with aria-current', () => {
    const w = pager({ page: 2, total: 100, perPage: 20 })
    const labels = w.findAll('a[aria-label^="Go to page"]').map((a) => a.attributes('aria-label'))
    expect(labels).toEqual(['Go to page 1', 'Go to page 3', 'Go to page 4', 'Go to page 5'])
    const cur = w.get('[aria-current="page"]')
    expect(cur.text()).toBe('2')
    expect(cur.find('a').exists()).toBe(false)
  })

  it('gaps are aria-disabled spans reading "..."', () => {
    const w = pager({ page: 1, total: 400, perPage: 20 })
    const gap = w.findAll('span[aria-disabled="true"]').find((s) => s.text() === '...')
    expect(gap).toBeDefined()
  })

  it('numbers in the summary are the bold (font-medium) spans', () => {
    const w = pager({ page: 1, total: 100, perPage: 20 })
    expect(w.findAll('p span.font-medium').map((s) => s.text())).toEqual(['1', '20', '100'])
  })

  it('has the responsive switch: simple row below 640 (sm:hidden), full row from 640', () => {
    const w = pager({ page: 1, total: 100, perPage: 20 })
    expect(w.find('div.sm\\:hidden').exists()).toBe(true)
    expect(w.find('div.hidden.sm\\:flex').exists()).toBe(true)
  })

  it('every control has a 44px touch area and the strip can wrap (DV-M04-09)', () => {
    const w = pager({ page: 3, total: 400, perPage: 20 })
    for (const el of w.findAll('a, span > span.relative')) {
      expect(el.classes()).toContain('min-h-11')
    }
    expect(w.get('span.relative.z-0').classes()).toContain('flex-wrap')
  })
})

describe('LaravelPager: visibility', () => {
  it('is hidden with one page or none', () => {
    expect(pager({ page: 1, total: 20, perPage: 20 }).find('nav').exists()).toBe(false)
    expect(pager({ page: 1, total: 8, perPage: 20 }).find('nav').exists()).toBe(false)
    expect(pager({ page: 1, total: 0, perPage: 20 }).find('nav').exists()).toBe(false)
  })

  it('appears from 21 items at 20 per page', () => {
    expect(pager({ page: 1, total: 21, perPage: 20 }).find('nav').exists()).toBe(true)
  })

  it('alwaysShow renders "Showing 0 of 0 results" with both mobile controls plain (M13 S2)', () => {
    const w = pager({ page: 1, total: 0, perPage: 20, alwaysShow: true })
    expect(summary(w)).toBe('Showing 0 of 0 results')
    const mobile = w.get('.sm\\:hidden')
    expect(mobile.findAll('a')).toHaveLength(0)
    expect(mobile.findAll('span').map((s) => s.text())).toEqual(['« Previous', 'Next »'])
  })

  it('a page beyond the last still shows the pager: "Showing 0 of 59 results" (M15 E2E-16)', () => {
    const w = pager({ page: 3, total: 59, perPage: 50 })
    expect(summary(w)).toBe('Showing 0 of 59 results')
    expect(strip(w)).toBe('1 2')
    // previous is a link back, next is plain
    expect(w.get('a[rel="prev"]').attributes('href')).toBe('?page=2')
    expect(w.find('a[rel="next"]').exists()).toBe(false)
  })

  it('M19 S5 / M21 R06: page 2 with one page of results keeps "1" and "Showing 0 of 21 results"', () => {
    const w = pager({ page: 2, total: 21, perPage: 50 })
    expect(summary(w)).toBe('Showing 0 of 21 results')
    expect(strip(w)).toBe('1')
    const mobile = w.get('.sm\\:hidden')
    expect(mobile.findAll('a').map((a) => a.text())).toEqual(['« Previous'])
    expect(mobile.findAll('span').map((s) => s.text())).toEqual(['Next »'])
  })
})

describe('LaravelPager: invalid page input', () => {
  it.each([Number.NaN, 0, -3])('page %s is treated as page 1', (page) => {
    const w = pager({ page, total: 100, perPage: 20 })
    expect(summary(w)).toBe('Showing 1 to 20 of 100 results')
  })

  it('page 2.5 is floored to page 2 with whole numbers', () => {
    const w = pager({ page: 2.5, total: 100, perPage: 20 })
    expect(summary(w)).toBe('Showing 21 to 40 of 100 results')
    expect(w.get('[aria-current="page"]').text()).toBe('2')
  })
})

describe('LaravelPager: navigation', () => {
  it('emits change and prevents default on a plain click', async () => {
    const w = pager({ page: 1, total: 100, perPage: 20, query: { search: 'a' } })
    const link = w.get('a[aria-label="Go to page 3"]')
    expect(link.attributes('href')).toBe('?search=a&page=3')
    await link.trigger('click')
    expect(w.emitted('change')).toEqual([[3]])
  })

  it('lets a modified click fall through to the browser', async () => {
    const w = pager({ page: 1, total: 100, perPage: 20 })
    await w.get('a[aria-label="Go to page 3"]').trigger('click', { ctrlKey: true })
    expect(w.emitted('change')).toBeUndefined()
  })

  it('uses the given path', () => {
    const w = pager({ page: 1, total: 100, perPage: 20, path: '/admin/users' })
    expect(w.get('a[rel="next"]').attributes('href')).toBe('/admin/users?page=2')
  })

  it('re-renders when the page changes', async () => {
    const w = pager({ page: 1, total: 100, perPage: 20 })
    await w.setProps({ page: 2 })
    expect(summary(w)).toBe('Showing 21 to 40 of 100 results')
  })
})

describe('LaravelPager: custom pageParam (M04 S11)', () => {
  it('links use the given parameter last, keep the filters and drop a stale copy of it', () => {
    const w = mount(LaravelPager, {
      props: {
        page: 1,
        total: 100,
        perPage: 20,
        path: '/admin/soalan-gambar',
        query: { subject_id: '9', mcq_page: '4', school_id: '' },
        pageParam: 'mcq_page',
      },
    })
    expect(w.get('a[rel=next]').attributes('href')).toBe(
      '/admin/soalan-gambar?subject_id=9&mcq_page=2',
    )
    expect(w.get('a[aria-label="Go to page 3"]').attributes('href')).toBe(
      '/admin/soalan-gambar?subject_id=9&mcq_page=3',
    )
  })
})
