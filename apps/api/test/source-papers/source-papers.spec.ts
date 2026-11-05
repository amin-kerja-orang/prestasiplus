import { SourcePaperDetailEnvelopeSchema, SourcePaperListResponseSchema, type SourcePaperDetail, type SourcePaperListResponse } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { excerptOf } from '../../src/modules/intake/files/source-papers.service'
import { bootIntakeApp, expectError, loginAs, type IntakeTestApp, type LoggedIn } from '../intake-files/helpers'

/**
 * S2-T09 Sumber Kertas, API-Q-23 (PRD30 R1-ADM-Q-19): FR-ADM-Q19.1 (read-only registry, same filters and columns), FR-ADM-Q19.2 (detail lists
 * the questions), AC-ADM-Q19.1 (a batch of Tahun 2025 whose Negeri / badan is the Johor code is listed and found by the Negeri filter).
 *
 * Fixtures (admin batches unless noted):
 *  B1 MAT 2025 K1 trial, paper Johor, 2 accepted questions, every leaf keyed          -> OK
 *  B2 MAT 2024 K2 exam, paper Selangor, 1 accepted question, an MCQ leaf with no key  -> Skema
 *  B3 BM  2023 K1 trial, no paper, 1 accepted + 1 open (generated) item               -> Perlu Semakan, Negeri null
 *  B4 BM  2022 K2 exam, status failed (reason + a failed file)                        -> Perlu Semakan
 *  G1 guru batch with a year; A1 admin batch without a year; T1 admin test batch      -> never listed
 */
let t: IntakeTestApp
let admin: LoggedIn
let guru: LoggedIn
let student: LoggedIn
const ids: Record<string, string> = {}

const one = async (sql: string, params: unknown[] = []): Promise<string> => (await t.db.query<{ id: string }>(sql, params))[0]!.id

async function batch(over: { source?: string; subject: string; kertas: number | null; year: number | null; paper: string; sp?: string | null; status?: string; reason?: string; test?: boolean }): Promise<string> {
  return one(
    `insert into intake_batches (source, status, status_reason, paper_type, subject, kertas, year, source_text, rights_status, source_paper_id, is_test)
     values ($1, $2, $3, $4, $5, $6, $7, 'Sumber sintetik', 'own', $8::bigint, $9) returning id::text id`,
    [over.source ?? 'admin', over.status ?? 'ready_for_review', over.reason ?? null, over.paper, over.subject, over.kertas, over.year, over.sp ?? null, over.test ?? false],
  )
}

/** An accepted item with a Draf question of one MCQ leaf; `keyed` decides whether the leaf has an answer_keys row. */
async function acceptedItem(batchId: string, position: number, label: string, stem: string, keyed: boolean): Promise<string> {
  const q = await one(`insert into questions (latest_version_no, is_active) values (1, true) returning id::text id`)
  const v = await one(
    `insert into question_versions (question_id, version_no, status, type, stem_ms, number_label) values ($1::bigint, 1, 'draft', 'mcq', $2, $3) returning id::text id`,
    [q, stem, label],
  )
  const part = await one(
    `insert into question_parts (question_version_id, position, depth, label, prompt_ms, marks, mode) values ($1::bigint, 1, 1, '1', 'Pilih jawapan.', 1, 'mcq') returning id::text id`,
    [v],
  )
  if (keyed) await t.db.query(`insert into answer_keys (part_id, kind, content) values ($1::bigint, 'option', '{"kind":"option","correct":"A"}'::jsonb)`, [part])
  await t.db.query(
    `insert into intake_items (batch_id, position, item_type, number_label, payload, review_state, question_id, question_version_no)
     values ($1::bigint, $2, 'mcq', $3, '{}'::jsonb, 'accepted', $4::bigint, 1)`,
    [batchId, position, label, q],
  )
  return q
}

let fileNo = 0
async function intakeFile(batchId: string, name: string, status: string, errorCode: string | null = null): Promise<void> {
  fileNo += 1
  const file = await one(
    `insert into files (public_id, purpose, mime, size_bytes, sha256, storage_key) values ($1, 'intake_original', 'application/pdf', 10, $2, $3) returning id::text id`,
    [`spfile${String(fileNo).padStart(2, "0")}`.padEnd(22, "x"), String(fileNo).padStart(64, "0"), `key/source-papers/${fileNo}`],
  )
  await t.db.query(`insert into intake_files (batch_id, file_id, original_name, sha256, size_bytes, status, error_code) values ($1::bigint, $2::bigint, $3, $4, 10, $5, $6)`, [batchId, file, name, String(fileNo).padStart(64, "0"), status, errorCode])
}

const openItem = (batchId: string, position: number, label: string, state: string) =>
  t.db.query(`insert into intake_items (batch_id, position, item_type, number_label, payload, review_state) values ($1::bigint, $2, 'mcq', $3, '{}'::jsonb, $4)`, [batchId, position, label, state])

beforeAll(async () => {
  t = await bootIntakeApp()
  await t.db.query(`insert into subjects (code, name, name_en, color) values ('MAT', 'Matematik', 'Mathematics', '#112233'), ('BM', 'Bahasa Melayu', 'Malay', '#445566')`)
  const johor = await one(`insert into source_papers (natural_key, exam_board, rights_status) values ('sp|johor', 'Johor', 'own') returning id::text id`)
  const selangor = await one(`insert into source_papers (natural_key, exam_board, rights_status) values ('sp|selangor', ' Selangor ', 'own') returning id::text id`)

  ids.b1 = await batch({ subject: 'MAT', kertas: 1, year: 2025, paper: 'trial', sp: johor })
  ids.q1 = await acceptedItem(ids.b1!, 1, '1', 'Berapakah hasil tambah dua dan tiga?', true)
  await acceptedItem(ids.b1!, 2, '2', 'Nyatakan nilai x. '.repeat(20), true)
  await intakeFile(ids.b1!, 'mat-2025-k1.pdf', 'done')
  ids.b2 = await batch({ subject: 'MAT', kertas: 2, year: 2024, paper: 'exam', sp: selangor })
  await acceptedItem(ids.b2!, 1, '1', 'Soalan tanpa kunci jawapan.', false)

  ids.b3 = await batch({ subject: 'BM', kertas: 1, year: 2023, paper: 'trial' })
  await acceptedItem(ids.b3!, 1, '1', 'Soalan bahasa.', true)
  await openItem(ids.b3!, 2, '2', 'generated')

  ids.b4 = await batch({ subject: 'BM', kertas: 2, year: 2022, paper: 'exam', status: 'failed', reason: 'Pemprosesan dihentikan.' })
  await intakeFile(ids.b4!, 'bm-2022-k2.pdf', 'failed', 'CORRUPT')

  ids.g1 = await batch({ source: 'guru', subject: 'Matematik', kertas: null, year: 2025, paper: 'umum' })
  ids.a1 = await batch({ subject: 'MAT', kertas: 1, year: null, paper: 'trial' })
  ids.t1 = await batch({ subject: 'MAT', kertas: 1, year: 2025, paper: 'trial', test: true })

  admin = await loginAs(t, 'admin@demo.test')
  guru = await loginAs(t, 'guru@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')
})
afterAll(async () => {
  await t?.close()
})

async function list(query = ''): Promise<SourcePaperListResponse> {
  const res = await admin.agent.get(`/api/admin/source-papers${query}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  expect(res.headers['cache-control']).toBe('no-store')
  return SourcePaperListResponseSchema.parse(res.body)
}
async function detail(id: string): Promise<SourcePaperDetail> {
  const res = await admin.agent.get(`/api/admin/source-papers/${id}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return SourcePaperDetailEnvelopeSchema.parse(res.body).data
}
const titles = (r: SourcePaperListResponse) => r.data.map((x) => x.id)

describe('GET /admin/source-papers', () => {
  it('lists admin batches with a Tahun only (no guru, no test batch, no batch without Tahun), newest year first, with the tile totals', async () => {
    const r = await list()
    expect(titles(r)).toEqual([ids.b1, ids.b2, ids.b3, ids.b4])
    expect(r.meta.totalItems).toBe(4)
    expect(r.meta.pageSize).toBe(25)
    expect(r.meta.totalPapers).toBe(4)
    expect(r.meta.needsReviewCount).toBe(2)
    expect(r.meta.options).toEqual({
      years: [2025, 2024, 2023, 2022],
      negeri: ['Johor', 'Selangor'],
      subjects: [
        { code: 'BM', name: 'Bahasa Melayu' },
        { code: 'MAT', name: 'Matematik' },
      ],
    })
    expect(r.data[0]).toMatchObject({ id: ids.b1, batchId: ids.b1, subject: 'MAT', subjectName: 'Matematik', year: 2025, kertas: 1, paperType: 'trial', questions: 2, source: 'intake', sourceLabel: 'Import (PDF/DOCX)', title: 'Matematik 2025 Kertas 1 - Johor' })
  })

  it('AC-ADM-Q19.1 (pending 0138, Negeri read through source_papers.exam_board): Tahun 2025 with the Johor code is listed with its values and question count, and the Negeri filter finds it (case-insensitive)', async () => {
    const r = await list('?negeri=johor&year=2025')
    expect(titles(r)).toEqual([ids.b1])
    expect(r.data[0]).toMatchObject({ negeri: 'Johor', year: 2025, questions: 2 })
    expect(titles(await list('?negeri=Selangor'))).toEqual([ids.b2]) // trimmed on read
    expect(titles(await list('?negeri=Perak'))).toEqual([])
  })

  it('Negeri is null when unknown (the screen shows "—")', async () => {
    const r = await list('?subject=BM&year=2023')
    expect(r.data[0]).toMatchObject({ id: ids.b3, negeri: null })
  })

  it('filters by subject code, year, kertas, jenis and q', async () => {
    expect(titles(await list('?subject=MAT'))).toEqual([ids.b1, ids.b2])
    expect(titles(await list('?year=2022'))).toEqual([ids.b4])
    expect(titles(await list('?kertas=2'))).toEqual([ids.b2, ids.b4])
    expect(titles(await list('?jenis=trial'))).toEqual([ids.b1, ids.b3])
    expect(titles(await list('?q=bahasa'))).toEqual([ids.b3, ids.b4])
    expect(titles(await list('?q=2024'))).toEqual([ids.b2])
    expect(titles(await list('?q=MAT-2025-K1'))).toEqual([ids.b1]) // the stored file name
    expect(titles(await list('?q=100%25'))).toEqual([])
    expect(await list('?kertas=2&jenis=exam&subject=MAT')).toMatchObject({ meta: { totalItems: 1 } })
  })

  it('totals ignore the filters; the Perlu Semakan checkbox keeps only open or failed papers', async () => {
    const r = await list('?needsReview=true')
    expect(titles(r)).toEqual([ids.b3, ids.b4])
    expect(r.meta.totalItems).toBe(2)
    expect(r.meta.totalPapers).toBe(4)
    expect(titles(await list('?needsReview=false'))).toHaveLength(4)
  })

  it('badges: an open item and a failed batch need review; a missing key is Skema; keyed is OK', async () => {
    const r = await list()
    const by = Object.fromEntries(r.data.map((x) => [x.id, x]))
    expect(by[ids.b1!]).toMatchObject({ needsReview: false, hasScheme: true })
    expect(by[ids.b2!]).toMatchObject({ needsReview: false, hasScheme: false })
    expect(by[ids.b3!]).toMatchObject({ needsReview: true, questions: 1 })
    expect(by[ids.b4!]).toMatchObject({ needsReview: true, questions: 0, hasScheme: false })
  })

  it('a keyed leaf turns Skema into OK (the question module rule)', async () => {
    await t.db.query(
      `insert into answer_keys (part_id, kind, content)
       select p.id, 'option', '{"kind":"option","correct":"A"}'::jsonb
         from question_parts p join question_versions v on v.id = p.question_version_id join intake_items i on i.question_id = v.question_id where i.batch_id = $1::bigint`,
      [ids.b2],
    )
    expect((await list('?year=2024')).data[0]).toMatchObject({ hasScheme: true, needsReview: false })
  })

  it('paginates 25 per page', async () => {
    const bulk = await batch({ subject: 'MAT', kertas: 1, year: 2021, paper: 'trial' })
    await t.db.query(
      `insert into intake_batches (source, paper_type, subject, kertas, year, source_text, rights_status) select 'admin', 'trial', 'MAT', 1, 2020, 'x', 'own' from generate_series(1, 25)`,
    )
    const p1 = await list()
    const p2 = await list('?page=2')
    expect(p1.data).toHaveLength(25)
    expect(p2.data).toHaveLength(5)
    expect(p1.meta).toMatchObject({ totalItems: 30, totalPages: 2, from: 1, to: 25 })
    expect(p2.meta).toMatchObject({ page: 2, from: 26, to: 30 })
    expect(p1.data.map((x) => x.id)).not.toContain(p2.data[0]!.id)
    await t.db.query(`delete from intake_batches where year in (2020, 2021)`)
    expect(bulk).toBeTruthy()
  })

  it('rejects a malformed filter with 422', async () => {
    expectError(await admin.agent.get('/api/admin/source-papers?kertas=9'), 'VALIDATION_ERROR')
    expectError(await admin.agent.get('/api/admin/source-papers?jenis=zzz'), 'VALIDATION_ERROR')
  })
})

describe('GET /admin/source-papers/:id', () => {
  it('returns the facts, the questions with their stem excerpt and part count, and no issues for a clean paper', async () => {
    const d = await detail(ids.b1!)
    expect(d).toMatchObject({ id: ids.b1, subject: 'MAT', year: 2025, kertas: 1, negeri: 'Johor', paperType: 'trial', hasScheme: true, needsReview: false, issues: [], fileNames: ['mat-2025-k1.pdf'] })
    expect(d.questionList).toHaveLength(2)
    expect(d.questionList[0]).toEqual({ no: '1', questionId: ids.q1, excerpt: 'Berapakah hasil tambah dua dan tiga?', parts: 1 })
    expect(d.questionList[1]!.excerpt.endsWith('...')).toBe(true)
    expect(d.questionList[1]!.excerpt.length).toBe(123)
  })

  it('lists the import issues: an open item, and a failed batch with its reason', async () => {
    const open = await detail(ids.b3!)
    expect(open.issues).toEqual([{ itemId: expect.any(String), where: 'Soalan 2', message: 'Belum selesai disemak (Dijana).' }])
    const failed = await detail(ids.b4!)
    expect(failed.issues).toEqual([
      { itemId: null, where: 'Kertas', message: 'Pemprosesan dihentikan.' },
      { itemId: null, where: 'bm-2022-k2.pdf', message: 'Fail gagal diproses (CORRUPT).' },
    ])
    expect(failed.questionList).toEqual([])
  })

  it('a guru batch, a batch without Tahun, a test batch, an unknown id and a malformed id are 404', async () => {
    for (const id of [ids.g1!, ids.a1!, ids.t1!, '999999999', 'abc']) expectError(await admin.agent.get(`/api/admin/source-papers/${id}`), 'NOT_FOUND')
  })
})

describe('access', () => {
  it('is Admin Pusat only: 401 without a session, 403 for guru and pupil, on both routes', async () => {
    for (const path of ['/api/admin/source-papers', `/api/admin/source-papers/${ids.b1}`]) {
      expectError(await t.agent().get(path), 'UNAUTHORIZED')
      expectError(await guru.agent.get(path), 'FORBIDDEN')
      expectError(await student.agent.get(path), 'FORBIDDEN')
    }
  })
  it('is read-only: a write is not routed', async () => {
    const res = await admin.agent.post('/api/admin/source-papers').set('X-CSRF-Token', admin.csrf).send({})
    expect([404, 405]).toContain(res.status)
  })
})

describe('excerptOf', () => {
  it('collapses whitespace, keeps a short stem and cuts a long one at 120 characters with "..."', () => {
    expect(excerptOf('  a \n b ')).toBe('a b')
    expect(excerptOf(null)).toBe('')
    expect(excerptOf('x'.repeat(121))).toBe(`${'x'.repeat(120)}...`)
    expect(excerptOf('x'.repeat(120))).toBe('x'.repeat(120))
  })
})
