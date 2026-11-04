import { IntakeBatchSummarySchema, QuestionSetPaperSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { QuestionSetsPorts } from '../../src/modules/classes/question-sets'
import { GuruPaperIntakeAdapter } from '../../src/modules/classes/question-sets/guru-paper-intake.adapter'
import { scanPdf, textPdf } from '../intake-files/pdf-fixtures'
import { ADMIN, STUDENT_1, TEACHER_A, TEACHER_C, bootQsApp, client, idOfEmail, type Client, type QsTestApp } from './qs-helpers'

/** S1-T08 (API-GUR-17, FR-GUR-44-13): the teacher paper upload creates a `source = guru` intake batch through the real adapter. */
const FIELDS = { jenisSoalan: 'Trial Paper', subject: 'Matematik Tambahan', tingkatan: '4', tahun: '2025', disediakanOleh: 'Cikgu Ujian', catatan: 'Nota' }

function upload(c: Client, fields: Record<string, string>, files: { name: string; bytes: Buffer }[]) {
  let req = c.who.agent.post('/api/guru/question-papers').set('X-CSRF-Token', c.who.csrf)
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  for (const f of files) req = req.attach('files', f.bytes, f.name)
  return req
}

/** A PDF of `pages` blank A4 pages; the pages in `textOn` (1-based) carry a line of text. */
function mixedPdf(pages: number, textOn: number[]): Buffer {
  const bodies: string[] = ['<< /Type /Catalog /Pages 2 0 R >>', `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${String(4 + i * 2)} 0 R`).join(' ')}] /Count ${String(pages)} >>`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>']
  for (let p = 1; p <= pages; p += 1) {
    const obj = 4 + (p - 1) * 2
    bodies.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${String(obj + 1)} 0 R >>`)
    const content = textOn.includes(p) ? `BT /F1 12 Tf 56 790 Td (Halaman ${String(p)}: soalan ujian sintetik untuk semakan teks) Tj ET` : ''
    bodies.push(`<< /Length ${String(content.length)} >>\nstream\n${content}\nendstream`)
  }
  let out = '%PDF-1.4\n'
  const offsets: number[] = []
  bodies.forEach((b, i) => {
    offsets.push(out.length)
    out += `${String(i + 1)} 0 obj\n${b}\nendobj\n`
  })
  const xref = out.length
  out += `xref\n0 ${String(bodies.length + 1)}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${String(bodies.length + 1)} /Root 1 0 R >>\nstartxref\n${String(xref)}\n%%EOF\n`
  return Buffer.from(out, 'latin1')
}

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/** A tiny ZIP (stored entries, no compression) with the given entry names; `salt` makes the bytes unique per test. */
function zip(names: string[], salt: string): Buffer {
  const local: Buffer[] = []
  const central: Buffer[] = []
  let offset = 0
  for (const name of names) {
    const n = Buffer.from(name, 'latin1')
    const data = Buffer.from(`<x>${salt}</x>`)
    const lh = Buffer.alloc(30)
    lh.writeUInt32LE(0x04034b50, 0)
    lh.writeUInt16LE(20, 4)
    lh.writeUInt32LE(data.length, 18)
    lh.writeUInt32LE(data.length, 22)
    lh.writeUInt16LE(n.length, 26)
    const ch = Buffer.alloc(46)
    ch.writeUInt32LE(0x02014b50, 0)
    ch.writeUInt16LE(20, 4)
    ch.writeUInt16LE(20, 6)
    ch.writeUInt32LE(data.length, 20)
    ch.writeUInt32LE(data.length, 24)
    ch.writeUInt16LE(n.length, 28)
    ch.writeUInt32LE(offset, 42)
    local.push(lh, n, data)
    central.push(ch, n)
    offset += lh.length + n.length + data.length
  }
  const cd = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(names.length, 8)
  end.writeUInt16LE(names.length, 10)
  end.writeUInt32LE(cd.length, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...local, cd, end])
}

const jobCount = async (t: QsTestApp): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*)::text n from jobs'))[0]?.n)

const count = async (t: QsTestApp): Promise<number> => Number((await t.db.query<{ n: string }>('select count(*)::text n from intake_batches'))[0]?.n)

describe('S1-T08: the teacher paper upload with the real intake', () => {
  let t: QsTestApp
  let teacher: Client
  let admin: Client
  let teacherId: string

  beforeAll(async () => {
    t = await bootQsApp({ realIntake: true })
    teacher = await client(t, TEACHER_A)
    admin = await client(t, ADMIN)
    teacherId = await idOfEmail(t, TEACHER_A)
  })
  afterAll(async () => {
    await t.close()
  })
  // Each test starts with a free quota: earlier tests' batches (office-only ones stay ready_for_review) are closed.
  beforeEach(async () => {
    await t.db.query(`update intake_batches set status = 'cancelled' where status in ('submitted', 'processing', 'ready_for_review')`)
  })

  it('a second provideIntake is a wiring error (the real port is bound at init)', () => {
    expect(() => t.get(QuestionSetsPorts).provideIntake({ submit: () => Promise.reject(new Error('x')) })).toThrow(/already set/)
  })

  it('201 with a QuestionSetPaper; the admin sees the guru batch; ?source accepts only guru', async () => {
    const res = await upload(teacher, FIELDS, [{ name: 'soalan.pdf', bytes: textPdf(1) }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const paper = QuestionSetPaperSchema.parse(res.body.data)
    expect(paper).toMatchObject({ teacherId, status: 'processing', subjectText: 'Matematik Tambahan', levelCode: 'T4', year: 2025, paperType: 'Trial Paper', authorCredit: 'Cikgu Ujian', adminNotes: null })
    expect(paper.files).toHaveLength(1)
    expect(paper.files[0]).toMatchObject({ index: 0, name: 'soalan.pdf', mime: 'application/pdf' })

    const row = (await t.db.query<Record<string, unknown>>(`select * from intake_batches where id = $1::bigint`, [paper.id]))[0]
    expect(row).toMatchObject({ source: 'guru', paper_type: 'trial', subject: 'Matematik Tambahan', kertas: null, year: 2025, rights_status: 'own', source_text: 'Cikgu Ujian', is_test: false })
    expect(String(row?.owner_user_id)).toBe(teacherId)

    const guru = await admin.get('/intake/batches?source=guru')
    expect(guru.status, JSON.stringify(guru.body)).toBe(200)
    const ids = (guru.body.data as { id: string }[]).map((b) => b.id)
    expect(ids).toContain(paper.id)
    const summary = (guru.body.data as unknown[]).find((b) => (b as { id: string }).id === paper.id)
    expect(IntakeBatchSummarySchema.parse(summary)).toMatchObject({ kertas: null, paperType: 'trial' })
    // Only `guru` is a valid filter value.
    expect((await admin.get('/intake/batches?source=admin')).status).toBe(422)
  })

  it('a blank author credit reads "Kiriman guru"', async () => {
    const res = await upload(teacher, { ...FIELDS, disediakanOleh: '', jenisSoalan: 'Lain-lain', tahun: '' }, [{ name: 'b.pdf', bytes: textPdf(2) }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const row = (await t.db.query<Record<string, unknown>>(`select source_text, paper_type, is_test from intake_batches where id = $1::bigint`, [res.body.data.id]))[0]
    expect(row).toMatchObject({ source_text: 'Kiriman guru', paper_type: 'lain', is_test: false })
  })

  it('DOCX is accepted by content: stored, listed with the docx mime, no extraction job, the admin can download it', async () => {
    const jobsBefore = await jobCount(t)
    const bytes = zip(['[Content_Types].xml', '_rels/.rels', 'word/document.xml'], 'docx-1')
    const res = await upload(teacher, FIELDS, [{ name: 'soalan.docx', bytes }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const paper = QuestionSetPaperSchema.parse(res.body.data)
    expect(paper.files).toEqual([{ index: 0, name: 'soalan.docx', size: bytes.length, mime: DOCX }])
    expect(paper.status).toBe('pending')
    expect(await jobCount(t)).toBe(jobsBefore)

    const batch = (await t.db.query<Record<string, unknown>>(`select status from intake_batches where id = $1::bigint`, [paper.id]))[0]
    expect(batch?.status).toBe('ready_for_review')
    const file = (await t.db.query<{ id: string; status: string; page_count: number | null; mime: string; pages: string }>(
      `select f.id::text id, f.status, f.page_count, s.mime, (select count(*)::text from intake_pages p where p.intake_file_id = f.id) pages
         from intake_files f join files s on s.id = f.file_id where f.batch_id = $1::bigint`,
      [paper.id],
    ))[0]
    expect(file).toMatchObject({ status: 'done', page_count: null, mime: DOCX, pages: '0' })

    const listed = await admin.get('/intake/batches?source=guru')
    expect((listed.body.data as { id: string }[]).map((b) => b.id)).toContain(paper.id)
    const dl = await admin.get(`/intake/files/${(file as { id: string }).id}/original`)
    expect(dl.status).toBe(200)
    expect(dl.headers['content-type']).toContain(DOCX)
    expect(Number(dl.headers['content-length'])).toBe(bytes.length)
    expect(String(dl.headers['content-disposition'])).toMatch(/^attachment/)
    expect(dl.headers['content-disposition']).toContain('soalan.docx')
  })

  it('XLSX is accepted; a mixed PDF + DOCX batch processes the PDF and only stores the DOCX', async () => {
    const x = await upload(teacher, FIELDS, [{ name: 'markah.xlsx', bytes: zip(['[Content_Types].xml', 'xl/workbook.xml'], 'xlsx-1') }])
    expect(x.status, JSON.stringify(x.body)).toBe(201)
    expect(x.body.data.files[0].mime).toBe(XLSX)

    const mixed = await upload(teacher, FIELDS, [
      { name: 'a.pdf', bytes: textPdf(7) },
      { name: 'a.docx', bytes: zip(['[Content_Types].xml', 'word/document.xml'], 'docx-mixed') },
    ])
    expect(mixed.status, JSON.stringify(mixed.body)).toBe(201)
    expect(mixed.body.data.files.map((f: { mime: string }) => f.mime)).toEqual(['application/pdf', DOCX])
    const rows = await t.db.query<{ status: string; page_count: number | null }>(`select status, page_count from intake_files where batch_id = $1::bigint order by id`, [mixed.body.data.id])
    expect(rows).toEqual([{ status: 'uploaded', page_count: 7 }, { status: 'done', page_count: null }])
    expect((await t.db.query<{ status: string }>(`select status from intake_batches where id = $1::bigint`, [mixed.body.data.id]))[0]?.status).toBe('processing')
  })

  it('legacy .doc/.xls (OLE), a ZIP that is neither, and a name-only DOCX are refused with no batch', async () => {
    const before = await count(t)
    const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(600)])
    const cases: [string, Buffer][] = [
      ['old.doc', ole],
      ['old.xls', ole],
      ['other.docx', zip(['[Content_Types].xml', 'readme.txt'], 'other')],
      ['plain.docx', Buffer.from('not a zip at all')],
    ]
    for (const [name, bytes] of cases) {
      const res = await upload(teacher, FIELDS, [{ name, bytes }])
      expect(res.status, name).toBe(422)
      expect(res.body.error.fields.files, name).toBe('Jenis fail tidak disokong. Format dibenarkan: PDF, DOCX, XLSX.')
    }
    expect(await count(t)).toBe(before)
  })

  it('the first-3-pages text check: text only on page 4 is refused, text on page 3 is accepted', async () => {
    const before = await count(t)
    const late = await upload(teacher, FIELDS, [{ name: 'p4.pdf', bytes: mixedPdf(5, [4]) }])
    expect(late.status).toBe(422)
    expect(late.body.error.fields.files).toBe('PDF imbasan imej tidak diterima — teks mesti boleh disalin.')
    expect(await count(t)).toBe(before)
    const ok = await upload(teacher, FIELDS, [{ name: 'p3.pdf', bytes: mixedPdf(5, [3]) }])
    expect(ok.status, JSON.stringify(ok.body)).toBe(201)
  })

  it('an empty file is refused with no batch', async () => {
    const before = await count(t)
    const res = await upload(teacher, FIELDS, [{ name: 'kosong.pdf', bytes: Buffer.alloc(0) }])
    expect(res.status).toBe(422)
    expect(await count(t)).toBe(before)
  })

  it('teacher B cannot see or download teacher A\'s batch and file; files.read never serves an intake original', async () => {
    const bytes = zip(['[Content_Types].xml', 'word/document.xml'], 'isolation')
    const res = await upload(teacher, FIELDS, [{ name: 'rahsia.docx', bytes }])
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const batchId = res.body.data.id as string
    const row = (await t.db.query<{ id: string; public_id: string }>(
      `select f.id::text id, s.public_id from intake_files f join files s on s.id = f.file_id where f.batch_id = $1::bigint`,
      [batchId],
    ))[0] as { id: string; public_id: string }

    const other = await client(t, TEACHER_C)
    expect((await other.get(`/intake/batches/${batchId}`)).status).toBe(404)
    expect((await other.get(`/intake/files/${row.id}/original`)).status).toBe(404)
    const list = await other.get('/intake/batches?source=guru')
    expect((list.body.data as { id: string }[]).map((b) => b.id)).not.toContain(batchId)

    // The generic file route refuses purpose intake_original for every caller.
    const pupil = await client(t, STUDENT_1)
    for (const who of [teacher, other, pupil, admin]) {
      const read = await who.get(`/files/${row.public_id}`)
      expect(read.status, JSON.stringify(read.body)).toBe(404)
    }
    expect((await t.http().get(`/api/files/${row.public_id}`)).status).toBeGreaterThanOrEqual(401)

    // The intake route serves it to the owner and the admin as an attachment, never inline.
    for (const who of [teacher, admin]) {
      const dl = await who.get(`/intake/files/${row.id}/original`)
      expect(dl.status).toBe(200)
      expect(String(dl.headers['content-disposition'])).toMatch(/^attachment/)
      expect(dl.headers['x-content-type-options']).toBe('nosniff')
    }
  })

  it('a scanned PDF (no text on the first 3 pages) is refused before any batch exists', async () => {
    const before = await count(t)
    const res = await upload(teacher, FIELDS, [{ name: 'imbasan.pdf', bytes: scanPdf(2) }])
    expect(res.status).toBe(422)
    expect(res.body.error.fields.files).toBe('PDF imbasan imej tidak diterima — teks mesti boleh disalin.')
    expect(await count(t)).toBe(before)
  })

  it('a failed upload (duplicate file) leaves no batch behind and rethrows the original error', async () => {
    const pdf = textPdf(3)
    expect((await upload(teacher, FIELDS, [{ name: 'c.pdf', bytes: pdf }])).status).toBe(201)
    const before = await count(t)
    const res = await upload(teacher, FIELDS, [{ name: 'c2.pdf', bytes: pdf }])
    expect(res.status).toBe(422)
    expect(res.body.error.fields.files).toBe('Fail ini telah diimport dalam kelompok lain.')
    expect(await count(t)).toBe(before)
  })

  it('more than 5 active batches is 409 with the ERR-QUOTA-04 text', async () => {
    const open = Number((await t.db.query<{ n: string }>(`select count(*)::text n from intake_batches where owner_user_id = $1::bigint and source = 'guru' and status in ('submitted','processing','ready_for_review')`, [teacherId]))[0]?.n)
    for (let i = open; i < 5; i += 1) {
      const res = await upload(teacher, FIELDS, [{ name: `q${String(i)}.pdf`, bytes: textPdf(4 + i) }])
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    }
    const sixth = await upload(teacher, FIELDS, [{ name: 'q6.pdf', bytes: textPdf(12) }])
    expect(sixth.status).toBe(409)
    expect(sixth.body.error.message).toBe('Terlalu banyak kumpulan sedang diproses (maksimum 5). Tunggu salah satu selesai.')
  })
})

describe('S1-T08: the guru paper path follows INTAKE_TEACHER_ENABLED', () => {
  it('flag off: 403 before anything is stored', async () => {
    const t = await bootQsApp({ realIntake: true, env: { INTAKE_TEACHER_ENABLED: undefined } })
    try {
      const teacher = await client(t, TEACHER_A)
      const res = await upload(teacher, FIELDS, [{ name: 'soalan.pdf', bytes: textPdf(1) }])
      expect(res.status).toBe(403)
      expect(await count(t)).toBe(0)
      // Defence in depth: the adapter itself refuses a teacher while the flag is off, even when the route gate is bypassed.
      const adapter = t.get(GuruPaperIntakeAdapter)
      const auth = { userId: '1', active: { role: 'teacher', scope: { level: 'school' } }, mode: null } as never
      await expect(adapter.submit({ auth, declaration: { paperType: 'Trial Paper', subjectText: 'x', levelCode: null, year: 2025, authorCredit: '', note: null }, files: [], teacherId: '1', role: 'teacher', isTest: false, at: new Date(), ip: null, requestId: null })).rejects.toMatchObject({ status: 403 })
      expect(await count(t)).toBe(0)
    } finally {
      await t.close()
    }
  })
})

describe('S1-T08: the quota counts office-only batches that the admin has not handled', () => {
  it('5 DOCX batches, then the 6th is 409 ERR-QUOTA-04', async () => {
    const t = await bootQsApp({ realIntake: true })
    try {
      const teacher = await client(t, TEACHER_A)
      for (let i = 0; i < 5; i += 1) {
        const res = await upload(teacher, FIELDS, [{ name: `d${String(i)}.docx`, bytes: zip(['[Content_Types].xml', 'word/document.xml'], `quota-${String(i)}`) }])
        expect(res.status, JSON.stringify(res.body)).toBe(201)
      }
      const sixth = await upload(teacher, FIELDS, [{ name: 'd6.docx', bytes: zip(['[Content_Types].xml', 'word/document.xml'], 'quota-6') }])
      expect(sixth.status).toBe(409)
      expect(sixth.body.error.message).toBe('Terlalu banyak kumpulan sedang diproses (maksimum 5). Tunggu salah satu selesai.')
    } finally {
      await t.close()
    }
  })
})

describe('S1-T08: the file size limit is checked before the content', () => {
  it('a file over INTAKE_MAX_FILE_MB is refused with the size text and no batch', async () => {
    const t = await bootQsApp({ realIntake: true, env: { INTAKE_MAX_FILE_MB: '1' } })
    try {
      const teacher = await client(t, TEACHER_A)
      const res = await upload(teacher, FIELDS, [{ name: 'besar.pdf', bytes: Buffer.concat([textPdf(1), Buffer.alloc(1024 * 1024 + 10, 0x20)]) }])
      expect(res.status).toBe(422)
      expect(res.body.error.fields.files).toBe('Fail melebihi had 1 MB.')
      expect(await count(t)).toBe(0)
    } finally {
      await t.close()
    }
  })
})
