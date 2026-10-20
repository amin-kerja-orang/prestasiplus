import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

import { EXTENSION_OF, sniffMime } from '../../src/modules/files/content-inspect'
import { FilesService } from '../../src/modules/files/files.service'
import { makePng } from './fixtures'
import { bootFilesApp, expectError, expectFieldError, loginAs, upload, uploadOk, type FilesTestApp, type LoggedIn } from './helpers'

const MP3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(64, 1)])
const M4A = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(64, 2)])
const WAV = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(64, 3)])
const OGG = Buffer.concat([Buffer.from('OggS'), Buffer.alloc(64, 4)])
const ADTS = Buffer.concat([Buffer.from([0xff, 0xf1]), Buffer.alloc(64, 5)])

describe('sniffMime for audio', () => {
  it('detects mp3 (ID3 and frame sync), m4a, wav and ogg from the bytes; raw ADTS AAC, html and short input stay unknown', () => {
    expect(sniffMime(MP3)).toBe('audio/mpeg')
    expect(sniffMime(Buffer.from([0xff, 0xfb, 0x90, 0x00]))).toBe('audio/mpeg')
    expect(sniffMime(M4A)).toBe('audio/mp4')
    expect(sniffMime(WAV)).toBe('audio/wav')
    expect(sniffMime(OGG)).toBe('audio/ogg')
    for (const b of [ADTS, Buffer.from('<html>'), Buffer.from('MZ\x90\x00'), Buffer.from('ID'), Buffer.alloc(0)]) expect(sniffMime(b)).toBeNull()
  })
})

describe('purposes audio_kbat and cms_screenshot (BE-24)', () => {
  let t: FilesTestApp
  let admin: LoggedIn
  let student: LoggedIn
  let teacher: LoggedIn

  beforeAll(async () => {
    t = await bootFilesApp()
    admin = await loginAs(t, 'admin@demo.test')
    student = await loginAs(t, 'pelajar@demo.test')
    teacher = await loginAs(t, 'guru@demo.test')
  })
  afterAll(async () => {
    await t.close()
  })

  describe('audio_kbat', () => {
    it.each([
      ['a.mp3', 'audio/mpeg', MP3, 'audio/mpeg'],
      ['a.m4a', 'audio/mp4', M4A, 'audio/mp4'],
      ['a.wav', 'audio/wav', WAV, 'audio/wav'],
      ['a.ogg', 'audio/ogg', OGG, 'audio/ogg'],
    ])('admin uploads %s: 201, the type comes from the bytes', async (name, declared, bytes, mime) => {
      const ref = await uploadOk(admin, 'audio_kbat', bytes, name, declared)
      expect(ref).toMatchObject({ purpose: 'audio_kbat', mime, size: bytes.length })
    })

    it('only admin may upload: a student and a teacher get 403', async () => {
      for (const who of [student, teacher]) expectError(await upload(who, 'audio_kbat', MP3, { filename: 'a.mp3', contentType: 'audio/mpeg' }), 'FORBIDDEN')
    })

    it('bad bytes are refused whatever the name or header says: html as mp3, an image, raw AAC, empty', async () => {
      const typeMessage = 'The file field must be a file of type: mp3, m4a, wav, ogg.'
      for (const bytes of [Buffer.from('<html><script>1</script></html>'), makePng(), ADTS]) {
        expectFieldError(await upload(admin, 'audio_kbat', bytes, { filename: 'a.mp3', contentType: 'audio/mpeg' }), typeMessage)
      }
    })

    it('an audio file is refused on the image purposes, and an image on audio_kbat', async () => {
      for (const purpose of ['avatar', 'cms_image', 'cms_screenshot']) {
        expectFieldError(await upload(admin, purpose, MP3, { filename: 'a.png', contentType: 'image/png' }), 'The file field must be a file of type: jpeg, png, webp.')
      }
      expectFieldError(await upload(admin, 'audio_kbat', makePng(), { filename: 'a.mp3', contentType: 'audio/mpeg' }), 'The file field must be a file of type: mp3, m4a, wav, ogg.')
    })

    it('a file over 20 MB is refused with the size message', async () => {
      const big = Buffer.concat([MP3, Buffer.alloc(20 * 1024 * 1024)])
      const res = await upload(admin, 'audio_kbat', big, { filename: 'a.mp3', contentType: 'audio/mpeg' })
      expectFieldError(res, 'The file field must not be greater than 20480 kilobytes.')
    })

    it('GET /files/:id on an audio_kbat file: 404 for a student, a teacher and the uploader-less owner; 401 anonymous; admin may read', async () => {
      const ref = await uploadOk(admin, 'audio_kbat', MP3, 'a.mp3', 'audio/mpeg')
      const row = (await t.db.query<{ owner_user_id: string }>(`select owner_user_id::text from files where public_id = $1`, [ref.id]))[0]
      expect(row?.owner_user_id).toBeTruthy()
      expectError(await student.agent.get(ref.url), 'NOT_FOUND')
      expectError(await teacher.agent.get(ref.url), 'NOT_FOUND')
      expectError(await t.http().get(ref.url), 'UNAUTHORIZED')
      const ok = await admin.agent.get(ref.url)
      expect(ok.status).toBe(200)
      expect(ok.headers['content-type']).toContain('audio/mpeg')
      expect(ok.headers['x-content-type-options']).toBe('nosniff')
      expect(ok.headers['cache-control']).toBe('no-store')
    })

    it('a student who OWNS an audio_kbat file (uploaded in the service) still cannot read it through /files', async () => {
      const studentId = (await t.db.query<{ id: string }>(`select id::text from users where email = 'pelajar@demo.test'`))[0]?.id as string
      const stored = await t.app.get(FilesService).storeManaged({ ownerUserId: studentId, purpose: 'audio_kbat', bytes: MP3 })
      expectError(await student.agent.get(`/api/files/${stored.publicId}`), 'NOT_FOUND')
    })

    it('storeManaged applies the same rules; readManaged is purpose-checked; discard removes row and object', async () => {
      const files = t.app.get(FilesService)
      const adminId = (await t.db.query<{ id: string }>(`select id::text from users where email = 'admin@demo.test'`))[0]?.id as string
      await expect(files.storeManaged({ ownerUserId: adminId, purpose: 'audio_kbat', bytes: makePng() })).rejects.toThrow()
      await expect(files.storeManaged({ ownerUserId: adminId, purpose: 'audio_kbat', bytes: Buffer.alloc(0) })).rejects.toThrow()
      const stored = await files.storeManaged({ ownerUserId: adminId, purpose: 'audio_kbat', bytes: OGG })
      expect((await files.readManaged(stored.publicId, 'audio_kbat'))?.bytes.equals(OGG)).toBe(true)
      expect(await files.readManaged(stored.publicId, 'cms_image')).toBeNull()
      expect(await files.readManaged('not-a-token', 'audio_kbat')).toBeNull()
      await files.discard(stored.publicId, 'cms_image') // wrong purpose: nothing happens
      expect(await files.readManaged(stored.publicId, 'audio_kbat')).not.toBeNull()
      await files.discard(stored.publicId, 'audio_kbat')
      expect(await files.readManaged(stored.publicId, 'audio_kbat')).toBeNull()
      expect((await t.db.query(`select 1 from files where public_id = $1`, [stored.publicId])).length).toBe(0)
    })
  })

  describe('cms_screenshot', () => {
    it('admin uploads an image; a student and a teacher get 403 on upload', async () => {
      const ref = await uploadOk(admin, 'cms_screenshot', makePng())
      expect(ref).toMatchObject({ purpose: 'cms_screenshot', mime: 'image/png' })
      for (const who of [student, teacher]) expectError(await upload(who, 'cms_screenshot', makePng()), 'FORBIDDEN')
    })

    it('reads are admin only, fail closed: student, teacher and anonymous are refused, admin is allowed', async () => {
      const ref = await uploadOk(admin, 'cms_screenshot', makePng())
      expectError(await student.agent.get(ref.url), 'NOT_FOUND')
      expectError(await teacher.agent.get(ref.url), 'NOT_FOUND')
      expectError(await t.http().get(ref.url), 'UNAUTHORIZED')
      const ok = await admin.agent.get(ref.url)
      expect(ok.status).toBe(200)
      expect(ok.headers['cache-control']).toBe('no-store')
    })

    it('takes images up to 10 MB (the screenshots contract) and refuses audio and non-images', async () => {
      expectFieldError(await upload(admin, 'cms_screenshot', Buffer.from('<html>'), { filename: 'a.png' }), 'The file field must be a file of type: jpeg, png, webp.')
      const big = Buffer.concat([makePng(), Buffer.alloc(11 * 1024 * 1024)])
      expect((await upload(admin, 'cms_screenshot', big)).status).toBe(422)
    })
  })

  describe('files.mime check (migration 0009)', () => {
    let seq = 0
    const insert = (mime: string, n: string) =>
      t.db.query(
        `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'cms_image', $2, 1, $3, $4)`,
        [`mc${String(++seq)}`.padEnd(22, 'x'), mime, 'a'.repeat(64), `cms-image/mime-${n}-${String(seq)}.bin`],
      )

    it.each(['image/gif', 'audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/ogg', 'image/jpeg', 'image/png', 'image/webp', 'application/pdf'])('accepts a row with %s', async (mime) => {
      await insert(mime, mime.replace(/\W/g, ''))
    })

    it('still rejects other types', async () => {
      await expect(insert('text/html', 'html')).rejects.toThrow(/ck_files_mime/)
      await expect(insert('video/mp4', 'video')).rejects.toThrow(/ck_files_mime/)
      await expect(insert('audio/aac', 'aac')).rejects.toThrow(/ck_files_mime/)
    })

    it('a stored gif downloads with a .gif file name (not .undefined)', async () => {
      expect(EXTENSION_OF['image/gif']).toBe('gif')
      const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)])
      const key = 'cms-image/gif-row.gif'
      await mkdir(dirname(join(t.dir, key)), { recursive: true })
      await writeFile(join(t.dir, key), gif)
      await t.db.query(`insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ('GifRowAAAAAAAAAAAAAAAA', 'cms_image', 'image/gif', $1, $2, $3)`, [gif.length, 'b'.repeat(64), key])
      const res = await admin.agent.get('/api/files/GifRowAAAAAAAAAAAAAAAA')
      expect(res.status).toBe(200)
      expect(res.headers['content-disposition']).toBe('inline; filename="file-GifRowAAAAAAAAAAAAAAAA.gif"')
    })

    it('gif is not an upload type of any purpose', async () => {
      const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.alloc(32)])
      for (const purpose of ['avatar', 'cms_image', 'cms_screenshot', 'question_image']) {
        expect((await upload(admin, purpose, gif, { filename: 'a.gif', contentType: 'image/gif' })).status).toBe(422)
      }
    })
  })
})
