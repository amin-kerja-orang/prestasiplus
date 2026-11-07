import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ACCOUNTS, bootGamesApp, loginAs, type GamesTestApp } from '../helpers'

/** FR-GM-00.1, 48 section 3.1: the weekly competition and Uji Minda are off in R1, for every role. */
describe('weekly competition and Uji Minda are off in R1 (FR-GM-00.1)', () => {
  let t: GamesTestApp
  beforeAll(async () => {
    t = await bootGamesApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it.each(['/api/games/pertandingan', '/api/games/uji-minda'])('%s answers 404 for every role', async (path) => {
    for (const email of [ACCOUNTS.student, ACCOUNTS.teacher, ACCOUNTS.admin]) {
      const c = await loginAs(t, email)
      expect((await c.get(path)).status, email).toBe(404)
    }
  })
})
