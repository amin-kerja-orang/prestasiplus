import { Logger } from '@nestjs/common'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { coinsPerCorrect, resetCoinsPresenceCache } from '../../src/modules/practice/coins'
import { createTestDatabase, type TestDatabase } from '../support/db'

let db: TestDatabase

beforeAll(async () => {
  db = await createTestDatabase()
}, 120_000)

afterAll(async () => {
  await db.drop()
})

beforeEach(async () => {
  resetCoinsPresenceCache()
  await db.query('drop table if exists reward_settings')
})

const create = async (value: number | null) => {
  await db.query('create table reward_settings (id int primary key, coins_per_correct int)')
  if (value !== null) await db.query('insert into reward_settings values (1, $1)', [value])
}

describe('coinsPerCorrect', () => {
  it('is 1 while the table does not exist', async () => {
    expect(await coinsPerCorrect(db.prisma)).toBe(1)
  })

  it('reads the row, and a changed row applies to the next call without waiting for the cache', async () => {
    await create(3)
    expect(await coinsPerCorrect(db.prisma)).toBe(3)
    await db.query('update reward_settings set coins_per_correct = 5 where id = 1')
    expect(await coinsPerCorrect(db.prisma)).toBe(5)
  })

  it('clamps to 0..20', async () => {
    await create(99)
    expect(await coinsPerCorrect(db.prisma)).toBe(20)
    await db.query('update reward_settings set coins_per_correct = -4')
    expect(await coinsPerCorrect(db.prisma)).toBe(0)
    await db.query('update reward_settings set coins_per_correct = 20')
    expect(await coinsPerCorrect(db.prisma)).toBe(20)
  })

  it('a missing row or a null value gives 1', async () => {
    await create(null)
    expect(await coinsPerCorrect(db.prisma)).toBe(1)
    await db.query('insert into reward_settings values (1, null)')
    expect(await coinsPerCorrect(db.prisma)).toBe(1)
  })

  it('caches only the table presence for 60 s', async () => {
    const t0 = 1_000_000
    expect(await coinsPerCorrect(db.prisma, t0)).toBe(1) // absent, cached
    await create(7)
    expect(await coinsPerCorrect(db.prisma, t0 + 59_000)).toBe(1) // still believed absent
    expect(await coinsPerCorrect(db.prisma, t0 + 60_000)).toBe(7) // re-checked, picked up without a restart
    await db.query('update reward_settings set coins_per_correct = 2')
    expect(await coinsPerCorrect(db.prisma, t0 + 61_000)).toBe(2) // value read on every call
  })

  it('a read error (table dropped after a cached "present") logs, resets the cache and returns 1', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    try {
      await create(9)
      expect(await coinsPerCorrect(db.prisma, 1_000)).toBe(9) // presence cached as true
      await db.query('drop table reward_settings')
      expect(await coinsPerCorrect(db.prisma, 2_000)).toBe(1) // cached "present" but the read fails
      expect(warn).toHaveBeenCalledTimes(1)
      await create(4)
      expect(await coinsPerCorrect(db.prisma, 3_000)).toBe(4) // cache was reset: presence re-checked at once
    } finally {
      warn.mockRestore()
    }
  })
})
