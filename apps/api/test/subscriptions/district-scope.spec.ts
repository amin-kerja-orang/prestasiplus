import { capabilitiesFor, type Scope } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthContext } from '../../src/common/scope'
import { SubscriptionsRepository } from '../../src/modules/subscriptions'
import type { Caller } from '../../src/modules/users/caller'
import { addSubscription, bootSubApp, type SubTestApp } from './sub-helpers'

/**
 * A district is only unique inside its state (security Medium, AM1-2 G4). The subscription routes are admin
 * only, but the repository applies the active scope itself (defence in depth).
 */
function officer(scope: Scope): Caller {
  const auth: AuthContext = {
    sessionRowId: '00000000-0000-4000-8000-000000000002',
    userId: '1',
    roles: [{ role: 'ppd_officer', portal: 'pentadbiran', scope }],
    active: { role: 'ppd_officer', portal: 'pentadbiran', scope, via: 'direct' },
    mode: null,
    capabilities: capabilitiesFor('ppd_officer', scope).map((c) => c.key),
    mustChangePassword: false,
  }
  return { auth, userId: '1', role: 'ppd_officer', schoolId: null, isAdmin: false, requestId: null, ip: null }
}

describe('SubscriptionsRepository: district scope is matched together with its state', () => {
  let t: SubTestApp
  let repo: SubscriptionsRepository
  let subA = ''
  let subB = ''

  beforeAll(async () => {
    t = await bootSubApp()
    repo = t.get(SubscriptionsRepository)
    const school = async (code: string, state: string) =>
      (await t.db.query<{ id: string }>(
        `insert into schools (name, code, state, district) values ($1, $2, $3, 'Kota') returning id::text`,
        [`SMK ${code}`, code, state],
      ))[0]?.id as string
    subA = await addSubscription(t.db, { schoolId: await school('STA01', 'Kedah') })
    subB = await addSubscription(t.db, { schoolId: await school('STB01', 'Sabah') })
  })
  afterAll(async () => {
    await t.close()
  })

  const withState: Scope = { level: 'district', districtCode: 'Kota', stateCode: 'Kedah', label: 'Kota' }

  it('list returns only the subscription of the school in the officer state; counts agree', async () => {
    const { rows } = await repo.list(officer(withState), {})
    expect(rows.map((r) => r.id)).toEqual([subA])
    expect((await repo.counts(officer(withState))).active).toBe(1)
  })

  it('detail finds the same-state subscription and answers null (404) for the other-state one', async () => {
    expect((await repo.find(officer(withState), subA))?.id).toBe(subA)
    expect(await repo.find(officer(withState), subB)).toBeNull()
  })

  it('a district scope without a state sees nothing', async () => {
    for (const scope of [
      { level: 'district', districtCode: 'Kota', label: 'Kota' },
      { level: 'district', districtCode: 'Kota', stateCode: '', label: 'Kota' },
    ] as Scope[]) {
      expect((await repo.list(officer(scope), {})).rows).toEqual([])
      expect(await repo.find(officer(scope), subA)).toBeNull()
      expect(await repo.find(officer(scope), subB)).toBeNull()
      expect((await repo.counts(officer(scope))).active).toBe(0)
    }
  })

  it('a state scope without a state code sees nothing (not every state)', async () => {
    const scope = { level: 'state', label: 'x' } as Scope
    expect((await repo.list(officer(scope), {})).rows).toEqual([])
  })
})
