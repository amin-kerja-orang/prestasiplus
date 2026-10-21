import { describe, expect, it } from 'vitest'

import { exportFileName, mytDateOf, parseExportQuery, parseListQuery, PEOPLE_PAGE_MAX, PEOPLE_SEARCH_MAX } from '../../src/modules/school-admin/people/people.query'

describe('people.query: list and export query parsing (pure)', () => {
  it('is_active 1 / 0 filter; anything else means all', () => {
    expect(parseListQuery({ is_active: '1' })).toMatchObject({ isActive: true })
    expect(parseListQuery({ is_active: '0' })).toMatchObject({ isActive: false })
    for (const v of ['', 'true', '2', ' x ', undefined, ['1', '0'], 1]) expect('isActive' in parseListQuery({ is_active: v })).toBe(false)
  })

  it('an invalid page is 1, a valid page is kept, a huge page is bounded', () => {
    const page = (v: unknown) => parseListQuery({ page: v }).page
    expect([page(undefined), page('abc'), page('0'), page('-3'), page('1.5'), page(['2']), page('')]).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(page('7')).toBe(7)
    expect(page(' 3 ')).toBe(3)
    expect(page('99999999')).toBe(PEOPLE_PAGE_MAX)
    expect(page('123456789')).toBe(1) // more than 8 digits is not a page
  })

  it('search is trimmed, blank is absent, long input is cut, an array is ignored', () => {
    expect(parseExportQuery({ search: '  Aina ' })).toEqual({ search: 'Aina' })
    expect(parseExportQuery({ search: '   ' })).toEqual({})
    expect(parseExportQuery({ search: ['a', 'b'] })).toEqual({})
    expect(parseExportQuery({ search: 'x'.repeat(500) }).search).toHaveLength(PEOPLE_SEARCH_MAX)
  })

  it('never reads a schoolId (or any other key) from the query', () => {
    const parsed = parseListQuery({ schoolId: '99', school_id: '99', role: 'admin', page: '2' })
    expect(parsed).toEqual({ page: 2 })
    expect(JSON.stringify(parsed)).not.toContain('99')
  })

  it('names the export file from the Malaysia date', () => {
    expect(mytDateOf('2026-10-21T09:00:00+08:00')).toBe('2026-10-21')
    expect(exportFileName('guru', '2026-10-21T09:00:00+08:00')).toBe('users-guru-2026-10-21.csv')
    expect(exportFileName('pelajar', '2026-01-02T00:30:00+08:00')).toBe('users-pelajar-2026-01-02.csv')
  })
})
