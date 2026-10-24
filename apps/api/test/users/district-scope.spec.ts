import { capabilitiesFor, type Scope } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AuthContext } from '../../src/common/scope'
import { UsersRepository } from '../../src/modules/users'
import type { Caller } from '../../src/modules/users/caller'
import { bootUsersApp, type UsersTestApp } from './helpers'

/**
 * A district is only unique inside its state (security Medium, AM1-2 G4). The users routes are admin and
 * school_admin only, but the repository applies the active scope itself (defence in depth): a district scope
 * must never reach the users of a same-named district in another state.
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

describe('UsersRepository: district scope is matched together with its state', () => {
  let t: UsersTestApp
  let repo: UsersRepository
  let userA = ''
  let userB = ''

  beforeAll(async () => {
    t = await bootUsersApp()
    repo = t.app.get(UsersRepository)
    const school = async (code: string, state: string) =>
      (await t.db.query<{ id: string }>(
        `insert into schools (name, code, state, district) values ($1, $2, $3, 'Kota') returning id::text`,
        [`SMK ${code}`, code, state],
      ))[0]?.id as string
    const student = async (schoolId: string, name: string) => {
      const u = (await t.db.query<{ id: string }>(`insert into users (name, school_id) values ($1, $2) returning id::text`, [name, schoolId]))[0]?.id as string
      await t.db.query(`insert into user_roles (user_id, role) values ($1, 'student')`, [u])
      return u
    }
    userA = await student(await school('STA01', 'Kedah'), 'Murid Negeri A')
    userB = await student(await school('STB01', 'Sabah'), 'Murid Negeri B')
  })
  afterAll(async () => {
    await t.close()
  })

  const list = (c: Caller) => repo.list(c, { page: 1, pageSize: 50 })
  const withState: Scope = { level: 'district', districtCode: 'Kota', stateCode: 'Kedah', label: 'Kota' }

  it('list returns only the users of the school in the officer state', async () => {
    const { rows, total } = await list(officer(withState))
    expect(rows.map((r) => r.id)).toEqual([userA])
    expect(total).toBe(1)
  })

  it('detail finds the same-state user and answers null (404) for the other-state user', async () => {
    expect((await repo.findVisible(officer(withState), userA))?.id).toBe(userA)
    expect(await repo.findVisible(officer(withState), userB)).toBeNull()
    expect((await repo.findVisibleMany(officer(withState), [userA, userB])).map((r) => r.id)).toEqual([userA])
  })

  it('a district scope without a state sees nothing', async () => {
    for (const scope of [
      { level: 'district', districtCode: 'Kota', label: 'Kota' },
      { level: 'district', districtCode: 'Kota', stateCode: '', label: 'Kota' },
    ] as Scope[]) {
      expect((await list(officer(scope))).rows).toEqual([])
      expect(await repo.findVisible(officer(scope), userA)).toBeNull()
      expect(await repo.findVisible(officer(scope), userB)).toBeNull()
    }
  })

  it('a state scope without a state code sees nothing (not every state)', async () => {
    const scope = { level: 'state', label: 'x' } as Scope
    expect((await list(officer(scope))).rows).toEqual([])
    expect(await repo.findVisible(officer(scope), userA)).toBeNull()
  })
})
