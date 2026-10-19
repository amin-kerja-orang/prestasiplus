import { ConfigService } from '@nestjs/config'
import { AUTH_ERROR_MESSAGES, ErrorBodySchema } from '@pp/contract'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { loadEnv } from '../../src/common/config/env.schema'
import { FilesConfig } from '../../src/modules/files/files.config'
import { FilesService } from '../../src/modules/files/files.service'
import { makeJpeg, makePdf, makePng } from './fixtures'
import { bootFilesApp, expectError, expectFieldError, type FilesTestApp, loginAs, upload, uploadOk } from './helpers'

describe('rate limit (D57a, 429)', () => {
  let t: FilesTestApp
  beforeAll(async () => {
    t = await bootFilesApp({ UPLOAD_RATE_PER_MINUTE: '3' })
  })
  afterAll(async () => {
    await t.close()
  })

  it('refuses the 4th write in a minute with RATE_LIMITED, retryAfter and Retry-After; the window then slides', async () => {
    const me = await loginAs(t, 'pelajar@demo.test')
    const other = await loginAs(t, 'pelajar2@demo.test')
    const first = await uploadOk(me, 'avatar', makePng())
    t.clock.advance(10_000)
    await uploadOk(me, 'avatar', makePng())
    // A delete counts as a write too.
    await me.agent.delete(first.url).set('X-CSRF-Token', me.csrf).expect(204)

    const res = await upload(me, 'avatar', makePng())
    const err = expectError(res, 'RATE_LIMITED', AUTH_ERROR_MESSAGES.RATE_LIMITED)
    expect(err.retryAfter).toBe(50)
    expect(res.headers['retry-after']).toBe('50')
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('RATE_LIMITED')
    expectError(await me.agent.delete(first.url).set('X-CSRF-Token', me.csrf), 'RATE_LIMITED')

    // The limit is per user.
    await uploadOk(other, 'avatar', makePng())

    t.clock.advance(51_000)
    await uploadOk(me, 'avatar', makePng())
  })

  it('a refused upload (wrong role, bad type) still counts, and costs no stored file', async () => {
    const me = await loginAs(t, 'guru@demo.test')
    t.clock.advance(120_000)
    expectError(await upload(me, 'cms_image', makePng()), 'FORBIDDEN')
    expectFieldError(await upload(me, 'question_image', Buffer.from('text')), 'The file field must be a file of type: jpeg, png, webp.')
    expectFieldError(await upload(me, 'question_image', Buffer.from('text')), 'The file field must be a file of type: jpeg, png, webp.')
    expectError(await upload(me, 'question_image', makePng()), 'RATE_LIMITED')
  })

  it('refused 429 attempts are NOT counted: hammering a refused route does not extend the wait (F7)', async () => {
    const me = await loginAs(t, 'pelajarmaju@demo.test')
    t.clock.advance(120_000)
    for (let i = 0; i < 3; i += 1) await uploadOk(me, 'avatar', makePng()) // 3 counted attempts at t0
    t.clock.advance(30_000)
    for (let i = 0; i < 5; i += 1) {
      const res = await upload(me, 'avatar', makePng())
      expect(expectError(res, 'RATE_LIMITED').retryAfter).toBe(30)
    }
    t.clock.advance(31_000) // t0 + 61 s: the three counted attempts have left the window, the five refused ones never entered it
    await uploadOk(me, 'avatar', makePng())
  })
})

describe('download rate limit (D57, separate counter)', () => {
  let t: FilesTestApp
  beforeAll(async () => {
    t = await bootFilesApp({ FILE_READS_PER_MINUTE: '3' })
  })
  afterAll(async () => {
    await t.close()
  })

  it('a signed-in user gets 429 with Retry-After on the 4th read; uploads and other users are unaffected', async () => {
    const me = await loginAs(t, 'pelajar@demo.test')
    const other = await loginAs(t, 'pelajar2@demo.test')
    const ref = await uploadOk(me, 'avatar', makePng())
    for (let i = 0; i < 3; i += 1) expect((await me.agent.get(ref.url)).status).toBe(200)
    const res = await me.agent.get(ref.url)
    const err = expectError(res, 'RATE_LIMITED', AUTH_ERROR_MESSAGES.RATE_LIMITED)
    expect(err.retryAfter).toBeGreaterThan(0)
    expect(res.headers['retry-after']).toBe(String(err.retryAfter))
    // a refused read of an unknown token also counts as a read (and is limited the same way)
    expectError(await me.agent.get('/api/files/AAAAAAAAAAAAAAAAAAAAAA'), 'RATE_LIMITED')
    // separate counters: the write path still works, another user still reads
    await uploadOk(me, 'avatar', makePng())
    expectError(await other.agent.get(ref.url), 'NOT_FOUND')
    t.clock.advance(61_000)
    expect((await me.agent.get(ref.url)).status).toBe(200)
  })

  it('anonymous reads of the public cms_image are limited per address', async () => {
    const admin = await loginAs(t, 'admin@demo.test')
    const cms = await uploadOk(admin, 'cms_image', makePng())
    t.clock.advance(61_000)
    for (let i = 0; i < 3; i += 1) expect((await t.http().get(cms.url)).status).toBe(200)
    const res = await t.http().get(cms.url)
    expectError(res, 'RATE_LIMITED', AUTH_ERROR_MESSAGES.RATE_LIMITED)
    expect(res.headers['retry-after']).toBeDefined()
    // a signed-in user has their own counter
    expect((await admin.agent.get(cms.url)).status).toBe(200)
    t.clock.advance(61_000)
    expect((await t.http().get(cms.url)).status).toBe(200)
  })
})

describe('SlidingWindow housekeeping', () => {
  it('sweeps idle keys at most once a minute instead of on every hit', async () => {
    const { SlidingWindow } = await import('../../src/modules/files/upload-throttle')
    const { FixedClock } = await import('../../src/db/clock')
    const clock = new FixedClock('2026-10-20T09:00:00+08:00')
    const w = new SlidingWindow(() => 5, clock)
    for (let i = 0; i < 50; i += 1) w.hit(`k${i}`)
    expect(w.size).toBe(50)
    clock.advance(30_000)
    w.hit('later') // inside the minute since the first sweep: nothing is swept, all 51 keys stay
    expect(w.size).toBe(51)
    clock.advance(61_000)
    w.hit('later') // a minute passed: the 50 idle keys go
    expect(w.size).toBe(1)
  })
})

describe('MAX_UPLOAD_MB is the global ceiling', () => {
  let t: FilesTestApp
  beforeAll(async () => {
    t = await bootFilesApp({ MAX_UPLOAD_MB: '1' })
  })
  afterAll(async () => {
    await t.close()
  })

  it('caps a purpose below its own limit and says so in kilobytes', async () => {
    const me = await loginAs(t, 'pelajar@demo.test')
    await uploadOk(me, 'avatar', makeJpeg({ padTo: 1024 * 1024 }), 'a.jpg', 'image/jpeg')
    expectFieldError(
      await upload(me, 'avatar', makeJpeg({ padTo: 1024 * 1024 + 1 }), { filename: 'a.jpg', contentType: 'image/jpeg' }),
      'The file field must not be greater than 1024 kilobytes.',
    )
    expectFieldError(
      await upload(me, 'avatar', makeJpeg({ padTo: 3 * 1024 * 1024 }), { filename: 'a.jpg', contentType: 'image/jpeg' }),
      'The file field must not be greater than 1024 kilobytes.',
    )
  })
})

describe('derived files up to INTAKE_MAX_FILE_MB (AC 7)', () => {
  let t: FilesTestApp
  beforeAll(async () => {
    t = await bootFilesApp({ INTAKE_MAX_FILE_MB: '2' })
  })
  afterAll(async () => {
    await t.close()
  })

  it('accepts a derived file at the limit and refuses one above it; the public route does not take the purpose', async () => {
    const files = t.app.get(FilesService)
    const owner = (await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`))[0]?.id as string
    const atLimit = await files.storeDerived({ ownerUserId: owner, purpose: 'intake_original', bytes: makePdf(2 * 1024 * 1024) })
    expect(atLimit).toMatchObject({ purpose: 'intake_original', mime: 'application/pdf', size: 2 * 1024 * 1024 })

    await expect(
      files.storeDerived({ ownerUserId: owner, purpose: 'intake_original', bytes: makePdf(2 * 1024 * 1024 + 1) }),
    ).rejects.toMatchObject({ fields: { file: 'The file field must not be greater than 2048 kilobytes.' } })
    // Wrong type for a page image, and an unknown purpose.
    await expect(files.storeDerived({ ownerUserId: owner, purpose: 'intake_page', bytes: makePdf() })).rejects.toMatchObject({ status: 422 })
    await expect(
      files.storeDerived({ ownerUserId: owner, purpose: 'avatar' as never, bytes: makePng() }),
    ).rejects.toThrow('Unknown derived purpose')

    const page = await files.storeDerived({ ownerUserId: owner, purpose: 'intake_page', bytes: makePng() })
    const row = (await t.db.query<{ storage_key: string }>('select storage_key from files where id = $1', [page.id]))[0]
    expect(row?.storage_key).toMatch(/^intake-page\/[0-9a-f-]{36}\.png$/)

    const admin = await loginAs(t, 'admin@demo.test')
    const other = await loginAs(t, 'pelajar@demo.test')
    expect((await admin.agent.get(`/api/files/${atLimit.publicId}`)).status).toBe(200)
    expectError(await other.agent.get(`/api/files/${atLimit.publicId}`), 'NOT_FOUND')
    expectError(await upload(admin, 'intake_original', makePdf()), 'VALIDATION_ERROR')
    expect((await files.readStored(page.id))?.bytes.length).toBeGreaterThan(0)
  })
})

describe('environment', () => {
  const KEYS = ['NODE_ENV', 'FILE_STORAGE_DIR', 'MAX_UPLOAD_MB', 'INTAKE_MAX_FILE_MB', 'UPLOAD_RATE_PER_MINUTE', 'FILE_READS_PER_MINUTE']
  const saved: Record<string, string | undefined> = {}
  beforeEach(() => {
    for (const k of KEYS) saved[k] = process.env[k]
  })
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })
  // ConfigService reads process.env first, so each case sets exactly the keys it means.
  const config = (env: Record<string, string>): FilesConfig => {
    for (const k of KEYS) delete process.env[k]
    Object.assign(process.env, env)
    return new FilesConfig(new ConfigService())
  }

  it('requires FILE_STORAGE_DIR in production only (boot fails fast)', () => {
    expect(() => config({ NODE_ENV: 'production' })).toThrow(/FILE_STORAGE_DIR/)
    expect(config({ NODE_ENV: 'production', FILE_STORAGE_DIR: '/data/files' }).storageDir).toBe('/data/files')
    expect(config({ NODE_ENV: 'development' }).storageDir).toContain('pp-files')
  })

  it('defaults the limits (10 MB, 20 MB, 30 a minute) and the env schema bounds them', () => {
    const c = config({ NODE_ENV: 'test' })
    expect([c.maxUploadBytes, c.intakeMaxBytes, c.ratePerMinute, c.readsPerMinute]).toEqual([10 * 1024 * 1024, 20 * 1024 * 1024, 30, 120])
    const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@db:5432/x' }
    expect(loadEnv({ ...base, MAX_UPLOAD_MB: '5' }).MAX_UPLOAD_MB).toBe(5)
    expect(() => loadEnv({ ...base, MAX_UPLOAD_MB: '0' })).toThrow(/MAX_UPLOAD_MB/)
    expect(() => loadEnv({ ...base, MAX_UPLOAD_MB: '500' })).toThrow(/MAX_UPLOAD_MB/)
  })
})
