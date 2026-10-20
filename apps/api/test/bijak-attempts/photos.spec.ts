/** AC8: working photos through the BE-04 files service (JPEG/PNG only, 5 MB, 3 per part, private, owner only). */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { makeJpeg, makePdf, makePng, makeWebp } from '../files/fixtures'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, expectError, loginAs, OTHER_STUDENT, PAPER, startAttempt, STUDENT, TEACHER } from './helpers'

const TYPE = 'Gambar mesti JPG atau PNG, maksimum 5 MB.'
const COUNT = 'Maksimum 3 gambar bagi setiap bahagian.'
const WORKING = 'mat2-segitiga-v1-q1-a' // a working part of the Matematik K2 paper

let t: AttemptsTestApp
let me: Client
let other: Client
let dir: string

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'pp-bijak-photos-'))
  t = await bootAttemptsApp({ FILE_STORAGE_DIR: dir })
  me = await loginAs(t, STUDENT)
  other = await loginAs(t, OTHER_STUDENT)
})
afterAll(async () => {
  await t.close()
  await rm(dir, { recursive: true, force: true })
})
beforeEach(async () => {
  t.clock.set('2026-10-20T09:00:00+08:00')
  await t.db.query('truncate exam_attempts cascade')
})

const upload = (c: Client, id: string, partId: string | undefined, file: Buffer | undefined, name = 'jalan kerja.png', csrf = true) => {
  let r = c.agent.post(`/api/bijak/attempts/${id}/photos`)
  if (csrf) r = r.set('X-CSRF-Token', c.csrf)
  if (partId !== undefined) r = r.field('partId', partId)
  if (file) r = r.attach('file', file, name)
  return r
}

describe('POST /bijak/attempts/:id/photos', () => {
  it('stores a PNG privately: 201 { key, name, size }, then the autosave keeps only issued keys', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    const png = makePng({ text: 'GPS-SECRET' })
    const res = await upload(me, id, WORKING, png)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const photo = res.body.data as { key: string; name: string; size: number }
    expect(photo.name).toBe('jalan kerja.png')
    expect(photo.size).toBeGreaterThan(0)
    expect(res.headers['cache-control']).toBe('no-store')
    // owner reads it through the files service; another user and an anonymous caller do not
    expect((await me.get(`/api/files/${photo.key}`)).status).toBe(200)
    expect((await other.get(`/api/files/${photo.key}`)).status).toBe(404)
    expect((await t.http().get(`/api/files/${photo.key}`)).status).toBe(401)
    // the row is stamped like the file
    const rows = await t.db.query<{ purpose: string; is_test: boolean; part_id: string }>(
      'select f.purpose, f.is_test, p.part_id from attempt_photos p join files f on f.id = p.file_id where p.attempt_id = $1',
      [id],
    )
    expect(rows).toEqual([{ purpose: 'bijak_photo', is_test: false, part_id: WORKING }])
    // autosave: the issued key is kept (name and size from the server row), a forged key is dropped
    const forged = { key: 'AAAAAAAAAAAAAAAAAAAAAA', name: 'x.png', size: 1 }
    await me.put(`/api/bijak/attempts/${id}/answers`, {
      changes: [change(WORKING, { final: '13', photos: [{ ...photo, name: 'spoof.png', size: 7 }, forged] })],
    })
    const v = (await me.get(`/api/bijak/attempts/${id}`)).body.data
    expect(v.attempt.answers[WORKING].answer.photos).toEqual([photo])
  })

  it('accepts JPEG; refuses WebP, PDF and an executable as the BM type message (422 fields.file)', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    expect((await upload(me, id, WORKING, makeJpeg(), 'a.jpg')).status).toBe(201)
    for (const bad of [makeWebp(), makePdf(), Buffer.from('MZ-not-an-image')]) {
      const res = await upload(me, id, WORKING, bad)
      expect(expectError(res, 'VALIDATION_ERROR').fields).toEqual({ file: TYPE })
    }
  })

  it('refuses a file over 5 MB with the same message and a 4th photo of one part with the count message', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    const big = makePng({ padTo: 5 * 1024 * 1024 + 100 })
    expect(expectError(await upload(me, id, WORKING, big), 'VALIDATION_ERROR').fields).toEqual({ file: TYPE })
    for (let i = 0; i < 3; i++) expect((await upload(me, id, WORKING, makePng({ width: 2 + i }))).status).toBe(201)
    expect(expectError(await upload(me, id, WORKING, makePng({ width: 9 })), 'VALIDATION_ERROR').fields).toEqual({ file: COUNT })
    // another part keeps its own count
    expect((await upload(me, id, 'mat2-garis-v1-c1', makePng({ width: 9 }))).status).toBe(201)
  })

  it('only parts that accept working or drawing: an MCQ question, an unknown part or no partId is 422 fields.partId', async () => {
    const mcq = await startAttempt(me, PAPER.matK1)
    const qid = ((await me.get(`/api/bijak/attempts/${mcq}`)).body.data.questions[0] as { id: string }).id
    expect(Object.keys(expectError(await upload(me, mcq, qid, makePng()), 'VALIDATION_ERROR').fields ?? {})).toEqual(['partId'])
    const id = await startAttempt(me, PAPER.matK2, 'exam', true)
    expect(Object.keys(expectError(await upload(me, id, 'sn2-osmosis-a', makePng()), 'VALIDATION_ERROR').fields ?? {})).toEqual(['partId'])
    expect(Object.keys(expectError(await upload(me, id, undefined, makePng()), 'VALIDATION_ERROR').fields ?? {})).toEqual(['partId'])
    expect(Object.keys(expectError(await upload(me, id, WORKING, undefined), 'VALIDATION_ERROR').fields ?? {})).toEqual(['file'])
  })

  it('ownership 403, unknown attempt 404, closed attempt 409, teacher 403, no CSRF 403, no session 401', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    expectError(await upload(other, id, WORKING, makePng()), 'FORBIDDEN', 'Akses ditolak')
    expectError(await upload(me, '00000000-0000-4000-8000-000000000000', WORKING, makePng()), 'NOT_FOUND', 'Percubaan tidak ditemui')
    expectError(await upload(me, id, WORKING, makePng(), 'a.png', false), 'CSRF_INVALID')
    const teacher = await loginAs(t, TEACHER)
    expectError(await upload(teacher, id, WORKING, makePng()), 'FORBIDDEN')
    expect((await t.http().post(`/api/bijak/attempts/${id}/photos`)).status).toBe(401)
    await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k', changes: [] })
    expectError(await upload(me, id, WORKING, makePng()), 'CONFLICT', 'Percubaan sudah tamat')
  })

  it('sanitises the display file name (no path, no control characters, at most 100 characters)', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    const res = await upload(me, id, WORKING, makePng(), '..\\..\\etc/pass<wd>' + 'x'.repeat(200) + '.png')
    expect(res.status).toBe(201)
    const name = res.body.data.name as string
    expect(name.length).toBeLessThanOrEqual(100)
    expect(name).not.toMatch(/[\\/<>]/)
  })

  it('Mod Pelajar stamps the file as test data', async () => {
    const admin = await loginAs(t, 'admin@demo.test', true)
    const id = await startAttempt(admin, PAPER.matK2)
    expect((await upload(admin, id, WORKING, makePng())).status).toBe(201)
    const rows = await t.db.query<{ is_test: boolean }>('select f.is_test from attempt_photos p join files f on f.id = p.file_id where p.attempt_id = $1', [id])
    expect(rows[0]!.is_test).toBe(true)
  })
})
