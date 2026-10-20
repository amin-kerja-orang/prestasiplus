import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { UsersRepository } from '../../src/modules/users'
import { bootUsersApp, userIdOf, type UsersTestApp } from './helpers'

describe('UsersRepository.getMany (one batched read for other cards)', () => {
  let t: UsersTestApp
  beforeAll(async () => {
    t = await bootUsersApp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('returns the same records as get(), skipping unknown and malformed ids and duplicates', async () => {
    const repo = t.app.get(UsersRepository)
    const a = await userIdOf(t.db, 'admin@demo.test')
    const b = await userIdOf(t.db, 'pelajar@demo.test')
    const rows = await repo.getMany([a, b, a, '987654321', 'abc'])
    expect(rows.map((r) => r.id).sort()).toEqual([a, b].sort())
    for (const r of rows) expect(r).toEqual(await repo.get(r.id))
    expect(await repo.getMany([])).toEqual([])
  })
})
