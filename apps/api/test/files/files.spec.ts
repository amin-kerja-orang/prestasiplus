import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'

import { ErrorBodySchema, FILE_PURPOSE_RULES, FileRefSchema, SessionSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { FilesService } from '../../src/modules/files/files.service'
import { makeJpeg, makePdf, makePng, makeWebp } from './fixtures'
import {
  binary,
  bootFilesApp,
  expectError,
  expectFieldError,
  type FilesTestApp,
  internalId,
  loginAs,
  type LoggedIn,
  upload,
  uploadOk,
} from './helpers'

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

const rowOf = async (token: string) => (await t.db.query<Record<string, unknown>>('select * from files where public_id = $1', [token]))[0]
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

  it('the id is an opaque 128-bit token, never the database key', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    expect(ref.id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    const internal = await internalId(t.db, ref.id)
    expect(ref.id).not.toContain(internal)
    expect(ref.url).not.toContain(internal)
    const other = await uploadOk(student, 'avatar', makePng())
    expect(other.id).not.toBe(ref.id)
    // the database key is not accepted as an id
    expectError(await student.agent.get(`/api/files/${internal}`), 'NOT_FOUND')
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
    const before = keysOnDisk().length
    expectFieldError(await upload(student, 'avatar', bytes, { filename: 'x.png', contentType }), AVATAR_TYPE)
    expect(keysOnDisk().length).toBe(before)
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

  it('a body far over every limit (11 MB) is the same 422 from the multer limit, not a server error', async () => {
    const res = await upload(student, 'avatar', makeJpeg({ padTo: 11 * MB }), { filename: 'huge.jpg', contentType: 'image/jpeg' })
    expectFieldError(res, AVATAR_SIZE)
    const photo = await upload(student, 'bijak_photo', makeJpeg({ padTo: 11 * MB }), { filename: 'huge.jpg', contentType: 'image/jpeg' })
    expectFieldError(photo, PHOTO_MSG)
  })
})

describe('memory and early refusal (code review Major 2, security F5)', () => {
  it('a 3 MB body for an avatar is cut off by the per-purpose limit: 422 with the mock copy, the service never sees it', async () => {
    const spy = vi.spyOn(FilesService.prototype, 'upload')
    try {
      const res = await upload(student, 'avatar', makeJpeg({ padTo: 3 * MB }), { filename: 'three.jpg', contentType: 'image/jpeg' })
      expectFieldError(res, AVATAR_SIZE)
      expect(spy).not.toHaveBeenCalled()
      // a 3 MB body is still fine for a purpose whose limit is 5 MB
      await uploadOk(student, 'bijak_photo', makeJpeg({ padTo: 3 * MB }), 'three.jpg', 'image/jpeg')
      expect(spy).toHaveBeenCalledTimes(1)
    } finally {
      spy.mockRestore()
    }
  })

  it('an unknown or missing purpose is refused before the body is read: 422 fields.purpose, even for a huge body', async () => {
    const spy = vi.spyOn(FilesService.prototype, 'upload')
    try {
      // Over the avatar limit: if the body were read the error would be about the file, not the purpose.
      const big = makeJpeg({ padTo: 3 * MB })
      let answered = 0
      let reset = 0
      for (const purpose of ['wallpaper', undefined, '', 'intake_page']) {
        let res
        try {
          res = await upload(student, purpose, big, { filename: 'a.jpg', contentType: 'image/jpeg' })
        } catch (err) {
          // The server answered and closed the connection without reading the rest of the body: also proof.
          expect(String(err)).toMatch(/ECONNRESET|EPIPE|socket hang up/)
          reset += 1
          continue
        }
        expectFieldError(res, 'The selected purpose is invalid.', 'purpose')
        expect(ErrorBodySchema.parse(res.body).error.fields).not.toHaveProperty('file')
        answered += 1
      }
      expect(answered + reset).toBe(4) // every path asserted something
      // The same via a small body, where the answer always arrives.
      const small = await upload(student, 'wallpaper', makePng())
      expectFieldError(small, 'The selected purpose is invalid.', 'purpose')
      expect(spy).not.toHaveBeenCalled()
    } finally {
      spy.mockRestore()
    }
  })

  it('the size check runs before the content is parsed', async () => {
    // Over the avatar limit but not a picture: the size message wins because nothing is inspected first.
    const over = Buffer.alloc(2049 * KB, 0x41)
    expectFieldError(await upload(student, 'avatar', over, { filename: 'a.png' }), AVATAR_SIZE)
  })
})

describe('POST /api/files: input validation', () => {
  it('requires the file part', async () => {
    const none = await student.agent.post('/api/files?purpose=avatar').set('X-CSRF-Token', student.csrf)
    expectFieldError(none, 'The file field is required.')
  })

  it('maps multer errors (wrong field, extra field, two files) to 422 fields.file', async () => {
    const wrongField = await upload(student, 'avatar', makePng(), { field: 'upload' })
    expectFieldError(wrongField, 'The file field is required.')
    const two = await student.agent
      .post('/api/files?purpose=avatar')
      .set('X-CSRF-Token', student.csrf)
      .attach('file', makePng(), { filename: 'a.png', contentType: 'image/png' })
      .attach('file', makePng(), { filename: 'b.png', contentType: 'image/png' })
    expectFieldError(two, 'The file field is required.')
    const extra = await student.agent
      .post('/api/files?purpose=avatar')
      .set('X-CSRF-Token', student.csrf)
      .attach('file', makePng(), { filename: 'a.png', contentType: 'image/png' })
      .attach('other', makePng(), { filename: 'b.png', contentType: 'image/png' })
    expectFieldError(extra, 'The file field is required.')
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
    for (const path of keysOnDisk()) expect(path.replace(t.dir, '')).toMatch(/[\\/][a-z-]+[\\/][0-9a-f-]{36}\.(png|jpg|webp)$/)
  })

  it('a file name with a NUL byte is never stored under that name (accepted with a random key, or refused)', async () => {
    const before = keysOnDisk().length
    const res = await upload(student, 'avatar', makePng(), { filename: 'x\0.png' })
    expect([201, 422]).toContain(res.status)
    const after = keysOnDisk()
    expect(after.length).toBe(before + (res.status === 201 ? 1 : 0))
    for (const path of after) expect(path).not.toContain('x\0')
    if (res.status === 201) {
      const key = String((await rowOf(FileRefSchema.parse(res.body.data).id))?.storage_key)
      expect(key).toMatch(/^avatar\/[0-9a-f-]{36}\.png$/)
    }
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

  it('a phone-style JPEG (EXIF thumbnail, MPF, second image) is stored clean', async () => {
    const ref = await uploadOk(student, 'bijak_photo', makeJpeg({ phone: true }), 'phone.jpg', 'image/jpeg')
    const onDisk = readFileSync(join(t.dir, String((await rowOf(ref.id))?.storage_key)))
    for (const word of ['GPS-LAT', 'EXIF-THUMB-JPEG', 'MPF']) expect(onDisk.includes(Buffer.from(word))).toBe(false)
  })
})

describe('GET /api/files/:id: headers (AC 3, BE-NFR-40)', () => {
  it('serves the bytes with nosniff, revalidating private cache and an inline image disposition', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), 'me.png')
    const res = await student.agent.get(`/api/files/${ref.id}`).buffer().parse(binary)
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toBe('image/png')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.headers['content-disposition']).toBe(`inline; filename="file-${ref.id}.png"`)
    expect(res.headers['content-security-policy']).toContain("default-src 'none'")
    expect(res.headers['content-length']).toBe(String(ref.size))
    expect((res.body as Buffer).subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
  })

  it('only the public purpose may be cached without revalidation; every other purpose is no-store (shared school computers)', async () => {
    const cms = await uploadOk(admin, 'cms_image', makePng())
    expect((await t.http().get(cms.url)).headers['cache-control']).toBe('private, max-age=300')
    for (const [who, purpose] of [[student, 'bijak_photo'], [teacher, 'question_image'], [student, 'avatar']] as const) {
      const ref = await uploadOk(who, purpose, makePng())
      expect((await who.agent.get(ref.url)).headers['cache-control']).toBe('no-store')
    }
  })

  it('unknown, malformed and out-of-range ids are 404', async () => {
    for (const id of ['999999999', 'abc', '-1', '1.5', '0', '99999999999999999999999', '%27%20or%201%3D1', 'AAAAAAAAAAAAAAAAAAAAAA', 'A'.repeat(23)]) {
      expectError(await student.agent.get(`/api/files/${id}`), 'NOT_FOUND')
    }
  })

  it('a row whose object vanished is 404 and leaks no path', async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    const key = String((await rowOf(ref.id))?.storage_key)
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

  it("deleting someone else's file is 404 and leaves it alone, even for an admin", async () => {
    const ref = await uploadOk(student, 'avatar', makePng())
    for (const other of [student2, teacher, admin, schoolAdmin]) {
      expectError(await other.agent.delete(ref.url).set('X-CSRF-Token', other.csrf), 'NOT_FOUND')
    }
    expect((await student.agent.get(ref.url)).status).toBe(200)
  })

  it('no session is 401; malformed ids are 404', async () => {
    expectError(await t.http().delete('/api/files/AAAAAAAAAAAAAAAAAAAAAA'), 'UNAUTHORIZED')
    expectError(await student.agent.delete('/api/files/abc').set('X-CSRF-Token', student.csrf), 'NOT_FOUND')
  })
})

describe('audit, test data and logs', () => {
  it('records uploads and deletes without file contents or names', async () => {
    const ref = await uploadOk(student, 'avatar', makePng(), 'nama-sulit-anak.png')
    const internal = await internalId(t.db, ref.id)
    await student.agent.delete(ref.url).set('X-CSRF-Token', student.csrf).expect(204)
    const rows = await t.db.query<{ action: string; detail: Record<string, unknown>; target_id: string }>(
      `select action, detail, target_id from audit_events where target_type = 'file' and target_id = $1 order by id`,
      [internal],
    )
    expect(rows.map((r) => r.action)).toEqual(['file.uploaded', 'file.deleted'])
    expect(rows[0]?.detail).toMatchObject({ purpose: 'avatar', mime: 'image/png', size: ref.size })
    expect(JSON.stringify(rows)).not.toContain('nama-sulit-anak')
    expect(JSON.stringify(rows)).not.toContain(ref.id)
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
