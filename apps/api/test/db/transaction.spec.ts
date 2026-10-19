import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { withTransaction } from '../../src/db/transaction'
import { createTestDatabase, TEST_TX, type TestDatabase } from '../support/db'

let db: TestDatabase
beforeAll(async () => {
  db = await createTestDatabase()
  await db.query(
    'create table scratch (id bigint generated always as identity primary key, label text not null)',
  )
})
afterAll(async () => {
  await db.drop()
})

const count = async () =>
  Number((await db.query<{ n: string }>('select count(*) n from scratch'))[0]?.n)
const insert = (tx: { $executeRaw: typeof db.prisma.$executeRaw }, label: string) =>
  tx.$executeRaw`insert into scratch (label) values (${label})`

describe('withTransaction', () => {
  it('commits when the callback resolves and returns its value', async () => {
    const before = await count()
    const result = await withTransaction(db.prisma, async (tx) => {
      await insert(tx, 'commit')
      return 42
    }, TEST_TX)
    expect(result).toBe(42)
    expect(await count()).toBe(before + 1)
  })

  it('rolls back and rethrows when the callback throws (row visible inside, gone after)', async () => {
    const before = await count()
    let seenInside = 0
    await expect(
      withTransaction(db.prisma, async (tx) => {
        await insert(tx, 'rollback')
        const rows = await tx.$queryRaw<{ n: bigint }[]>`select count(*) n from scratch`
        seenInside = Number(rows[0]?.n)
        throw new Error('boom')
      }, TEST_TX),
    ).rejects.toThrow('boom')
    expect(seenInside).toBe(before + 1)
    expect(await count()).toBe(before)
  })

  it('a nested call reuses the outer transaction', async () => {
    let outerTx: unknown
    let innerTx: unknown
    await withTransaction(db.prisma, async (tx) => {
      outerTx = tx
      await withTransaction(db.prisma, async (inner) => {
        innerTx = inner
      })
    }, TEST_TX)
    expect(innerTx).toBe(outerTx)
  })

  it('an error escaping an inner call rolls back the outer work', async () => {
    const before = await count()
    await expect(
      withTransaction(db.prisma, async (tx) => {
        await insert(tx, 'outer')
        await withTransaction(db.prisma, async (inner) => {
          await insert(inner, 'inner')
          throw new Error('inner failed')
        })
      }, TEST_TX),
    ).rejects.toThrow('inner failed')
    expect(await count()).toBe(before)
  })
})
