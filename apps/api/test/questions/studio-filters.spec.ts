import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1-21.5 / D79: the four V2 Studio list filters (docs/qa/r1-admin-parity-check.md S3, docs/discovery/cloud-student-mechanism.md 3.1,
 * AC-02.7): Tahun, Negeri (aria "negeri atau badan peperiksaan"), Kertas (Kertas 1-3) and Jenis ("jenis peperiksaan"). Tahun, Negeri
 * and Jenis read the source paper of the question; Kertas is the trailing digit of the question's paper code.
 */
describe('admin question list: Tahun, Negeri, Kertas, Jenis', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  const ids: Record<string, string> = {}

  const paper = async (year: number | null, board: string | null, type: string | null): Promise<string> =>
    (await t.db.query<{ id: string }>(
      `insert into source_papers (year, exam_board, exam_type, rights_status) values ($1, $2, $3, 'own') returning id::text`,
      [year, board, type],
    ))[0]!.id
  const make = async (key: string, over: Record<string, unknown>, sourcePaperId: string | null): Promise<void> => {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: `Soalan penapis ${key} untuk ujian senarai.`, ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    ids[key] = id
    if (sourcePaperId !== null) await t.db.query(`update question_versions set source_paper_id = $1::bigint where question_id = $2`, [sourcePaperId, id])
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    const a = await paper(2024, 'Selangor', 'percubaan')
    const b = await paper(2023, 'Johor', 'sebenar')
    const c = await paper(2024, 'LPM', 'sebenar')
    await make('a', { kertas: '1' }, a)
    await make('b', { kertas: '2' }, b)
    await make('c', { kertas: '2' }, c)
    await make('d', {}, null) // no source paper, no kertas
  })
  afterAll(async () => {
    await t.close()
  })

  const listed = async (query: string): Promise<string[]> => {
    const res = await admin.get(`/api/questions?pageSize=100&${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const mine = new Set(Object.values(ids))
    return ((res.body as { data: { id: string }[] }).data ?? []).map((q) => q.id).filter((id) => mine.has(id)).sort()
  }
  const keys = (...k: string[]): string[] => k.map((x) => ids[x]!).sort()

  it('Tahun: the exam year of the source paper; a question without a source paper never matches', async () => {
    expect(await listed('tahun=2024')).toEqual(keys('a', 'c'))
    expect(await listed('tahun=2023')).toEqual(keys('b'))
    expect(await listed('tahun=1999')).toEqual([])
  })

  it('Negeri: state or examining body of the source paper, case-insensitive exact match', async () => {
    expect(await listed('negeri=Selangor')).toEqual(keys('a'))
    expect(await listed('negeri=johor')).toEqual(keys('b'))
    expect(await listed('negeri=LPM')).toEqual(keys('c'))
    expect(await listed('negeri=Sela')).toEqual([]) // exact, not a prefix
  })

  it('Kertas: 1, 2 or 3 (the trailing digit of the paper code)', async () => {
    expect(await listed('kertas=1')).toEqual(keys('a'))
    expect(await listed('kertas=2')).toEqual(keys('b', 'c'))
    expect(await listed('kertas=3')).toEqual([])
  })

  it('Jenis: the exam type of the source paper', async () => {
    expect(await listed('jenis=percubaan')).toEqual(keys('a'))
    expect(await listed('jenis=sebenar')).toEqual(keys('b', 'c'))
    expect(await listed('jenis=topikal')).toEqual([])
  })

  it('filters combine with AND and with the older filters; meta.counts follows the filter', async () => {
    expect(await listed('tahun=2024&jenis=sebenar')).toEqual(keys('c'))
    expect(await listed('tahun=2024&kertas=2&negeri=LPM&jenis=sebenar')).toEqual(keys('c'))
    expect(await listed('tahun=2024&kertas=1&jenis=sebenar')).toEqual([])
    expect(await listed(`tahun=2024&subjectId=${refs.mathId}`)).toEqual(keys('a', 'c'))
    const res = await admin.get('/api/questions?tahun=2024&pageSize=100')
    expect((res.body as { meta: { totalItems: number; counts: Record<string, number> } }).meta.totalItems).toBe(2)
    expect((res.body as { meta: { counts: Record<string, number> } }).meta.counts.draft).toBe(2)
  })

  it('a malformed value is 422 with the BM filter message, keyed by the filter name', async () => {
    for (const [query, field] of [['tahun=24', 'tahun'], ['tahun=abcd', 'tahun'], ['kertas=4', 'kertas'], ['kertas=0', 'kertas'], ['jenis=ujian', 'jenis']] as const) {
      const error = expectError(await admin.get(`/api/questions?${query}`), 'VALIDATION_ERROR')
      expect(error.fields?.[field], query).toBe('Nilai penapis tidak sah.')
    }
  })
})
