import { readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { Logger, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, vi, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ReadyController } from '../../src/common/health/ready.controller'
import { ReadyService } from '../../src/common/health/ready.service'
import { runSeeds } from '../../prisma/seed'
import { walletTiersSeed } from '../../prisma/seed/core/wallet-tiers'
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
    await runSeeds([walletTiersSeed], { prisma: db.prisma }) // the reference data readiness asks for
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

  it('is 503 while the wallet tiers table is empty (a deploy that skipped the reference seed), and 200 again once they are seeded', async () => {
    const saved = await db.query<Record<string, unknown>>('select * from tiers')
    expect(saved.length).toBe(4)
    await db.query('delete from tiers')
    try {
      const res = await request(app.getHttpServer()).get('/api/ready')
      expect(res.status).toBe(503)
      expect(res.body.error.code).toBe('SERVER_ERROR')
      expect(JSON.stringify(res.body)).not.toMatch(/tier|seed/i) // the reason goes to the log only
    } finally {
      await runSeeds([walletTiersSeed], { prisma: db.prisma })
    }
    expect((await request(app.getHttpServer()).get('/api/ready')).status).toBe(200)
  })

  /** The controller keeps what the last poll said so it logs once per change; each case starts from "no poll yet". */
  const forgetLastPoll = () => {
    ;(app.get(ReadyController) as unknown as { last: string | undefined }).last = undefined
  }
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  it('M3: with no tiers the 503 body is exactly { error: { code, message, requestId } } (no reason), and the reason is logged at WARN', async () => {
    forgetLastPoll()
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    await db.query('delete from tiers')
    try {
      const res = await request(app.getHttpServer()).get('/api/ready')
      expect(res.status).toBe(503)
      expect(res.body).toEqual({ error: { code: 'SERVER_ERROR', message: 'Server Error', requestId: expect.stringMatching(UUID) } })
      expect(warn).toHaveBeenCalledTimes(1)
      expect(String(warn.mock.calls[0]?.[0])).toBe('not ready: no wallet tier is defined: run the reference seed (deploy.sh --seed-reference)')
      expect(error).not.toHaveBeenCalled() // an expected deploy state is not an error line
    } finally {
      warn.mockRestore()
      error.mockRestore()
      await runSeeds([walletTiersSeed], { prisma: db.prisma })
    }
  })

  it('N4: three consecutive not-ready polls log ONE warn; a changed reason logs again; going back to ready logs ONE info line, then nothing', async () => {
    forgetLastPoll()
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    const info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
    const get = () => request(app.getHttpServer()).get('/api/ready')
    await db.query('delete from tiers')
    try {
      for (let i = 0; i < 3; i++) expect((await get()).status).toBe(503)
      expect(warn).toHaveBeenCalledTimes(1)
      expect(info).not.toHaveBeenCalled()
      // another reason while still not ready: a new line
      await setState([])
      expect((await get()).status).toBe(503)
      expect(warn).toHaveBeenCalledTimes(2)
      expect(String(warn.mock.calls[1]?.[0])).toBe('not ready: no migration applied')
      // recovery: one info line, then silence
      await setState(allApplied())
      await runSeeds([walletTiersSeed], { prisma: db.prisma })
      for (let i = 0; i < 3; i++) expect((await get()).status).toBe(200)
      expect(info).toHaveBeenCalledTimes(1)
      expect(String(info.mock.calls[0]?.[0])).toBe('ready again')
      expect(warn).toHaveBeenCalledTimes(2)
    } finally {
      warn.mockRestore()
      info.mockRestore()
      await runSeeds([walletTiersSeed], { prisma: db.prisma })
    }
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
