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

  it('a stored district row without a state falls back to the derived scope WITH the school state', () => {
    const grants = buildGrants(account(['ppd_officer'], school('Kedah'), [scopeRow({ districtCode: 'Kota' })]))
    expect(scopeOf(grants)).toMatchObject({ level: 'district', districtCode: 'Kota', stateCode: 'Kedah' })
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
