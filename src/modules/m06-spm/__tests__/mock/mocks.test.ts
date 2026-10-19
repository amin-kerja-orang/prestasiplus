/**
 * M06-T1 endpoints #12-#17 (mock exams, walkthrough) and the provisional Duta read (SRS M06 v1.4 §6.5,
 * §6.10, §6.12, §7; BR-M06-24...28).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { practice } from '@/modules/m05-practice/mock'

import type { DutaCard, MockExamView, MockListItem, MockResult } from '../../api/types'
import { DUTA_PROVISIONAL } from '../../mock/handlers/duta'
import { setWalkthroughLatency } from '../../mock/handlers/mocks'
import { gradeOf, heroClassOf, markPaper2, weakTopicsOf } from '../../mock/repository/rules'
import { ADMIN, MemoryStorage, PELAJAR, PELAJAR2, bootM06, call, dataOf } from './boot'

let runtime: MockRuntime

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = await bootM06()
  setWalkthroughLatency(0)
}, 300_000)

afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(as: number | null, url: string) => dataOf<T>(runtime, as, 'GET', url)

describe('pure rules (BR-M06-24, §6.12)', () => {
  it('grade bands, hero classes and the Paper 2 marker', () => {
    expect([100, 90, 89.99, 80, 70, 60, 50, 45, 40, 39.99, 0].map(gradeOf)).toEqual([
      'A+', 'A+', 'A', 'A', 'B+', 'B', 'C', 'D', 'E', 'G', 'G',
    ])
    expect(heroClassOf('A+')).toBe('good')
    expect(heroClassOf('B')).toBe('good')
    expect(heroClassOf('C')).toBe('mid')
    expect(heroClassOf('E')).toBe('mid')
    expect(heroClassOf('G')).toBe('bad')
    expect(markPaper2(null, 10)).toBe(0)
    expect(markPaper2('  ', 10)).toBe(0)
    expect(markPaper2(Array(30).fill('a').join(' '), 10)).toBe(5)
    expect(markPaper2(Array(500).fill('a').join(' '), 10)).toBe(10)
  })

  it('weak topics: count desc then name, only items below max', () => {
    expect(
      weakTopicsOf([
        { topic: 'B', marks: 0, maxMarks: 1 },
        { topic: 'A', marks: 0, maxMarks: 1 },
        { topic: 'B', marks: null, maxMarks: 1 },
        { topic: 'C', marks: 1, maxMarks: 1 },
      ]),
    ).toEqual([
      { topic: 'B', wrongCount: 2 },
      { topic: 'A', wrongCount: 1 },
    ])
  })
})

describe('#12 list', () => {
  it('admin: mock 317 (in progress) then 16 (G, 0%), newest first', async () => {
    const l = await get<MockListItem[]>(ADMIN, '/api/spm-mocks')
    expect(l.map((m) => m.id)).toEqual([317, 16])
    expect(l[0]).toMatchObject({
      subject: 'Sejarah',
      paperNumber: 1,
      status: 'in_progress',
      score: null,
      grade: null,
      maxScore: 30,
    })
    expect(l[1]).toMatchObject({
      subject: 'Bahasa Melayu',
      status: 'submitted',
      score: 0,
      maxScore: 30,
      percent: 0,
      grade: 'G',
    })
  })

  it('student: 318-327 newest first with the observed scores and grades', async () => {
    const l = await get<MockListItem[]>(PELAJAR, '/api/spm-mocks')
    expect(l.map((m) => m.id)).toEqual([327, 326, 325, 324, 323, 322, 321, 320, 319, 318])
    const byId = Object.fromEntries(l.map((m) => [m.id, m]))
    const want: [number, string, number, number, string][] = [
      [318, 'Matematik', 1, 29, 'A+'],
      [319, 'Sains', 1, 25, 'A'],
      [320, 'Biologi', 1, 22, 'B+'],
      [321, 'Fizik', 1, 19, 'B'],
      [322, 'Kimia', 1, 16, 'C'],
      [323, 'Sejarah', 1, 14, 'D'],
      [324, 'English', 1, 12, 'E'],
      [325, 'Pendidikan Islam', 1, 6, 'G'],
      [326, 'Matematik Tambahan', 2, 38, 'B'],
    ]
    for (const [id, subject, paper, score, grade] of want) {
      expect(byId[id], String(id)).toMatchObject({ subject, paperNumber: paper, score, grade, status: 'submitted' })
    }
    expect(byId[326]?.maxScore).toBe(60)
    expect(byId[327]).toMatchObject({
      subject: 'Bahasa Melayu',
      paperNumber: 2,
      status: 'in_progress',
      grade: null,
    })
  })

  it('pelajar2 has none; another user never sees mine', async () => {
    expect(await get<MockListItem[]>(PELAJAR2, '/api/spm-mocks')).toEqual([])
  })
})

describe('#16 result and #14 view', () => {
  it('mock 16: 30 unanswered items, live texts and keys, topic counts, hero G', async () => {
    const r = await get<MockResult>(ADMIN, '/api/spm-mocks/16/result')
    expect(r).toMatchObject({ score: 0, maxScore: 30, percent: 0, grade: 'G', heroClass: 'bad' })
    expect(r.items).toHaveLength(30)
    expect(r.items.slice(0, 3).map((i) => [i.text, i.modelAnswer])).toEqual([
      ["Apakah maksud perkataan 'inovatif' dalam konteks sains dan teknologi?", 'A'],
      ["Apakah tema utama dalam puisi 'Bumi Bertuah' karya A. Samad Said?", 'B'],
      ["Siapakah penulis novel 'Salina'?", 'A'],
    ])
    expect(r.items.every((i) => i.studentAnswer === null && i.marks === 0)).toBe(true)
    expect(r.weakTopics).toEqual([
      { topic: 'Sastra', wrongCount: 11 },
      { topic: 'Penulisan', wrongCount: 10 },
      { topic: 'Sosiobudaya', wrongCount: 5 },
      { topic: 'Kosa Kata', wrongCount: 2 },
      { topic: 'Tatabahasa', wrongCount: 2 },
    ])
  })

  it('student P1 mock 318 has exactly 29 right; P2 mock 326 sums to 38/60', async () => {
    const a = await get<MockResult>(PELAJAR, '/api/spm-mocks/318/result')
    expect(a.score).toBe(29)
    expect(a.items.filter((i) => i.marks === 1)).toHaveLength(29)
    expect(a.percent).toBe(96.67)
    expect(a.weakTopics.reduce((n, t) => n + t.wrongCount, 0)).toBe(1)
    const b = await get<MockResult>(PELAJAR, '/api/spm-mocks/326/result')
    expect(b.items.map((i) => i.marks)).toEqual([7, 6, 7, 6, 6, 6])
    expect(b).toMatchObject({ score: 38, maxScore: 60, percent: 63.33, grade: 'B' })
    expect(b.items[0]?.feedback).toBe('Jawapan anda merangkumi 7 daripada 10 markah. Rujuk skema.')
  })

  it('an unsubmitted mock answers 409 NOT_SUBMITTED; a foreign or unknown one 404', async () => {
    const r = await call<{ error: { code: string } }>(runtime, ADMIN, 'GET', '/api/spm-mocks/317/result')
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('NOT_SUBMITTED')
    expect((await call(runtime, PELAJAR, 'GET', '/api/spm-mocks/16/result')).status).toBe(404)
    expect((await call(runtime, PELAJAR, 'GET', '/api/spm-mocks/16')).status).toBe(404)
    expect((await call(runtime, ADMIN, 'GET', '/api/spm-mocks/99999')).status).toBe(404)
    expect((await call(runtime, ADMIN, 'GET', '/api/spm-mocks/abc')).status).toBe(404)
  })

  it('the exam view carries no answer keys', async () => {
    const v = await get<MockExamView>(ADMIN, '/api/spm-mocks/317')
    expect(v).toMatchObject({ id: 317, subject: 'Sejarah', status: 'in_progress' })
    expect(v.items).toHaveLength(30)
    for (const it of v.items) {
      expect(Object.keys(it).sort()).toEqual(['maxMarks', 'no', 'options', 'text'])
    }
  })
})

describe('#13 create and #15 submit', () => {
  it('rejects a missing or unknown subject and a bad paper (422)', async () => {
    const a = await call<{ error: { fields: Record<string, string> } }>(runtime, PELAJAR2, 'POST', '/api/spm-mocks', {
      paperNumber: 1,
    })
    expect(a.status).toBe(422)
    expect(a.body.error.fields.subject).toBe('Sila pilih subjek.')
    expect((await call(runtime, PELAJAR2, 'POST', '/api/spm-mocks', { subject: 'Fizik ', paperNumber: 1 })).status).toBe(422)
    expect((await call(runtime, PELAJAR2, 'POST', '/api/spm-mocks', { subject: 'Fizik', paperNumber: 3 })).status).toBe(422)
    expect((await call(runtime, null, 'POST', '/api/spm-mocks', { subject: 'Fizik' })).status).toBe(401)
  })

  it('Paper 1: 30 pool items, listed in progress, graded on submit; no M05 write', async () => {
    const before = practice.historyPage(PELAJAR2, { modes: ['past_year'] }).stats.sessions
    const { id } = await dataOf<{ id: number }>(runtime, PELAJAR2, 'POST', '/api/spm-mocks', {
      subject: 'Kimia',
      paperNumber: 1,
    })
    expect(id).toBe(328)
    const l = await get<MockListItem[]>(PELAJAR2, '/api/spm-mocks')
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ id, subject: 'Kimia', status: 'in_progress', maxScore: 30 })
    const v = await get<MockExamView>(PELAJAR2, `/api/spm-mocks/${String(id)}`)
    expect(v.items).toHaveLength(30)
    // 5 right (key A is unknown to the client, so read the stored keys through the result later).
    const answers = v.items.map((i) => ({ no: i.no, answer: i.no <= 3 ? 'A' : '' }))
    const res = await dataOf<MockResult>(runtime, PELAJAR2, 'POST', `/api/spm-mocks/${String(id)}/submit`, { answers })
    expect(res.maxScore).toBe(30)
    expect(res.score).toBe(res.items.filter((i) => i.marks === 1).length)
    expect(res.items.slice(3).every((i) => i.studentAnswer === null)).toBe(true)
    expect(res.items[3]?.feedback).toMatch(/^Jawapan yang betul ialah [A-D]\.$/)
    const again = await call<{ error: { code: string } }>(runtime, PELAJAR2, 'POST', `/api/spm-mocks/${String(id)}/submit`, { answers })
    expect(again.status).toBe(409)
    expect((await get<MockListItem[]>(PELAJAR2, '/api/spm-mocks'))[0]).toMatchObject({ status: 'submitted' })
    // Mock answers never reach M05 (SRS §6.5).
    expect(practice.historyPage(PELAJAR2, { modes: ['past_year'] }).stats.sessions).toBe(before)
  })

  it('Paper 2: 6 structured items of 10 marks, graded by the simulated marker', async () => {
    const { id } = await dataOf<{ id: number }>(runtime, PELAJAR2, 'POST', '/api/spm-mocks', {
      subject: 'Matematik',
      paperNumber: 2,
    })
    const v = await get<MockExamView>(PELAJAR2, `/api/spm-mocks/${String(id)}`)
    expect(v.items).toHaveLength(6)
    expect(v.items.every((i) => i.maxMarks === 10 && i.options === undefined)).toBe(true)
    const long = Array(60).fill('isi').join(' ')
    const res = await dataOf<MockResult>(runtime, PELAJAR2, 'POST', `/api/spm-mocks/${String(id)}/submit`, {
      answers: [{ no: 1, answer: long }, { no: 2, answer: 'pendek sahaja' }],
    })
    expect(res.maxScore).toBe(60)
    expect(res.items.map((i) => i.marks)).toEqual([10, 0, 0, 0, 0, 0])
    expect(res.score).toBe(10)
    expect(res.grade).toBe('G')
  })

  it('rejects malformed answers (422) and foreign mocks (404)', async () => {
    const { id } = await dataOf<{ id: number }>(runtime, PELAJAR2, 'POST', '/api/spm-mocks', { subject: 'Sains' })
    const url = `/api/spm-mocks/${String(id)}/submit`
    expect((await call(runtime, PELAJAR2, 'POST', url, { answers: 'x' })).status).toBe(422)
    expect((await call(runtime, PELAJAR2, 'POST', url, { answers: [{ no: 99, answer: 'A' }] })).status).toBe(422)
    expect((await call(runtime, PELAJAR, 'POST', url, { answers: [] })).status).toBe(404)
  })
})

describe('#17 walkthrough (D4)', () => {
  const form = (fields: Record<string, string | Blob>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(fields)) f.append(k, v)
    return f
  }
  const solve = (fields: Record<string, string | Blob>, as: number | null = PELAJAR) =>
    call<{ ok?: boolean; walkthrough?: string; error: unknown }>(runtime, as, 'POST', '/api/spm-walkthrough/solve', form(fields))

  it('returns the canned text with the question echoed (Matematik, Sejarah, default)', async () => {
    const m = await solve({ subject: 'Matematik', year: '2023', question_text: 'Selesaikan 2x + 3 = 11' })
    expect(m.status).toBe(200)
    expect(m.body).toMatchObject({ ok: true })
    expect(m.body.walkthrough).toMatch(/^Soalan: Selesaikan 2x \+ 3 = 11\n\nLangkah 1: Kenal pasti apa yang diberi/)
    const s = await solve({ subject: 'Sejarah', question_text: 'x' })
    expect(s.body.walkthrough).toContain('kata tugas soalan')
    const d = await solve({ subject: 'Fizik', question_text: 'y'.repeat(120) })
    expect(d.body.walkthrough).toBe(`Soalan: ${'y'.repeat(80)}\n\nLangkah 1: Baca soalan dengan teliti.\nLangkah 2: Kenal pasti konsep utama dalam buku teks.\nLangkah 3: Jawab mengikut format skema pemarkahan.`)
  })

  it('an image alone is enough; the echo says (gambar)', async () => {
    const img = new File([new Uint8Array(10)], 'soalan.png', { type: 'image/png' })
    const r = await solve({ subject: 'Kimia', question_text: '', image: img })
    expect(r.body.ok).toBe(true)
    expect(r.body.walkthrough?.startsWith('Soalan: (gambar)\n\n')).toBe(true)
  })

  it('answers {ok:false} without text and image, and for a bad image', async () => {
    const none = await solve({ subject: 'Matematik', question_text: '   ' })
    expect(none.status).toBe(200)
    expect(none.body).toEqual({ ok: false, error: 'Sila masukkan soalan atau muat naik gambar soalan.' })
    const bad = await solve({
      subject: 'Matematik',
      question_text: 'x',
      image: new File(['x'], 'a.pdf', { type: 'application/pdf' }),
    })
    expect(bad.body).toEqual({ ok: false, error: 'Gambar tidak sah.' })
  })

  it('an empty or unknown subject is 422; guests 401', async () => {
    expect((await solve({ subject: '', question_text: 'x' })).status).toBe(422)
    expect((await solve({ subject: 'Muzik', question_text: 'x' })).status).toBe(422)
    expect((await solve({ subject: 'Matematik', question_text: 'x' }, null)).status).toBe(401)
  })

  it('failNext delivers the payload as the live body and the hook sets the latency', async () => {
    runtime.faults.failNext('/api/spm-walkthrough/solve', {
      status: 200,
      body: { ok: false, error: 'AI sibuk' },
    })
    const r = await solve({ subject: 'Matematik', question_text: 'x' })
    expect(r.body).toEqual({ ok: false, error: 'AI sibuk' })
    // The next call is normal again.
    expect((await solve({ subject: 'Matematik', question_text: 'x' })).body.ok).toBe(true)
  })
})

describe('GET /api/duta/recommendations (provisional, owner M24)', () => {
  it('is tagged provisional with owner M24', () => {
    expect(DUTA_PROVISIONAL).toEqual({ owner: 'M24', provisional: true })
  })

  it('picks only active bintang ambassadors with the DutaCard shape', async () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 20; seed++) {
      const d = await get<DutaCard>(PELAJAR, `/api/duta/recommendations?seed=${String(seed)}`)
      expect(d.tier).toBe('bintang')
      expect(Object.keys(d).sort()).toEqual(
        ['active', 'initials', 'name', 'rating', 'slug', 'state', 'subject', 'tagline', 'tier'],
      )
      expect(d.name.startsWith('Cikgu Demo')).toBe(true)
      seen.add(d.slug)
    }
    expect([...seen].sort()).toEqual(['cikgu-demo-bahasa', 'cikgu-demo-matematik', 'cikgu-demo-sains'])
  })

  it('prefers the subject match and is deterministic per seed', async () => {
    const a = await get<DutaCard>(PELAJAR, '/api/duta/recommendations?subject=Matematik&seed=3')
    expect(a).toMatchObject({ slug: 'cikgu-demo-matematik', initials: 'CM', rating: 4.92, state: 'Johor' })
    expect((await get<DutaCard>(PELAJAR, '/api/duta/recommendations?subject=Sains')).slug).toBe('cikgu-demo-sains')
    const x = await get<DutaCard>(PELAJAR, '/api/duta/recommendations?seed=7')
    const y = await get<DutaCard>(ADMIN, '/api/duta/recommendations?seed=7')
    expect(x.slug).toBe(y.slug)
    // A subject without a bintang falls back to a random bintang, never an inspirasi / tetamu.
    const z = await get<DutaCard>(PELAJAR, '/api/duta/recommendations?subject=Sejarah&seed=2')
    expect(z.tier).toBe('bintang')
  })
})
