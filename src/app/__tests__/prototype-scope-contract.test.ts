import { ACCESS_MATRIX, PROTOTYPE_ITEMS, SCHOOL_ADMIN_PROTOTYPE_ROWS } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { ACCOUNT_ITEMS, moduleItemsFor } from '../prototype-scope'

/** `row -> label` of the scope file for a role. */
const scopeRows = (role: 'student' | 'teacher' | 'school_admin') =>
  Object.fromEntries(moduleItemsFor(role).map((i) => [String(i.no), i.label]))

const contractRows = (role: 'student' | 'teacher') =>
  Object.fromEntries(
    PROTOTYPE_ITEMS.filter((i) => i.role === role && i.row > 0).map((i) => [
      String(i.row),
      i.labelBm,
    ]),
  )

describe('prototype-scope.ts vs packages/contract access matrix', () => {
  it('Murid rows and labels equal PROTOTYPE_ITEMS', () => {
    expect(scopeRows('student')).toEqual(contractRows('student'))
  })

  it('Guru rows and labels equal PROTOTYPE_ITEMS', () => {
    expect(scopeRows('teacher')).toEqual(contractRows('teacher'))
  })

  it('Admin Sekolah rows and labels equal the contract rows (by Pentadbiran itemIds)', () => {
    const contract = Object.fromEntries(
      SCHOOL_ADMIN_PROTOTYPE_ROWS.map((r) => [String(r.row), r.label]),
    )
    expect(scopeRows('school_admin')).toEqual(contract)
  })

  it('every contract row of Admin Sekolah points at Pentadbiran items flagged prototypeScope', () => {
    const flagged = new Set(ACCESS_MATRIX.filter((m) => m.prototypeScope).map((m) => m.id))
    const ids = SCHOOL_ADMIN_PROTOTYPE_ROWS.flatMap((r) => r.itemIds ?? [])
    expect(ids.length).toBeGreaterThan(0)
    for (const id of ids) expect(flagged.has(id), id).toBe(true)
  })

  it('section A labels equal the contract account labels', () => {
    const contract = PROTOTYPE_ITEMS.filter((i) => i.role === 'student' && i.row === 0).map(
      (i) => i.labelBm,
    )
    expect(ACCOUNT_ITEMS.map((i) => i.label)).toEqual(contract)
  })
})
