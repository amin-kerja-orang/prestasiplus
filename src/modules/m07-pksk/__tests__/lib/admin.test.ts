import { describe, expect, it } from 'vitest'

import {
  ACCESS_STATUS,
  displayDate,
  limitQuestionText,
  matchOption,
  newOption,
  optionLetter,
  queryPage,
} from '../../lib/admin'
import routes from '../../routes'
import adminRoutes from '../../routes/admin'

describe('limitQuestionText (BR-M07-23)', () => {
  it('keeps text up to 80 characters', () => {
    const t = 'a'.repeat(80)
    expect(limitQuestionText(t)).toBe(t)
  })

  it('cuts at 80, trims trailing spaces and adds "..."', () => {
    expect(limitQuestionText(`${'a'.repeat(79)} bcd`)).toBe(`${'a'.repeat(79)}...`)
    expect(limitQuestionText('b'.repeat(90))).toBe(`${'b'.repeat(80)}...`)
  })
})

describe('helpers', () => {
  it('formats a date key and an ISO timestamp as dd/mm/yyyy', () => {
    expect(displayDate('2026-06-30')).toBe('30/06/2026')
    expect(displayDate('2026-04-22T09:00:00+08:00')).toBe('22/04/2026')
  })

  it('letters the option rows from the position', () => {
    expect([0, 1, 2, 5].map(optionLetter)).toEqual(['A', 'B', 'C', 'F'])
  })

  it('gives every new option row a unique key', () => {
    expect(newOption().uid).not.toBe(newOption().uid)
  })

  it('matches a select value case-insensitively', () => {
    const opts = [{ value: 'T1' }, { value: 'T4' }]
    expect(matchOption('t1', opts)).toBe('T1')
    expect(matchOption('T9', opts)).toBe('T9')
  })

  it('parses the page number', () => {
    expect(queryPage('3')).toBe(3)
    expect(queryPage('x')).toBe(1)
    expect(queryPage(undefined)).toBe(1)
  })

  it('labels the access statuses', () => {
    expect(ACCESS_STATUS.active.label).toBe('Aktif')
    expect(ACCESS_STATUS.expired.label).toBe('Tamat Tempoh')
    expect(ACCESS_STATUS.revoked.label).toBe('Ditarik')
  })
})

describe('admin routes', () => {
  it('registers S5-S8 for the admin role with the exact tab titles', () => {
    expect(adminRoutes.map((r) => r.path)).toEqual([
      '/admin/pksk/questions',
      '/admin/pksk/questions/create',
      '/admin/pksk/questions/:id([0-9]+)/edit',
      '/admin/pksk/access',
    ])
    expect(adminRoutes.map((r) => r.meta?.title)).toEqual([
      'Soalan PKSK - Admin',
      'Tambah Soalan PKSK - Admin',
      'Edit Soalan PKSK - Admin',
      'Akses PKSK - Admin',
    ])
    for (const r of adminRoutes) {
      expect(r.meta?.layout).toBe('admin')
      expect(r.meta?.roles).toEqual(['admin'])
    }
  })

  it('is spread into the module routes after the student fragment', () => {
    expect(routes).toHaveLength(6 + 4)
  })
})
