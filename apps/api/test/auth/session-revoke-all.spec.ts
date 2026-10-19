import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { SessionStore } from '../../src/modules/auth'
import { type AuthTestApp, bootAuthApp, loginAs, userIdOf } from './helpers'

describe('SessionStore.revokeAllFor', () => {
  let t: AuthTestApp
  let store: SessionStore

  beforeAll(async () => {
    t = await bootAuthApp()
    store = t.app.get(SessionStore)
  })
  afterAll(async () => {
    await t.close()
  })

  it('ends every live session of one user, leaves other users alone, and is idempotent', async () => {
    const a1 = await loginAs(t, 'guru@demo.test')
    const a2 = await loginAs(t, 'guru@demo.test')
    const b = await loginAs(t, 'pelajar@demo.test')
    const id = BigInt(await userIdOf(t.db, 'guru@demo.test'))
    expect(await store.revokeAllFor(id)).toBe(2)
    expect((await a1.agent.get('/api/session')).status).toBe(401)
    expect((await a2.agent.get('/api/session')).status).toBe(401)
    expect((await b.agent.get('/api/session')).status).toBe(200)
    expect(await store.revokeAllFor(id)).toBe(0)
  })

  it('with a transaction client it rolls back with the transaction', async () => {
    const c = await loginAs(t, 'pelajar2@demo.test')
    const id = BigInt(await userIdOf(t.db, 'pelajar2@demo.test'))
    await expect(
      t.db.prisma.$transaction(async (tx) => {
        expect(await store.revokeAllFor(id, tx)).toBe(1)
        throw new Error('rollback')
      }),
    ).rejects.toThrow('rollback')
    expect((await c.agent.get('/api/session')).status).toBe(200)
  })
})
