import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { ErrorBodySchema, FILE_PURPOSE_RULES, FileRefSchema, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { binary, bootFilesApp, expectError, expectFieldError, type FilesTestApp, loginAs, type LoggedIn, upload, uploadOk } from './helpers'
import { makeJpeg, makePdf, makePng, makeWebp } from './fixtures'

const KB = 1024
const MB = 1024 * KB
const AVATAR_TYPE = 'The file field must be a file of type: jpeg, png, webp.'
const AVATAR_SIZE = 'The file field must not be greater than 2048 kilobytes.'
const PHOTO_MSG = 'Gambar mesti JPG atau PNG, maksimum 5 MB.'

let t: FilesTestApp
let student: LoggedIn
let student2: LoggedIn
let teacher: LoggedIn
let admin: LoggedIn
let schoolAdmin: LoggedIn

beforeAll(async () => {
  t = await bootFilesApp()
  ;[student, student2, teacher, admin, schoolAdmin] = await Promise.all([
    loginAs(t, 'pelajar@demo.test'),
    loginAs(t, 'pelajar2@demo.test'),
    loginAs(t, 'guru@demo.test'),
    loginAs(t, 'admin@demo.test'),
    loginAs(t, 'adminsekolah@demo.test'),
  ])
})
afterAll(async () => {
  await t.close()
})

const rowOf = async (id: string) => (await t.db.query<Record<string, unknown>>('select * from files where id = $1', [id]))[0]
const keysOnDisk = (): string[] =>
  readdirSync(t.dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))

describe('POST /api/files: accepted files (AC 1)', () => {
  it.each([
    ['PNG', () => makePng(), 'image/png', 'image/png'],
    ['JPEG', () => makeJpeg(), 'image/jpeg', 'image/jpeg'],
    ['WebP', () => makeWebp(), 'image/webp', 'image/webp'],
  ])('stores a valid %s avatar and returns a FileRef', async (_n, make, mime, contentType) => {
    const res = await upload(student, 'avatar', make(), { filename: 'gambar', contentType })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.headers['cache-control']).toBe('no-store')
    const ref = FileRefSchema.parse(res.body.data)
    expect(ref).toMatchObject({ mime, purpose: 'avatar', url: `/api/files/${ref.id}` })
    const row = await rowOf(ref.id)
    expect(row).toMatchObject({ purpose: 'avatar', mime, owner_user_id: expect.anything(), is_test: false })
    expect(Number(row?.size_bytes)).toBe(ref.size)
    expect(String(row?.sha256)).toMatch(/^[0-9a-f]{64}$/)
    expect(row?.legacy_source).toBeNull()
  })

  it('the allowed avatar types equal the mock PICTURE_TYPES', () => {
    expect([...FILE_PURPOSE_RULES.avatar.mimes].sort()).toEqual(['image/jpeg', 'image/png', 'image/webp'])
  })

  it('accepts a bijak photo (jpeg and png) from a student', async () => {
    await uploadOk(student, 'bijak_photo', makeJpeg(), 'kerja.jpg', 'image/jpeg')
    await uploadOk(student, 'bijak_photo', makePng(), 'kerja.png')
  })

  it('accepts question and cms images from the roles that manage them', async () => {
    await uploadOk(teacher, 'question_image', makePng())
    await uploadOk(admin, 'question_image', makeWebp(), 'a.webp', 'image/webp')
    await uploadOk(admin, 'cms_image', makeJpeg(), 'a.jpg', 'image/jpeg')
  })
})

describe('POST /api/files: type checks by content, with the mock copy (AC 2)', () => {
  it('rejects a text file renamed .png', async () => {
    const res = await upload(student, 'avatar', Buffer.from('this is plain text, not a picture'), { filename: 'fail.png', contentType: 'image/png' })
    expectFieldError(res, AVATAR_TYPE)
  })

  it.each([
    ['html with an image header', Buffer.from('<html><script>alert(1)</script></html>'), 'image/png'],
    ['svg with a png name', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'image/png'],
    ['an executable with a jpeg header', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]), 'image/jpeg'],
    ['a png whose body is cut short', makePng().subarray(0, 20), 'image/png'],
    ['a gif', Buffer.from('GIF89a\x01\0\x01\0\0\0\0;', 'latin1'), 'image/gif'],
    ['a pdf (not an avatar type)', makePdf(), 'application/pdf'],
  ])('rejects spoofed content: %s', async (_n, bytes, contentType) => {
    expectFieldError(await upload(student, 'avatar', bytes, { filename: 'x.png', contentType }), AVATAR_TYPE)
    expect(keysOnDisk().every((p) => !p.endsWith('x.png'))).toBe(true)
  })

  it('judges by the bytes, not the header: a real png sent as text/html is stored as png', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), 'x.html', 'text/html')
    expect(ref.mime).toBe('image/png')
  })

  it('bijak_photo takes jpeg and png only, with the mock BM copy', async () => {
    expectFieldError(await upload(student, 'bijak_photo', makeWebp(), { filename: 'a.webp', contentType: 'image/webp' }), PHOTO_MSG)
    expectFieldError(await upload(student, 'bijak_photo', Buffer.from('nope'), { filename: 'a.png' }), PHOTO_MSG)
  })
})

describe('POST /api/files: size limits (AC 2)', () => {
  it('accepts exactly 2048 KB and rejects 2049 KB for an avatar', async () => {
    const exact = makeJpeg({ padTo: 2048 * KB })
    expect(exact.length).toBe(2048 * KB)
    await uploadOk(student, 'avatar', exact, 'big.jpg', 'image/jpeg')
    const over = makeJpeg({ padTo: 2049 * KB })
    expect(over.length).toBe(2049 * KB)
    expectFieldError(await upload(student, 'avatar', over, { filename: 'big.jpg', contentType: 'image/jpeg' }), AVATAR_SIZE)
  })

  it('bijak_photo allows 5 MB and refuses 5 MB + 1 with the BM copy', async () => {
    await uploadOk(student, 'bijak_photo', makeJpeg({ padTo: 5 * MB }), 'p.jpg', 'image/jpeg')
    expectFieldError(await upload(student, 'bijak_photo', makeJpeg({ padTo: 5 * MB + 1 }), { filename: 'p.jpg', contentType: 'image/jpeg' }), PHOTO_MSG)
  })

  it('a body over the global ceiling (MAX_UPLOAD_MB) is the same 422, not a server error', async () => {
    const res = await upload(student, 'avatar', makeJpeg({ padTo: 11 * MB }), { filename: 'huge.jpg', contentType: 'image/jpeg' })
    expectFieldError(res, AVATAR_SIZE)
    const photo = await upload(student, 'bijak_photo', makeJpeg({ padTo: 11 * MB }), { filename: 'huge.jpg', contentType: 'image/jpeg' })
    expectFieldError(photo, PHOTO_MSG)
  })
})

describe('POST /api/files: input validation', () => {
  it('requires the file part and a known purpose', async () => {
    const none = await student.agent.post('/api/files?purpose=avatar').set('X-CSRF-Token', student.csrf)
    expectFieldError(none, 'The file field is required.')
    const wrongField = await upload(student, 'avatar', makePng(), { field: 'upload' })
    expect(wrongField.status).toBe(422)
    expect(ErrorBodySchema.parse(wrongField.body).error.code).toBe('VALIDATION_ERROR')
    const badPurpose = await upload(student, 'wallpaper', makePng())
    expect(badPurpose.status).toBe(422)
    expect(ErrorBodySchema.parse(badPurpose.body).error.fields).toHaveProperty('purpose')
    const noPurpose = await upload(student, undefined, makePng())
    expect(noPurpose.status).toBe(422)
    expect(ErrorBodySchema.parse(noPurpose.body).error.fields).toHaveProperty('purpose')
  })

  it('refuses a derived purpose on the public route (no endpoint for it)', async () => {
    const res = await upload(admin, 'intake_page', makeWebp())
    expect(res.status).toBe(422)
    expect(ErrorBodySchema.parse(res.body).error.fields).toHaveProperty('purpose')
  })

  it('refuses an empty file', async () => {
    expectFieldError(await upload(student, 'avatar', Buffer.alloc(0)), 'The file field is required.')
  })
})

describe('storage keys and names (AC 4)', () => {
  it('ignores a hostile client file name: the key is random and the row holds no name', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), '../../x.png')
    const row = await rowOf(ref.id)
    const key = String(row?.storage_key)
    expect(key).toMatch(/^avatar\/[0-9a-f-]{36}\.png$/)
    expect(key).not.toContain('x.png')
    expect(key).not.toContain('..')
    expect(JSON.stringify(row)).not.toContain('x.png')
    expect(existsSync(join(t.dir, key))).toBe(true)
    // Nothing was written outside the storage folder.
    expect(existsSync(join(t.dir, '..', 'x.png'))).toBe(false)
    expect(existsSync(join(t.dir, '..', '..', 'x.png'))).toBe(false)
    for (const name of ['..%2F..%2Fx.png', 'a/b\\c.png', 'sub/../../y.png']) {
      const other = await upload(student, 'avatar', makePng(), { filename: name })
      expect(other.status, name + JSON.stringify(other.body)).toBe(201)
    }
    // A name with a NUL byte may be refused by the multipart parser; it must never be stored under that name.
    await upload(student, 'avatar', makePng(), { filename: 'x\0.png' })
    for (const path of keysOnDisk()) expect(path.replace(t.dir, '')).toMatch(/[\\/][a-z-]+[\\/][0-9a-f-]{36}\.(png|jpg|webp)$/)
  })

  it('strips metadata from the stored copy and the download (EXIF GPS, comments, trailing code)', async () => {
    const src = makeJpeg({ exifOrientation: 6, comment: 'camera-serial-123', trailing: Buffer.from('<?php evil(); ?>') })
    const ref = await uploadOk(student, 'avatar', src, 'gps.jpg', 'image/jpeg')
    const key = String((await rowOf(ref.id))?.storage_key)
    const onDisk = readFileSync(join(t.dir, key))
    expect(onDisk.includes(Buffer.from('GPS-LAT'))).toBe(false)
    expect(onDisk.includes(Buffer.from('camera-serial'))).toBe(false)
    expect(onDisk.includes(Buffer.from('<?php'))).toBe(false)
    expect(ref.size).toBe(onDisk.length)
    const dl = await student.agent.get(ref.url).buffer().parse(binary)
    expect(dl.status).toBe(200)
    expect((dl.body as Buffer).equals(onDisk)).toBe(true)
  })
})

describe('GET /api/files/:id: headers and visibility (AC 3)', () => {
  it('serves the bytes with nosniff, a private cache and an inline image disposition', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), 'me.png')
    const res = await student.agent.get(`/api/files/${ref.id}`).buffer().parse(binary)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toMatch(/^private/)
    expect(res.headers['content-disposition']).toBe(`inline; filename="file-${ref.id}.png"`)
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-length']).toBe(String(ref.size))
    expect((res.body as Buffer).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('a user cannot download another user\'s bijak_photo: 404 for others, 200 for the owner', async () => {
    const ref = await uploadOk(student, 'bijak_photo', makePng(), 'jawapan.png')
    expect((await student.agent.get(ref.url)).status).toBe(200)
    for (const other of [student2, teacher, schoolAdmin, admin]) {
      expectError(await other.agent.get(ref.url), 'NOT_FOUND')
    }
    expectError(await t.http().get(ref.url), 'UNAUTHORIZED')
  })

  it('avatar and question_image: any signed-in user; no session is 401', async () => {
    const avatar = await uploadOk(student, 'avatar', makePng())
    const qi = await uploadOk(teacher, 'question_image', makePng())
    for (const ref of [avatar, qi]) {
      expect((await student2.agent.get(ref.url)).status).toBe(200)
      expect((await admin.agent.get(ref.url)).status).toBe(200)
      expectError(await t.http().get(ref.url), 'UNAUTHORIZED')
    }
  })

  it('cms_image is public (open question 1), including without a session', async () => {
    const ref = await uploadOk(admin, 'cms_image', makePng())
    const res = await t.http().get(ref.url)
    expect(res.status).toBe(200)
    expect(res.headers['x-content-type-options']).toBe('nosniff')
  })

  it('unknown, malformed and out-of-range ids are 404', async () => {
    for (const id of ['999999999', 'abc', '-1', '1.5', '0', '99999999999999999999999', '%27%20or%201%3D1']) {
      expectError(await student.agent.get(`/api/files/${id}`), 'NOT_FOUND')
    }
  })

  it('a row whose object vanished is 404 and leaks no path', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    const key = String((await rowOf(ref.id))?.storage_key)
    const { rm } = await import('node:fs/promises')
    await rm(join(t.dir, key))
    const res = await student.agent.get(ref.url)
    expectError(res, 'NOT_FOUND')
    expect(JSON.stringify(res.body)).not.toContain(key)
  })
})

describe('role, session and CSRF checks (AC 8)', () => {
  it.each([
    ['student', 'cms_image'],
    ['student', 'question_image'],
    ['teacher', 'bijak_photo'],
    ['teacher', 'cms_image'],
    ['schoolAdmin', 'cms_image'],
    ['schoolAdmin', 'bijak_photo'],
    ['admin', 'bijak_photo'],
  ] as const)('%s may not upload %s: 403, nothing stored', async (who, purpose) => {
    const actor = { student, teacher, schoolAdmin, admin }[who]
    const before = keysOnDisk().length
    const res = await upload(actor, purpose, makePng())
    expectError(res, 'FORBIDDEN')
    expect(keysOnDisk().length).toBe(before)
  })

  it('no session is 401 and nothing is stored', async () => {
    const before = keysOnDisk().length
    const res = await t.http().post('/api/files?purpose=avatar').attach('file', makePng(), { filename: 'a.png', contentType: 'image/png' })
    expectError(res, 'UNAUTHORIZED')
    expect(keysOnDisk().length).toBe(before)
  })

  it('upload and delete without or with a wrong CSRF token are 403 CSRF_INVALID', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    const before = keysOnDisk().length
    expectError(await upload(student, 'avatar', makePng(), { csrf: null }), 'CSRF_INVALID')
    expectError(await upload(student, 'avatar', makePng(), { csrf: 'salah' }), 'CSRF_INVALID')
    expectError(await student.agent.delete(ref.url), 'CSRF_INVALID')
    expectError(await student.agent.delete(ref.url).set('X-CSRF-Token', 'salah'), 'CSRF_INVALID')
    expect(keysOnDisk().length).toBe(before)
    expect((await student.agent.get(ref.url)).status).toBe(200)
  })
})

describe('DELETE /api/files/:id', () => {
  it('the owner deletes: 204, row and object gone, then 404', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    const key = String((await rowOf(ref.id))?.storage_key)
    const res = await student.agent.delete(ref.url).set('X-CSRF-Token', student.csrf)
    expect(res.status).toBe(204)
    expect(res.text).toBe('')
    expect(await rowOf(ref.id)).toBeUndefined()
    expect(existsSync(join(t.dir, key))).toBe(false)
    expectError(await student.agent.get(ref.url), 'NOT_FOUND')
    expectError(await student.agent.delete(ref.url).set('X-CSRF-Token', student.csrf), 'NOT_FOUND')
  })

  it('deleting someone else\'s file is 404 and leaves it alone, even for an admin', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    for (const other of [student2, teacher, admin, schoolAdmin]) {
      expectError(await other.agent.delete(ref.url).set('X-CSRF-Token', other.csrf), 'NOT_FOUND')
    }
    expect((await student.agent.get(ref.url)).status).toBe(200)
  })

  it('no session is 401; malformed ids are 404', async () => {
    expectError(await t.http().delete('/api/files/1'), 'UNAUTHORIZED')
    expectError(await student.agent.delete('/api/files/abc').set('X-CSRF-Token', student.csrf), 'NOT_FOUND')
  })
})

describe('audit, test data and logs', () => {
  it('records uploads and deletes without file contents or names', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), 'nama-sulit-anak.png')
    await student.agent.delete(ref.url).set('X-CSRF-Token', student.csrf).expect(204)
    const rows = await t.db.query<{ action: string; detail: Record<string, unknown>; target_id: string }>(
      `select action, detail, target_id from audit_events where target_type = 'file' and target_id = $1 order by id`,
      [ref.id],
    )
    expect(rows.map((r) => r.action)).toEqual(['file.uploaded', 'file.deleted'])
    expect(rows[0]?.detail).toMatchObject({ purpose: 'avatar', mime: 'image/png', size: ref.size })
    expect(JSON.stringify(rows)).not.toContain('nama-sulit-anak')
  })

  it('marks files written in Mod Pelajar as test data (G-07)', async () => {
    const a = await loginAs(t, 'admin@demo.test')
    const mode = await a.agent.post('/api/session/mode').set('X-CSRF-Token', a.csrf).send({ mode: 'mod_pelajar' })
    expect(mode.status).toBe(200)
    const csrf = SessionSchema.parse(mode.body.data).csrf
    const ref = await uploadOk({ agent: a.agent, csrf }, 'bijak_photo', makePng())
    expect((await rowOf(ref.id))?.is_test).toBe(true)
  })
})

describe('error shape', () => {
  it('a rejected upload is the contract error envelope with a request id', async () => {
    const res = await upload(student, 'avatar', Buffer.from('x'))
    const body = ErrorBodySchema.parse(res.body)
    expect(body.error.requestId).toBeTruthy()
    expect(body.error.message).toBe('The given data was invalid.')
  })

})
