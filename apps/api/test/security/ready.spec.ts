import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, vi, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ReadyService } from '../../src/common/health/ready.service'
import { PrismaService } from '../../src/db/prisma.service'
import { createTestApp } from '../support/app'
import { createTestDatabase, type TestDatabase } from '../support/db'

const MIGRATIONS_DIR = fileURLToPath(new URL('../../prisma/migrations/', import.meta.url))
const SHIPPED = readdirSync(MIGRATIONS_DIR).filter((d) => statSync(`${MIGRATIONS_DIR}${d}`).isDirectory())

describe('GET /api/ready (BE-33)', () => {
  let db: TestDatabase
  let app: INestApplication

  beforeAll(async () => {
    db = await createTestDatabase()
    app = await createTestApp({ db })
    app.get(ReadyService).ttlMs = 0 // these cases change the DB state between calls
  })
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  // The test template is migrated with plain SQL, so `_prisma_migrations` does not exist until a spec creates it.
  async function setState(rows: { name: string; finished?: boolean; rolledBack?: boolean }[] | 'no-table'): Promise<void> {
    await db.query('drop table if exists _prisma_migrations')
    if (rows === 'no-table') return
    await db.query(`create table _prisma_migrations (
      id varchar(36) primary key, checksum varchar(64) not null, finished_at timestamptz, migration_name varchar(255) not null,
      logs text, rolled_back_at timestamptz, started_at timestamptz not null default now(), applied_steps_count integer not null default 0)`)
    for (const [i, r] of rows.entries()) {
      await db.query(
        'insert into _prisma_migrations (id, checksum, finished_at, migration_name, rolled_back_at) values ($1, $2, $3, $4, $5)',
        [`id-${i}`, 'x'.repeat(64), r.finished === false ? null : new Date(), r.name, r.rolledBack ? new Date() : null],
      )
    }
  }
  const allApplied = () => SHIPPED.map((name) => ({ name }))

  beforeEach(() => setState(allApplied()))

  it('is 200 with the documented shape, no session needed, when the DB answers and every migration is applied', async () => {
    const res = await request(app.getHttpServer()).get('/api/ready')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { status: 'ready', db: 'up', migrations: 'applied', time: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*\+08:00$/) } })
    expect(res.headers['cache-control']).toBe('no-store')
  })

  it('is 503 SERVER_ERROR when a migration row is unfinished (failed)', async () => {
    await setState([...allApplied(), { name: '9999_broken', finished: false }])
    const res = await request(app.getHttpServer()).get('/api/ready')
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).toContain('SERVER_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('9999_broken')
  })

  it('is 503 when a shipped migration is not applied or was rolled back', async () => {
    await setState(allApplied().slice(0, -1))
    expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(503)
    await setState(allApplied().map((r, i, a) => (i === a.length - 1 ? { ...r, rolledBack: true } : r)))
    expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(503)
  })

  it('is 503 when no migration is applied, or the migration table is missing', async () => {
    await setState([])
    expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(503)
    await setState('no-table')
    const res = await request(app.getHttpServer()).get('/api/ready')
    expect(res.status).toBe(503)
    expect(JSON.stringify(res.body)).not.toMatch(/_prisma_migrations|relation|does not exist/i)
  })

  it('is 503 without leaking the driver message when the database is unreachable', async () => {
    const down = await createTestApp()
    try {
      const res = await request(down.getHttpServer()).get('/api/ready')
      expect(res.status).toBe(503)
      const text = JSON.stringify(res.body)
      expect(text).toContain('SERVER_ERROR')
      expect(text).not.toMatch(/ECONNREFUSED|127\.0\.0\.1|postgres|connect/i)
    } finally {
      await down.close()
    }
  })

  it('runs one DB query for concurrent and repeated calls within the TTL, and re-checks after it', async () => {
    const svc = app.get(ReadyService)
    const prisma = app.get(PrismaService)
    const spy = vi.spyOn(prisma, '$queryRaw')
    let clock = Date.now() + 10_000
    svc.ttlMs = 3_000
    svc.now = () => clock
    try {
      const first = await Promise.all(Array.from({ length: 10 }, () => request(app.getHttpServer()).get('/api/ready')))
      expect(first.map((r) => r.status)).toEqual(Array(10).fill(200))
      clock += 2_999
      expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(200)
      expect(spy).toHaveBeenCalledTimes(1)
      // a failed result is cached for the same TTL too
      clock += 3_001
      await setState('no-table')
      expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(503)
      await setState(allApplied())
      clock += 2_000
      expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(503)
      expect(spy).toHaveBeenCalledTimes(2)
      clock += 1_001
      expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(200)
      expect(spy).toHaveBeenCalledTimes(3)
    } finally {
      spy.mockRestore()
      svc.ttlMs = 0
      svc.now = () => Date.now()
    }
  })

  it('is not rate limited (exempt from the global ceiling)', async () => {
    const prev = process.env.THROTTLE_GLOBAL_PER_MINUTE
    process.env.THROTTLE_GLOBAL_PER_MINUTE = '2'
    let tight: INestApplication | undefined
    try {
      tight = await createTestApp({ db })
    } finally {
      process.env.THROTTLE_GLOBAL_PER_MINUTE = prev
    }
    try {
      for (let i = 0; i < 6; i++) expect((await request(tight.getHttpServer()).get('/api/ready')).status).toBe(200)
    } finally {
      await tight.close()
    }
  })
})
