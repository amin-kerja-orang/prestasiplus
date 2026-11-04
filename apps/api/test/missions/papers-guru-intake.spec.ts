import { IntakeBatchSummarySchema, QuestionSetPaperSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionSetsPorts } from '../../src/modules/classes/question-sets'
import { scanPdf, textPdf } from '../intake-files/pdf-fixtures'
import { ADMIN, TEACHER_A, bootQsApp, client, idOfEmail, type Client, type QsTestApp } from './qs-helpers'

/** S1-T08 (API-GUR-17, FR-GUR-44-13): the teacher paper upload creates a `source = guru` intake batch through the real adapter. */
const FIELDS = { jenisSoalan: 'Trial Paper', subject: 'Matematik Tambahan', tingkatan: '4', tahun: '2025', disediakanOleh: 'Cikgu Ujian', catatan: 'Nota' }

function upload(c: Client, fields: Record<string, string>, files: { name: string; bytes: Buffer }[]) {
  let req = c.who.agent.post('/api/guru/question-papers').set('X-CSRF-Token', c.who.csrf)
  for (const [k, v] of Object.entries(fields)) req = req.field(k, v)
  for (const f of files) req = req.attach('files', f.bytes, f.name)
  return req
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

  it('a second provideIntake is a wiring error (the real port is bound at init)', () => {
    expect(() => t.get(QuestionSetsPorts).provideIntake({ submit: () => Promise.reject(new Error('x')) })).toThrow(/already set/)
  })

  it('201 with a QuestionSetPaper; the admin sees a guru batch, not an admin one', async () => {
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
    const adminOnly = await admin.get('/intake/batches?source=admin')
    expect((adminOnly.body.data as { id: string }[]).map((b) => b.id)).not.toContain(paper.id)
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
    const open = Number((await t.db.query<{ n: string }>(`select count(*)::text n from intake_batches where owner_user_id = $1::bigint and status in ('submitted','processing')`, [teacherId]))[0]?.n)
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
    } finally {
      await t.close()
    }
  })
})
