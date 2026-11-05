/**
 * S5-T05 part C: the mock handlers of API-GUR-22 (`GET/PUT /api/account/teacher-profile`,
 * `GET /api/public/teachers/:id`) keep the shapes and role rules of the real API.
 * Tests run in order and share one runtime.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { setUser } from '@/mock/core-data/set-user'
import type { MockRuntime } from '@/mock/index'

import { bootM10 } from './helpers'

const ADMIN = 1
const PELAJAR = 2
const GURU = 5

let runtime: MockRuntime
beforeAll(async () => {
  ;({ runtime } = await bootM10())
}, 240_000)

interface Answer {
  status: number
  body: Record<string, unknown>
}
async function call(method: 'GET' | 'PUT', url: string, as: number | null, body?: unknown): Promise<Answer> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({ method, url, headers, ...(body !== undefined ? { body } : {}) })
  return { status: res.status, body: res.body as Record<string, unknown> }
}
const data = (a: Answer): Record<string, unknown> => a.body.data as Record<string, unknown>
const fieldsOf = (a: Answer): Record<string, string> => (a.body as { error: { fields?: Record<string, string> } }).error.fields ?? {}

const OWN = '/api/account/teacher-profile'
const VALID = { name: 'Guru Contoh', bio: 'Pendidik Sains.', ic: '860101015432', subject: 'Matematik', qualification: 'Ijazah', experienceYears: 7 }

describe('GET /api/account/teacher-profile', () => {
  it('answers the own profile: masked IC, school name only, no e-mail or phone', async () => {
    const a = await call('GET', OWN, GURU)
    expect(a.status).toBe(200)
    expect(Object.keys(data(a)).sort()).toEqual(['bio', 'experienceYears', 'icMasked', 'name', 'qualification', 'school', 'subject'])
    const school = data(a).school as { name: string } | null
    if (school) expect(Object.keys(school)).toEqual(['name'])
    expect(JSON.stringify(a.body)).not.toMatch(/@|"phone"|"email"/)
  })

  it('is for the teacher only: 401 for a guest, 403 for a pupil and an admin', async () => {
    expect((await call('GET', OWN, null)).status).toBe(401)
    expect((await call('GET', OWN, PELAJAR)).status).toBe(403)
    expect((await call('GET', OWN, ADMIN)).status).toBe(403)
  })
})

describe('PUT /api/account/teacher-profile', () => {
  it('saves, answers "Profil dikemaskini." and reads back; the IC is only masked', async () => {
    const a = await call('PUT', OWN, GURU, { ...VALID, schoolId: 99999, phone: '0100000000', email: 'x@y.test' })
    expect(a.status).toBe(200)
    expect(a.body.status).toBe('Profil dikemaskini.')
    expect(data(a)).toMatchObject({ name: 'Guru Contoh', bio: 'Pendidik Sains.', subject: 'Matematik', qualification: 'Ijazah', experienceYears: 7, icMasked: 'xxxxxx-xx-xx32' })
    expect(JSON.stringify(a.body)).not.toContain('860101015432')
    const again = await call('GET', OWN, GURU)
    expect(data(again)).toEqual(data(a))
  })

  it('does not write the school (read-only): the school is unchanged by schoolId', async () => {
    const before = data(await call('GET', OWN, GURU)).school
    await call('PUT', OWN, GURU, { ...VALID, schoolId: 99999 })
    expect(data(await call('GET', OWN, GURU)).school).toEqual(before)
  })

  it('keeps the stored IC when ic is blank or absent', async () => {
    await call('PUT', OWN, GURU, { ...VALID, ic: '' })
    await call('PUT', OWN, GURU, { ...VALID, ic: undefined })
    expect(data(await call('GET', OWN, GURU)).icMasked).toBe('xxxxxx-xx-xx32')
  })

  it('answers the PRD BM errors and saves nothing', async () => {
    const a = await call('PUT', OWN, GURU, { name: ' ', bio: 'b'.repeat(1001), ic: '123', subject: 's'.repeat(101), qualification: 'q'.repeat(151), experienceYears: 61 })
    expect(a.status).toBe(422)
    expect(fieldsOf(a)).toEqual({
      name: 'Sila isi nama penuh.',
      bio: 'Bio tidak boleh melebihi 1000 aksara.',
      ic: 'No. IC mesti 12 digit tanpa sempang.',
      subject: 'Subjek utama tidak boleh melebihi 100 aksara.',
      qualification: 'Kelayakan tidak boleh melebihi 150 aksara.',
      experienceYears: 'Pengalaman mesti antara 0 dan 60 tahun.',
    })
    expect(data(await call('GET', OWN, GURU)).name).toBe('Guru Contoh')
    expect(fieldsOf(await call('PUT', OWN, GURU, { ...VALID, name: 'n'.repeat(256) }))).toEqual({ name: 'Nama penuh tidak boleh melebihi 255 aksara.' })
  })

  it('accepts 0 and 60 years and is for the teacher only', async () => {
    for (const experienceYears of [0, 60]) expect((await call('PUT', OWN, GURU, { ...VALID, experienceYears })).status).toBe(200)
    expect((await call('PUT', OWN, PELAJAR, VALID)).status).toBe(403)
    expect((await call('PUT', OWN, null, VALID)).status).toBe(401)
  })
})

describe('GET /api/public/teachers/:id', () => {
  const card = (id: number | string, as: number | null) => call('GET', `/api/public/teachers/${String(id)}`, as)

  it('shows the teacher card to a teacher and an admin: no IC, e-mail, phone or school', async () => {
    for (const as of [GURU, ADMIN]) {
      const a = await card(GURU, as)
      expect(a.status).toBe(200)
      expect(Object.keys(data(a)).sort()).toEqual(['bio', 'experienceYears', 'name', 'qualification', 'subject'])
      expect(data(a)).toMatchObject({ name: 'Guru Contoh', subject: 'Matematik', experienceYears: 60 })
    }
  })

  it('answers a uniform 404 to a pupil, for an unknown id and for a user who is not a teacher; 401 for a guest', async () => {
    expect((await card(GURU, PELAJAR)).status).toBe(404)
    expect((await card(99999999, GURU)).status).toBe(404)
    expect((await card('abc', GURU)).status).toBe(404)
    expect((await card(PELAJAR, GURU)).status).toBe(404)
    expect((await card(ADMIN, GURU)).status).toBe(404)
    expect((await card(GURU, null)).status).toBe(401)
  })
})
