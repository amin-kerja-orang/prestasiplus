import { PerutusanDetailSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { UsersRepository } from '../../src/modules/users'
import { inspectAttachment, sanitizeGif } from '../../src/modules/content/perutusan/perutusan.files'
import { makeJpeg, makePng, makeWebp } from '../files/fixtures'
import { SCAN_MESSAGES } from '../../src/modules/files/scanning-file-storage'
import { EICAR, StubScanner } from '../files/scan-stub'
import { ADMIN, JPG, PDF, PNG, STUDENT, bootVp, errorOf, expectError, fieldsOf, login, makeGif, postPerutusan, type LoggedIn, type VpApp } from './vp-helpers'

const text = (over: Record<string, string> = {}) => ({ title: 'Dengan lampiran', body: '<p>Lihat lampiran.</p>', status: 'published', ...over })
const REFUSED = (name: string) => `${name}: format atau saiz tidak dibenarkan.`

describe('perutusan files: images and documents through BE-04 storage (AC 10, OD-28)', () => {
  let t: VpApp
  let admin: LoggedIn
  let student: LoggedIn

  const counts = async () => ({
    posts: (await t.db.query(`select 1 from perutusan`)).length,
    links: (await t.db.query(`select 1 from perutusan_files`)).length,
    files: (await t.db.query(`select 1 from files`)).length,
    objects: t.storage.keys().length,
  })

  beforeAll(async () => {
    t = await bootVp()
    admin = await login(t, ADMIN)
    student = await login(t, STUDENT)
  })
  afterAll(async () => {
    await t.close()
  })

  it('two images and one document store three perutusan_files rows (image / document) and return images[] and documents[] in the mock shape', async () => {
    const png = PNG()
    const jpg = JPG()
    const pdf = PDF()
    const res = await postPerutusan(admin, text(), {
      images: [{ bytes: png, name: 'poster.png' }, { bytes: jpg, name: 'foto.jpg' }],
      documents: [{ bytes: pdf, name: 'surat.pdf' }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const detail = PerutusanDetailSchema.parse(res.body.data)
    expect(detail.images.map((f) => f.size)).toHaveLength(2)
    expect(detail.documents).toHaveLength(1)
    expect(detail.documents[0]?.size).toBe(pdf.length)

    const rows = await t.db.query<{ kind: string; position: number; purpose: string; mime: string; size_bytes: string; storage_key: string; owner: string }>(
      `select pf.kind, pf.position, f.purpose, f.mime, f.size_bytes::text, f.storage_key, f.owner_user_id::text as owner
         from perutusan_files pf join files f on f.id = pf.file_id
        where pf.perutusan_id = $1 order by pf.kind, pf.position`,
      [detail.id],
    )
    expect(rows.map((r) => [r.kind, r.position, r.purpose, r.mime])).toEqual([
      ['document', 0, 'perutusan_document', 'application/pdf'],
      ['image', 0, 'perutusan_image', 'image/png'],
      ['image', 1, 'perutusan_image', 'image/jpeg'],
    ])
    // The sizes in the answer are the sizes of the stored objects, and the bytes sit in the BE-04 storage.
    expect(detail.images.map((f) => f.size)).toEqual(rows.filter((r) => r.kind === 'image').map((r) => Number(r.size_bytes)))
    for (const r of rows) {
      expect(r.storage_key).toMatch(/^perutusan-(image|document)\/[0-9a-f-]{36}\.(png|jpg|pdf)$/)
      expect(await t.storage.exists(r.storage_key)).toBe(true)
      expect(r.owner).toBeTruthy()
    }
    // The client file names never reach a key.
    expect(JSON.stringify(rows)).not.toMatch(/poster|foto|surat/)
    // The file names shown are stable per position (the original name is not stored).
    expect(detail.images.map((f) => f.fileName)).toEqual(['gambar-1.png', 'gambar-2.jpg'])
    expect(detail.documents.map((f) => f.fileName)).toEqual(['dokumen-1.pdf'])

    // A reader gets the same lists on the page.
    const page = PerutusanDetailSchema.parse((await student.agent.get(`/api/perutusan/${detail.id}`)).body.data)
    expect(page.images).toEqual(detail.images)
    expect(page.documents).toEqual(detail.documents)
    expect(await t.db.query(`select 1 from audit_events where action = 'content.perutusan.created' and target_id = $1`, [detail.id])).toHaveLength(1)
  })

  it('accepts the field names images[] and documents[] as the contract writes them', async () => {
    const res = await postPerutusan(admin, text(), { images: [{ bytes: PNG() }], documents: [{ bytes: PDF() }] }, { field: { images: 'images[]', documents: 'documents[]' } })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.data.images).toHaveLength(1)
    expect(res.body.data.documents).toHaveLength(1)
  })

  it('a GIF image is stored (rebuilt: comments and bytes after the trailer dropped) and returned in images[]', async () => {
    const gif = makeGif({ comment: 'secret-gps-note', trailing: Buffer.from('<script>polyglot</script>') })
    const res = await postPerutusan(admin, text({ title: 'GIF' }), { images: [{ bytes: gif, name: 'a.gif' }, { bytes: PNG() }] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const detail = PerutusanDetailSchema.parse(res.body.data)
    expect(detail.images.map((f) => f.fileName)).toEqual(['gambar-1.gif', 'gambar-2.png'])
    const [row] = await t.db.query<{ storage_key: string; mime: string; kind: string }>(
      `select f.storage_key, f.mime, pf.kind from perutusan_files pf join files f on f.id = pf.file_id where pf.perutusan_id = $1 and f.mime = 'image/gif'`,
      [detail.id],
    )
    expect(row).toMatchObject({ mime: 'image/gif', kind: 'image' })
    const stored = (await t.storage.get(row?.storage_key as string)) as Buffer
    expect(stored.toString('latin1')).not.toMatch(/secret-gps-note|polyglot/)
    expect(stored.subarray(0, 6).toString('latin1')).toBe('GIF89a')
    expect(stored[stored.length - 1]).toBe(0x3b)
    expect(detail.images[0]?.size).toBe(stored.length)
  })

  it('the contract limits apply to a GIF: over 2 MB is refused, a broken GIF is refused, nothing is stored', async () => {
    const before = await counts()
    const big = makeGif({ trailing: Buffer.alloc(2 * 1024 * 1024) })
    expect(fieldsOf(await postPerutusan(admin, text(), { images: [{ bytes: big, name: 'besar.gif' }] })).images).toBe(REFUSED('besar.gif'))
    const broken = makeGif().subarray(0, 20)
    expect(fieldsOf(await postPerutusan(admin, text(), { images: [{ bytes: broken, name: 'rosak.gif' }] })).images).toBe(REFUSED('rosak.gif'))
    // A GIF is not a document.
    expect(fieldsOf(await postPerutusan(admin, text(), { documents: [{ bytes: makeGif(), name: 'a.pdf' }] })).documents).toBe(REFUSED('a.pdf'))
    expect(await counts()).toEqual(before)
  })

  it('metadata is stripped from JPEG and PNG like every BE-04 image', async () => {
    const jpg = makeJpeg({ exifOrientation: 1, comment: 'HIDDEN-COMMENT', phone: false })
    const res = await postPerutusan(admin, text({ title: 'Metadata' }), { images: [{ bytes: jpg }, { bytes: makePng({ text: 'HIDDEN-PNG-TEXT' }) }] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const rows = await t.db.query<{ storage_key: string }>(`select f.storage_key from perutusan_files pf join files f on f.id = pf.file_id where pf.perutusan_id = $1`, [res.body.data.id])
    for (const r of rows) expect(((await t.storage.get(r.storage_key)) as Buffer).toString('latin1')).not.toMatch(/HIDDEN/)
  })

  describe('refusals store nothing', () => {
    const refuse = async (res: Awaited<ReturnType<typeof postPerutusan>>, field: string, message: string) => {
      expect(fieldsOf(res)[field]).toBe(message)
    }

    it('a file that is not what its extension says, WebP, and the wrong kind in a field: 422 under that field with the file name', async () => {
      const before = await counts()
      await refuse(await postPerutusan(admin, text(), { images: [{ bytes: Buffer.from('MZ-not-an-image'), name: 'virus.png' }] }), 'images', REFUSED('virus.png'))
      await refuse(await postPerutusan(admin, text(), { images: [{ bytes: makeWebp(), name: 'a.webp' }] }), 'images', REFUSED('a.webp'))
      await refuse(await postPerutusan(admin, text(), { images: [{ bytes: PDF(), name: 'doc.pdf' }] }), 'images', REFUSED('doc.pdf'))
      await refuse(await postPerutusan(admin, text(), { documents: [{ bytes: PNG(), name: 'pic.pdf' }] }), 'documents', REFUSED('pic.pdf'))
      await refuse(await postPerutusan(admin, text(), { documents: [{ bytes: Buffer.alloc(0), name: 'kosong.pdf' }] }), 'documents', REFUSED('kosong.pdf'))
      expect(await counts()).toEqual(before)
    })

    it('size: an image over 2 MB and a document over 5 MB are refused', async () => {
      const before = await counts()
      await refuse(await postPerutusan(admin, text(), { images: [{ bytes: makePng({ padTo: 2 * 1024 * 1024 + 200 }), name: 'besar.png' }] }), 'images', REFUSED('besar.png'))
      expect(inspectAttachment('image', makePng({ padTo: 2 * 1024 * 1024 - 1000 }))).not.toBeNull()
      const bigPdf = Buffer.concat([PDF(), Buffer.alloc(5 * 1024 * 1024)])
      // Past the hard read limit the request is cut before the files are judged: 422 under fields.form.
      expect(fieldsOf(await postPerutusan(admin, text(), { documents: [{ bytes: bigPdf, name: 'besar.pdf' }] })).form).toBe(REFUSED('Fail'))
      expect(await counts()).toEqual(before)
    })

    it('too many files and an unexpected file field: 422 under fields.form', async () => {
      const before = await counts()
      const seven = Array.from({ length: 7 }, () => ({ bytes: PNG() }))
      expect(fieldsOf(await postPerutusan(admin, text(), { images: seven })).form).toBe(REFUSED('Fail'))
      expect(fieldsOf(await postPerutusan(admin, text(), { images: [{ bytes: PNG() }] }, { field: { images: 'attachments', documents: 'documents' } })).form).toBe(REFUSED('Fail'))
      expect(await counts()).toEqual(before)
    })

    it('a refused file anywhere stops the whole post: no post, no rows, no objects', async () => {
      const before = await counts()
      const res = await postPerutusan(admin, text(), { images: [{ bytes: PNG(), name: 'ok.png' }, { bytes: Buffer.from('xx'), name: 'bad.jpg' }], documents: [{ bytes: PDF() }] })
      expect(fieldsOf(res).images).toBe(REFUSED('bad.jpg'))
      expect(await counts()).toEqual(before)
    })

    it('a very long file name is cut in the message', async () => {
      const res = await postPerutusan(admin, text(), { images: [{ bytes: Buffer.from('xx'), name: `${'n'.repeat(200)}.png` }] })
      expect(fieldsOf(res).images).toBe(REFUSED('n'.repeat(100)))
    })

    it('a failure after the objects were written (pin limit) removes the objects and rows', async () => {
      const t2 = await bootVp()
      try {
        const adm = await login(t2, ADMIN)
        for (let i = 0; i < 2; i++) expect((await postPerutusan(adm, text({ isPinned: '1' }))).status).toBe(201)
        const res = await postPerutusan(adm, text({ isPinned: '1' }), { images: [{ bytes: PNG() }], documents: [{ bytes: PDF() }] })
        expect(fieldsOf(res)).toEqual({ isPinned: 'Maksimum 2 perutusan boleh disematkan.' })
        expect(t2.storage.keys()).toEqual([])
        expect(await t2.db.query(`select 1 from files`)).toHaveLength(0)
        expect(await t2.db.query(`select 1 from perutusan_files`)).toHaveLength(0)
      } finally {
        await t2.close()
      }
    })

    it('only a writer reaches the file parser: a student upload is 403 before any byte is read or stored', async () => {
      const before = await counts()
      expectError(await postPerutusan(student, text(), { images: [{ bytes: PNG() }] }), 'FORBIDDEN')
      expect(await counts()).toEqual(before)
    })
  })

  it('a kind other than image or document is refused by the database; deleting the post cascades to its file rows', async () => {
    const res = await postPerutusan(admin, text({ title: 'Untuk dipadam' }), { images: [{ bytes: PNG() }], documents: [{ bytes: PDF() }] })
    const id = res.body.data.id as string
    const [file] = await t.db.query<{ file_id: string }>(`select file_id::text from perutusan_files where perutusan_id = $1 limit 1`, [id])
    await expect(t.db.query(`insert into perutusan_files (perutusan_id, file_id, kind) values ($1, $2, 'audio')`, [id, file?.file_id])).rejects.toThrow(/ck_perutusan_files_kind/)
    expect(await t.db.query(`select 1 from perutusan_files where perutusan_id = $1`, [id])).toHaveLength(2)
    await t.db.query(`delete from perutusan where id = $1`, [id])
    expect(await t.db.query(`select 1 from perutusan_files where perutusan_id = $1`, [id])).toHaveLength(0)
    expect(await t.db.query(`select 1 from files where id = $1`, [file?.file_id])).toHaveLength(1)
  })

  it('fail-closed reads: a perutusan file is 401 to a guest and 404 to another user through GET /api/files/:token', async () => {
    const res = await postPerutusan(admin, text({ title: 'Baca fail' }), { images: [{ bytes: PNG() }], documents: [{ bytes: PDF() }] })
    expect(res.status).toBe(201)
    const files = await t.db.query<{ public_id: string; purpose: string }>(
      `select f.public_id, f.purpose from perutusan_files pf join files f on f.id = pf.file_id where pf.perutusan_id = $1`,
      [res.body.data.id],
    )
    expect(files.map((f) => f.purpose).sort()).toEqual(['perutusan_document', 'perutusan_image'])
    for (const f of files) {
      expectError(await t.http().get(`/api/files/${f.public_id}`), 'UNAUTHORIZED')
      expectError(await student.agent.get(`/api/files/${f.public_id}`), 'NOT_FOUND')
    }
  })

  it('objects are kept when the failure comes after the commit (the rows exist), and removed when it comes before', async () => {
    const users = t.app.get(UsersRepository)
    const real = users.get.bind(users)
    let calls = 0
    // The create reads the account once before the transaction; the next read is the answer being built, after the commit.
    const spy = vi.spyOn(users, 'get').mockImplementation(async (id: string) => {
      calls += 1
      if (calls >= 2) throw new Error('boom after commit')
      return real(id)
    })
    try {
      const before = await counts()
      const res = await postPerutusan(admin, text({ title: 'Selepas komit' }), { images: [{ bytes: PNG() }], documents: [{ bytes: PDF() }] })
      expect(res.status).toBe(500)
      const after = await counts()
      expect(after.posts).toBe(before.posts + 1)
      expect(after.links).toBe(before.links + 2)
      expect(after.files).toBe(before.files + 2)
      expect(after.objects).toBe(before.objects + 2)
      const rows = await t.db.query<{ storage_key: string }>(`select f.storage_key from perutusan_files pf join files f on f.id = pf.file_id join perutusan p on p.id = pf.perutusan_id where p.title = 'Selepas komit'`)
      for (const r of rows) expect(await t.storage.exists(r.storage_key)).toBe(true)
    } finally {
      spy.mockRestore()
    }
  })

  it('error bodies for a refused upload keep the contract envelope', async () => {
    const res = await postPerutusan(admin, text(), { images: [{ bytes: Buffer.from('xx'), name: 'x.png' }] })
    expect(errorOf(res).code).toBe('VALIDATION_ERROR')
    expect(res.headers['cache-control']).toBe('no-store')
  })
})

describe('GIF rebuild (unit)', () => {
  it('keeps a valid GIF, drops comments, refuses broken ones', () => {
    const gif = makeGif({ comment: 'note' })
    const out = sanitizeGif(gif) as Buffer
    expect(out.toString('latin1')).not.toContain('note')
    expect(sanitizeGif(out)?.equals(out)).toBe(true)
    expect(sanitizeGif(gif.subarray(0, gif.length - 1))).toBeNull()
    expect(sanitizeGif(Buffer.from('GIF89a'))).toBeNull()
    expect(sanitizeGif(Buffer.from('not a gif at all, really'))).toBeNull()
    const huge = Buffer.from(gif)
    huge.writeUInt16LE(65535, 6)
    huge.writeUInt16LE(65535, 8)
    expect(sanitizeGif(huge)).toBeNull()
  })
})

describe('perutusan attachments with the malware scan on (AZ-188)', () => {
  it('an infected document is refused as 422 (not 500); nothing is stored; a clean one still posts', async () => {
    const scanner = new StubScanner()
    const t = await bootVp({}, scanner)
    try {
      const admin = await login(t, ADMIN)
      const infected = Buffer.concat([PDF(), Buffer.from(`\n%${EICAR}\n`)])
      const res = await postPerutusan(admin, text(), { documents: [{ bytes: infected }] })
      expect(res.status, JSON.stringify(res.body)).toBe(422)
      expect(fieldsOf(res).file).toBe(SCAN_MESSAGES.infected)
      expect(t.storage.keys()).toHaveLength(0)
      expect(await t.db.query(`select 1 from perutusan`)).toHaveLength(0)
      expect(await t.db.query(`select 1 from files`)).toHaveLength(0)

      const ok = await postPerutusan(admin, text(), { documents: [{ bytes: PDF() }] })
      expect(ok.status, JSON.stringify(ok.body)).toBe(201)
    } finally {
      await t.close()
    }
  })
})
