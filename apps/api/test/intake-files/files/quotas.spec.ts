import { ErrorBodySchema, INTAKE_FILE_MESSAGES } from '@pp/contract'
import type { Response } from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { scanPdf, textPdf } from '../pdf-fixtures'
import {
  bootIntakeApp,
  countRows,
  createBatch,
  expectFilesError,
  getBatch,
  type IntakeTestApp,
  loginAs,
  type LoggedIn,
  uploadFiles,
  uploadOk,
} from '../helpers'

function expectQuota(res: Response): void {
  expect(res.status, JSON.stringify(res.body)).toBe(429)
  const error = ErrorBodySchema.parse(res.body).error
  expect(error.code).toBe('RATE_LIMITED')
  expect(error.message).toBe(INTAKE_FILE_MESSAGES.quota)
}

describe('quotas', () => {
  let t: IntakeTestApp
  let teacher: LoggedIn
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootIntakeApp({ INTAKE_MAX_FILES_PER_BATCH: '3', INTAKE_MAX_ACTIVE_BATCHES: '2', INTAKE_DAILY_PAGE_QUOTA: '5' })
    teacher = await loginAs(t, 'guru@demo.test')
    admin = await loginAs(t, 'admin@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  const cancel = (who: LoggedIn, id: string) => who.agent.post(`/api/intake/batches/${id}/cancel`).set('X-CSRF-Token', who.csrf)

  it('files per batch: existing files count too', async () => {
    const b = await createBatch(teacher)
    await uploadOk(teacher, b.id, [{ bytes: textPdf(1, 2) }, { bytes: textPdf(1, 3) }])
    expectFilesError(await uploadFiles(teacher, b.id, [{ bytes: textPdf(1, 4) }, { bytes: textPdf(1, 5) }]), INTAKE_FILE_MESSAGES.tooManyFiles(3))
    expectFilesError(await uploadFiles(teacher, b.id, [{ bytes: textPdf(1, 4) }, { bytes: textPdf(1, 5) }, { bytes: textPdf(1, 6) }, { bytes: textPdf(1, 7) }]), INTAKE_FILE_MESSAGES.tooManyFiles(3))
    expect(await countRows(t.db, 'intake_files')).toBe(2)
    await uploadOk(teacher, b.id, [{ bytes: textPdf(1, 4) }])
    expectFilesError(await uploadFiles(teacher, b.id, [{ bytes: textPdf(1, 5) }]), INTAKE_FILE_MESSAGES.tooManyFiles(3))
    expect((await getBatch(teacher, b.id)).fileCount).toBe(3)
    expect((await cancel(teacher, b.id)).status).toBe(200)
  })

  it('active batches: a teacher may have 2 open; the 3rd is 429; finishing or cancelling frees a slot; Admin Pusat is exempt', async () => {
    const a = await createBatch(teacher)
    const b = await createBatch(teacher)
    expectQuota(await teacher.agent.post('/api/intake/batches').set('X-CSRF-Token', teacher.csrf).send({ paperType: 'trial', subject: 'MAT', kertas: 1, year: 2025, source: 'x', copyright: 'sendiri', declaration: true }))
    expect((await cancel(teacher, a.id)).status).toBe(200)
    const c = await createBatch(teacher) // a slot is free again
    expectQuota(await teacher.agent.post('/api/intake/batches').set('X-CSRF-Token', teacher.csrf).send({ paperType: 'trial', subject: 'MAT', kertas: 1, year: 2025, source: 'x', copyright: 'sendiri', declaration: true }))
    // A batch that finished processing is no longer open.
    await uploadOk(teacher, b.id, [{ bytes: textPdf(1, 8) }])
    await t.drain()
    expect((await getBatch(teacher, b.id)).status).toBe('ready_for_review')
    const d = await createBatch(teacher)
    for (let i = 0; i < 4; i++) await createBatch(admin)
    for (const id of [c.id, d.id]) await cancel(teacher, id)
  })
})

describe('daily page quota', () => {
  let t: IntakeTestApp
  let teacher: LoggedIn
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootIntakeApp({ INTAKE_DAILY_PAGE_QUOTA: '5' })
    teacher = await loginAs(t, 'guru@demo.test')
    admin = await loginAs(t, 'admin@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('5 pages per user per Malaysia day, nothing stored over it, Admin Pusat exempt, the next day resets', async () => {
    const b = await createBatch(teacher)
    await uploadOk(teacher, b.id, [{ bytes: textPdf(3, 2) }])
    const files = await countRows(t.db, 'files')
    const jobs = await countRows(t.db, 'jobs')
    expectQuota(await uploadFiles(teacher, b.id, [{ bytes: textPdf(3, 3) }]))
    expect(await countRows(t.db, 'files')).toBe(files)
    expect(await countRows(t.db, 'jobs')).toBe(jobs)
    await uploadOk(teacher, b.id, [{ bytes: textPdf(2, 4) }]) // exactly 5
    expectQuota(await uploadFiles(teacher, b.id, [{ bytes: textPdf(1, 5) }]))

    const adminBatch = await createBatch(admin)
    await uploadOk(admin, adminBatch.id, [{ bytes: textPdf(3, 6) }, { bytes: textPdf(3, 7) }])

    t.clock.advance(24 * 3600 * 1000) // the clock starts at 09:00 +08:00: +24 h is the next Malaysia day
    teacher = await loginAs(t, 'guru@demo.test') // the old session has idled out
    await uploadOk(teacher, b.id, [{ bytes: textPdf(4, 8) }])
    expectQuota(await uploadFiles(teacher, b.id, [{ bytes: textPdf(2, 9) }]))
  })
})

describe('rate limits', () => {
  let t: IntakeTestApp
  let teacher: LoggedIn
  let other: LoggedIn

  beforeAll(async () => {
    t = await bootIntakeApp({ INTAKE_WRITES_PER_MINUTE: '5', INTAKE_READS_PER_MINUTE: '3' })
    teacher = await loginAs(t, 'guru@demo.test')
    other = await loginAs(t, 'guruadmin@demo.test')
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('intake-write: create, upload and cancel share one per-user counter (429 RATE_LIMITED with Retry-After)', async () => {
    const b = await createBatch(teacher) // 1
    await uploadOk(teacher, b.id, [{ bytes: scanPdf(1, 104, 112) }]) // 2
    expect((await teacher.agent.post(`/api/intake/batches/${b.id}/cancel`).set('X-CSRF-Token', teacher.csrf)).status).toBe(200) // 3
    await createBatch(teacher) // 4
    await createBatch(teacher) // 5
    const res = await teacher.agent.post('/api/intake/batches').set('X-CSRF-Token', teacher.csrf).send({ paperType: 'trial', subject: 'MAT', kertas: 1, year: 2025, source: 'x', copyright: 'sendiri', declaration: true })
    expect(res.status).toBe(429)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('RATE_LIMITED')
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0)
    // Reading is a different bucket, and another user has their own counter.
    expect((await teacher.agent.get('/api/intake/batches')).status).toBe(200)
    expect((await other.agent.get('/api/intake/batches')).status).toBe(403) // guruadmin acts as school_admin: role refusal comes first
  })

  it('intake-read: binary routes are limited per user', async () => {
    const reader = await loginAs(t, 'admin@demo.test')
    const b = await createBatch(reader)
    const up = await uploadOk(reader, b.id, [{ bytes: textPdf(1, 9) }])
    await t.drain()
    const url = `/api/intake/files/${up.files[0]!.id}/pages/1/thumb`
    for (let i = 0; i < 3; i++) expect((await reader.agent.get(url)).status).toBe(200)
    const limited = await reader.agent.get(url)
    expect(limited.status).toBe(429)
    expect(ErrorBodySchema.parse(limited.body).error.code).toBe('RATE_LIMITED')
    // The list, the detail and the page list share the same read bucket.
    expect((await reader.agent.get(`/api/intake/files/${up.files[0]!.id}/pages`)).status).toBe(429)
    expect((await reader.agent.get('/api/intake/batches')).status).toBe(429)
    expect((await reader.agent.get(`/api/intake/batches/${b.id}`)).status).toBe(429)
  })
})
