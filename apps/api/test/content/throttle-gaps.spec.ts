import { vi, afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { AudioRepository } from '../../src/modules/content/audio/audio.repository'

import { bootPartC, expectError, jsonOf, loginPartC, type LoggedIn, type PartCApp } from './audio-helpers'
import { ADMIN, TEACHER, STUDENT, bootVp, login, postPerutusan, type VpApp } from './vp-helpers'
import { apiOf } from '../users/helpers'

/** A refused call: 429 + D57 envelope + the Retry-After header that matches the body's retryAfter. */
function expectLimited(res: Parameters<typeof expectError>[0], retryAfter?: number): void {
  const err = expectError(res, 'RATE_LIMITED', 'Too Many Attempts.')
  expect(err.retryAfter).toBeGreaterThan(0)
  expect(Number(res.headers['retry-after'])).toBe(err.retryAfter)
  if (retryAfter !== undefined) expect(err.retryAfter).toBe(retryAfter)
}

const overload = () => Object.assign(new Error('pool timeout'), { code: 'P2024' })

describe('audio KBAT throttles (429 + Retry-After) and read overload', () => {
  let t: PartCApp
  let student: LoggedIn
  let teacher: LoggedIn
  let admin: LoggedIn

  beforeAll(async () => {
    t = await bootPartC({
      THROTTLE_AUDIO_KBAT_READ_PER_MINUTE: '2',
      THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE: '2',
      THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE: '2',
      THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR: '2',
    })
    student = await loginPartC(t, STUDENT)
    teacher = await loginPartC(t, TEACHER)
    admin = await loginPartC(t, ADMIN)
  })
  afterAll(async () => {
    await t.close()
  })

  it('THROTTLE_AUDIO_KBAT_READ_PER_MINUTE: the 3rd list in a minute is 429 with Retry-After; another user is unaffected', async () => {
    for (let i = 0; i < 2; i++) expect((await jsonOf(student).get('/audio-kbat-sets')).status).toBe(200)
    expectLimited(await jsonOf(student).get('/audio-kbat-sets'))
    expect((await jsonOf(admin).get('/audio-kbat-sets')).status).toBe(200)
  })

  it('THROTTLE_AUDIO_KBAT_FILE_PER_MINUTE: the 3rd section-audio request in a minute is 429 with Retry-After', async () => {
    for (let i = 0; i < 2; i++) expect((await jsonOf(student).get('/audio-kbat-sets/1/sections/1/audio')).status).toBe(404)
    expectLimited(await jsonOf(student).get('/audio-kbat-sets/1/sections/1/audio'))
  })

  it('THROTTLE_AUDIO_KBAT_ATTEMPT_PER_MINUTE: the 3rd attempt in a minute is 429 with Retry-After', async () => {
    for (let i = 0; i < 2; i++) expect((await jsonOf(student).post('/audio-kbat-sets/1/attempts', { answers: [] })).status).not.toBe(429)
    expectLimited(await jsonOf(student).post('/audio-kbat-sets/1/attempts', { answers: [] }))
  })

  it('THROTTLE_AUDIO_KBAT_ADMIN_WRITE_PER_HOUR: the 3rd admin create in the window is 429 with Retry-After', async () => {
    for (let i = 0; i < 2; i++) expect((await jsonOf(admin).post('/admin/audio-kbat-sets', {})).status).not.toBe(429)
    expectLimited(await jsonOf(admin).post('/admin/audio-kbat-sets', {}))
    expect((await t.db.query(`select 1 from audio_kbat_sets`)).length).toBe(0)
  })

  it('audio read overload (pool error in the repository) is 429 with retryAfter 5 and Retry-After 5, not 500', async () => {
    const spy = vi.spyOn(t.app.get(AudioRepository), 'getApproved').mockRejectedValueOnce(overload())
    const res = await jsonOf(teacher).get('/audio-kbat-sets/1')
    spy.mockRestore()
    expectLimited(res, 5)
  })

  it('audio section-file overload is 429 with retryAfter 5', async () => {
    const spy = vi.spyOn(t.app.get(AudioRepository), 'getApproved').mockRejectedValueOnce(Object.assign(new Error('Transaction already closed'), { code: 'P2028' }))
    const res = await jsonOf(teacher).get('/audio-kbat-sets/1/sections/1/audio')
    spy.mockRestore()
    expectLimited(res, 5)
  })
})

describe('videos and perutusan write overload', () => {
  let t: VpApp

  beforeAll(async () => {
    t = await bootVp()
  })
  afterAll(async () => {
    await t.close()
  })

  it('video create: a pool error in the transaction is 429 with retryAfter 5, nothing stored', async () => {
    const me = await login(t, TEACHER)
    const spy = vi.spyOn(t.app.get(PrismaService), 'transaction').mockRejectedValueOnce(overload())
    const res = await apiOf(me).post('/videos', { videoUrl: 'https://example.test/clip.mp4', title: 'Tekanan video', category: 'tutorial', visibility: 'global' })
    spy.mockRestore()
    expectLimited(res, 5)
    expect(await t.db.query(`select 1 from videos`)).toHaveLength(0)
  })

  it('perutusan create: a pool error in the transaction is 429 with retryAfter 5, nothing stored', async () => {
    const adm = await login(t, ADMIN)
    const spy = vi.spyOn(t.app.get(PrismaService), 'transaction').mockRejectedValueOnce(Object.assign(new Error('Transaction already closed'), { code: 'P2028' }))
    const res = await postPerutusan(adm, { title: 'Tekanan perutusan', body: '<p>Salam.</p>', status: 'published' })
    spy.mockRestore()
    expectLimited(res, 5)
    expect(await t.db.query(`select 1 from perutusan`)).toHaveLength(0)
  })
})
