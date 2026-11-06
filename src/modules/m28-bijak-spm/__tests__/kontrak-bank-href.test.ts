import { describe, expect, it } from 'vitest'

import { bankHref } from '../admin/kontrak/domain/pool'

/** S2-T03: the Kontrak pool links open the Studio list and keep the filters it can read. */
describe('bankHref', () => {
  it('opens the Studio list with no query when nothing is filtered', () => {
    expect(bankHref(undefined)).toBe('/admin/studio')
    expect(bankHref({})).toBe('/admin/studio')
  })

  it('passes the keys the Studio list reads through unchanged', () => {
    const query = { status: 'approved', subject_id: '3', search: 'luas', tahun: '2024', negeri: 'Johor', kertas: '1', jenis: 'sebenar' }
    const url = new URL(bankHref(query), 'http://x')
    expect(url.pathname).toBe('/admin/studio')
    expect(Object.fromEntries(url.searchParams)).toEqual(query)
  })

  it('turns dskpFilter=untagged into dskp=belum', () => {
    expect(bankHref({ status: 'approved', dskpFilter: 'untagged' })).toBe('/admin/studio?status=approved&dskp=belum')
  })

  it('turns the server key subjectId into subject_id and keeps unit', () => {
    expect(bankHref({ subjectId: '3', status: 'approved', unit: '77' })).toBe('/admin/studio?subject_id=3&status=approved&unit=77')
  })

  it.each([
    ['missing', 'tp'],
    ['tagReview', 'true'],
    ['tpMin', '1'],
    ['tpMax', '3'],
    ['kbat', '1'],
  ])('drops %s, which has no Studio filter in R1', (key, value) => {
    expect(bankHref({ status: 'approved', [key]: value })).toBe('/admin/studio?status=approved')
  })

  it('applies the same rules to the extra keys', () => {
    expect(bankHref({ status: 'approved' }, { missing: 'key', kertas: '2' })).toBe('/admin/studio?status=approved&kertas=2')
  })
})
