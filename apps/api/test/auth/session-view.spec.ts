import type { RoleGrant } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import type { School, User, UserScope } from '../../src/db/generated/client'
import type { AccountRecord } from '../../src/modules/auth/account.repository'
import { buildGrants } from '../../src/modules/auth/session-view'

const school = (state: string | null, district: string | null = 'Kota'): School =>
  ({ id: 5n, name: 'SMK Ujian', state, district }) as unknown as School

const scopeRow = (over: Partial<UserScope>): UserScope =>
  ({ id: 1n, userId: 9n, role: 'ppd_officer', level: 'district', schoolId: null, stateCode: null, districtCode: null, ...over }) as UserScope

function account(roles: string[], sch: School | null, scopes: UserScope[] = []): AccountRecord {
  return {
    user: { id: 9n, schoolId: sch ? sch.id : null, mustResetPassword: false } as unknown as User,
    school: sch,
    roles,
    scopes,
    schools: new Map(sch ? [[sch.id.toString(), sch]] : []),
    avatarUrl: null,
  }
}

const scopeOf = (grants: RoleGrant[] | null) => grants?.[0]?.scope

describe('buildGrants: district scope of a ppd_officer needs the state', () => {
  it('derives the district scope WITH the school state', () => {
    const grants = buildGrants(account(['ppd_officer'], school('Kedah')))
    expect(scopeOf(grants)).toMatchObject({ level: 'district', districtCode: 'Kota', stateCode: 'Kedah' })
  })

  it('refuses the account (null) when the school has no state', () => {
    expect(buildGrants(account(['ppd_officer'], school(null)))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('')))).toBeNull()
  })

  it('a stored district row without a state refuses the account, never the home school area', () => {
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ districtCode: 'Muar' })]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ districtCode: 'Kota' })]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ districtCode: 'Kota', stateCode: '' })]))).toBeNull()
  })

  it('a stored district row with a state but no district refuses the account, never the home school area', () => {
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ stateCode: 'Sabah' })]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ stateCode: 'Kedah' })]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ stateCode: 'Kedah', districtCode: '' })]))).toBeNull()
  })

  it('a stored district row with neither district nor state still derives from the school', () => {
    expect(scopeOf(buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({})])))).toMatchObject({
      level: 'district',
      districtCode: 'Kota',
      stateCode: 'Kedah',
    })
  })

  it('a refused row refuses the whole multi-role account', () => {
    const rows = [scopeRow({ districtCode: 'Muar' })]
    expect(buildGrants(account(['ppd_officer', 'teacher'], school('Kedah'), rows))).toBeNull()
  })

  it('a stored state row without a code refuses the account; with a code it is kept', () => {
    const state = (stateCode: string | null) => scopeRow({ level: 'state', stateCode })
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [state(null)]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], school('Kedah'), [state('')]))).toBeNull()
    expect(scopeOf(buildGrants(account(['ppd_officer'], school('Kedah'), [state('Johor')])))).toMatchObject({
      level: 'state',
      stateCode: 'Johor',
    })
  })

  it('truncation: a stored code longer than 32 (district) or 16 (state) no longer equals the school value', () => {
    const longDistrict = 'D'.repeat(40)
    const longState = 'S'.repeat(20)
    const sch = school(longState, longDistrict)
    const scope = scopeOf(buildGrants(account(['ppd_officer'], sch, [scopeRow({ districtCode: longDistrict, stateCode: longState })])))
    expect(scope).toMatchObject({ level: 'district', districtCode: 'D'.repeat(32), stateCode: 'S'.repeat(16) })
    expect((scope as { districtCode: string }).districtCode).not.toBe(longDistrict)
    const derived = scopeOf(buildGrants(account(['ppd_officer'], sch)))
    expect((derived as { stateCode: string }).stateCode).not.toBe(longState)
  })

  it('a stored district row without a state and a school without a state refuses the account', () => {
    expect(buildGrants(account(['ppd_officer'], school(null), [scopeRow({ districtCode: 'Kota' })]))).toBeNull()
    expect(buildGrants(account(['ppd_officer'], null, [scopeRow({ districtCode: 'Kota' })]))).toBeNull()
  })

  it('a stored district row with a state is kept (its own state, not the school state)', () => {
    const row = scopeRow({ districtCode: 'Muar', stateCode: 'Johor' })
    const grants = buildGrants(account(['ppd_officer'], school('Kedah'), [row]))
    expect(scopeOf(grants)).toMatchObject({ level: 'district', districtCode: 'Muar', stateCode: 'Johor' })
  })
})
