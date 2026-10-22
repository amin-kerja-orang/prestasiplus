import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { makePng } from './fixtures'
import { addAccount, bootFilesApp, expectError, type FilesTestApp, loginAs, type LoggedIn, uploadOk } from './helpers'

/**
 * A PPD district is only unique inside its state (security Medium, AM1-2 G4). A PPD officer of a district in
 * state A must not read the avatar (a minor's personal data) of a user of a school in state B that happens to
 * carry the same district name.
 */
let t: FilesTestApp
let officer: LoggedIn
let sameStateUrl: string
let otherStateUrl: string

beforeAll(async () => {
  t = await bootFilesApp()
  const home = (await t.db.query<{ state: string; district: string }>(`select state, district from schools where code = 'DEMO001'`))[0]
  await t.db.query(
    `insert into schools (name, code, state, district) values ('SMK Negeri Lain', 'OTHST01', 'Negeri Lain', $1)`,
    [home?.district],
  )
  await addAccount(t.db, 'murid.negeri.lain@demo.test', 'student', 'OTHST01')
  await addAccount(t.db, 'ppd.negeri@demo.test', 'ppd_officer', 'DEMO001')
  officer = await loginAs(t, 'ppd.negeri@demo.test')
  sameStateUrl = (await uploadOk(await loginAs(t, 'pelajar@demo.test'), 'avatar', makePng())).url
  otherStateUrl = (await uploadOk(await loginAs(t, 'murid.negeri.lain@demo.test'), 'avatar', makePng())).url
})
afterAll(async () => {
  await t.close()
})

describe('avatar read by a PPD officer: the district is matched together with its state', () => {
  it('the officer reads the avatar of a school in the same state and district', async () => {
    expect((await officer.agent.get(sameStateUrl)).status).toBe(200)
  })

  it('the officer gets 404 for a school with the same district name in another state', async () => {
    const same = await t.db.query<{ n: string }>(
      `select count(*)::text as n from schools where district = (select district from schools where code = 'DEMO001')`,
    )
    expect(Number(same[0]?.n)).toBeGreaterThanOrEqual(2)
    expectError(await officer.agent.get(otherStateUrl), 'NOT_FOUND')
  })

  it('a stored district row without a state does not widen the officer to the district name alone', async () => {
    await t.db.query(
      `insert into user_scopes (user_id, role, level, district_code)
       select id, 'ppd_officer', 'district', (select district from schools where code = 'DEMO001') from users where email = 'ppd.negeri@demo.test'`,
    )
    const again = await loginAs(t, 'ppd.negeri@demo.test')
    expect((await again.agent.get(sameStateUrl)).status).toBe(200)
    expectError(await again.agent.get(otherStateUrl), 'NOT_FOUND')
  })
})
