import 'reflect-metadata'

import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { createTestDatabase, TEST_TX, type TestDatabase } from '../support/db'

describe('PrismaService', () => {
  let db: TestDatabase
  let service: PrismaService

  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(
      'create table example (id bigint generated always as identity primary key, name text not null)',
    )
    service = new PrismaService(new ConfigService({ DATABASE_URL: db.url }) as never)
  })
  afterAll(async () => {
    await service.onModuleDestroy()
    await db.drop()
  })

  it('inserts and reads inside a transaction that is rolled back; the row is gone afterwards', async () => {
    const rollback = new Error('rollback on purpose')
    let readInside: { name: string }[] = []
    await expect(
      service.transaction(async (tx) => {
        await tx.$executeRaw`insert into example (name) values (${'alpha'})`
        readInside = await service.client.$queryRaw<{ name: string }[]>`select name from example`
        throw rollback
      }, TEST_TX),
    ).rejects.toBe(rollback)
    expect(readInside).toEqual([{ name: 'alpha' }])
    expect(await service.$queryRaw`select name from example`).toEqual([])
  })

  it('client is the service outside a transaction and the transaction client inside', async () => {
    expect(service.client === service).toBe(true)
    await service.transaction(async (tx) => {
      expect(service.client === tx).toBe(true)
    }, TEST_TX)
  })

  it('has the pgcrypto extension from 0001_init', async () => {
    const rows = await db.query<{ extname: string }>(
      "select extname from pg_extension where extname = 'pgcrypto'",
    )
    expect(rows).toHaveLength(1)
  })
})
