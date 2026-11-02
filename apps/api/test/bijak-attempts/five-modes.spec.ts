/**
 * R1-03.1 (T40): ONE attempt holding all five answer modes (mcq, short_text, numeric, extended essay, essay_choice):
 * autosave, a fresh read of the sitting, submit and the result, including the topic the pupil chose.
 * V2: docs/discovery/cloud-student-mechanism.md 1.4 (the five kinds of answer, autosave and resume), 1.6 (objective marked at submit,
 * essays wait for a person) and 1.7 (Semakan).
 */
import {
  BijakAttemptPaperViewSchema,
  BijakAttemptResultViewSchema,
  BijakAttemptSubmitResultSchema,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  BijakAttemptPorts,
  type BijakPaperSource,
  type BijakQuestionBundle,
  type BijakQuestionSource,
  type PaperResolution,
} from '../../src/modules/bijak/attempts/ports'
import type { QuestionDef, SchemeDef } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, loginAs, STUDENT } from './helpers'

const TAG: QuestionDef['curriculum'] = { subject: 'MAT', level: 'T4', unit: '1.0', unitLabel: 'Fungsi', sp: [], tp: 3, formOrigin: 'T4' }
const PAPER_ID = '301'

const Q: Record<string, { def: QuestionDef; schemes: Record<string, SchemeDef> }> = {
  m1: {
    def: {
      id: 'm1',
      curriculum: TAG,
      stem: 'Berapakah 2 + 3?',
      mcq: { options: [{ id: 'A', text: '4' }, { id: 'B', text: '5' }, { id: 'C', text: '6' }, { id: 'D', text: '7' }] },
    },
    schemes: { m1: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5.' } },
  },
  m2: {
    def: { id: 'm2', curriculum: TAG, stem: 'Nyatakan proses tumbuhan menghasilkan glukosa.', parts: [{ id: 'm2-a', label: '(a)', prompt: 'Proses itu ialah', marks: 2, answer: { kind: 'short_text' } }] },
    schemes: { 'm2-a': { kind: 'accepted', marks: 2, values: [{ v: 'fotosintesis' }] } },
  },
  m3: {
    def: { id: 'm3', curriculum: TAG, stem: 'Panjang sisi segi empat sama ialah 12 cm.', parts: [{ id: 'm3-a', label: '(a)', prompt: 'Nilai panjang', marks: 2, answer: { kind: 'numeric' } }] },
    schemes: { 'm3-a': { kind: 'accepted', marks: 2, values: [{ v: '12', tol: 0 }] } },
  },
  m4: {
    def: { id: 'm4', curriculum: TAG, stem: 'Huraikan kepentingan perpaduan.', parts: [{ id: 'm4-a', label: '(a)', prompt: 'Karangan', marks: 10, answer: { kind: 'essay', wordRange: { min: 50, max: 150 } } }] },
    schemes: {
      'm4-a': { kind: 'rubric', marks: 10, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Baik', range: [6, 8], descriptor: 'Isi tepat' }, { name: 'Cemerlang', range: [9, 10], descriptor: 'Isi mantap' }] },
    },
  },
  m5: {
    def: {
      id: 'm5',
      curriculum: TAG,
      stem: 'Pilih satu tajuk dan tulis karangan.',
      parts: [{ id: 'm5-a', label: '(a)', prompt: 'Pilih satu tajuk.', marks: 10, answer: { kind: 'essay_choice', wordRange: { min: 100, max: 200 }, topics: [{ id: 'T1', label: 'Tajuk satu' }, { id: 'T2', label: 'Tajuk dua' }] } }],
    },
    schemes: {
      'm5-a': { kind: 'rubric', marks: 10, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Baik', range: [6, 8], descriptor: 'Isi tepat' }] },
    },
  },
}
const IDS = ['m1', 'm2', 'm3', 'm4', 'm5']

const papers: BijakPaperSource = {
  async resolveForAttempt(input): Promise<PaperResolution> {
    if (input.paperId !== PAPER_ID) return { ok: false, reason: 'not_found' }
    return {
      ok: true,
      paper: {
        id: PAPER_ID,
        kind: 'pilihan',
        title: 'Lima jenis jawapan',
        subject: 'MAT',
        subjectName: 'Matematik',
        kertas: 1,
        code: '1449/1',
        durationMin: 90,
        sections: [{ id: 'fm-s1', label: 'Bahagian A', rule: { type: 'all' }, questionIds: IDS }],
      },
    }
  },
}
const questions: BijakQuestionSource = {
  async loadQuestions(ids) {
    const out = new Map<string, BijakQuestionBundle>()
    for (const id of ids) {
      const q = Q[id]
      if (q) out.set(id, { question: q.def, schemes: q.schemes })
    }
    return out
  },
}

let t: AttemptsTestApp
let me: Client

beforeAll(async () => {
  t = await bootAttemptsApp({}, { plugPorts: false })
  const ports = t.app.get(BijakAttemptPorts)
  ports.providePaperSource(papers)
  ports.provideQuestionSource(questions)
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

describe('R1-03.1: one attempt with mcq, short_text, numeric, extended essay and essay_choice', () => {
  it('autosave, a fresh read restores all five answers (and the topic), submit marks the objective ones, the essays wait', async () => {
    const started = await me.post('/api/bijak/attempts', { paperId: PAPER_ID, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBe(201)
    const id = (started.body as { data: { attemptId: string } }).data.attemptId

    // the served paper carries the five parts, the essay_choice topics, and no key
    const served = BijakAttemptPaperViewSchema.parse((await me.get(`/api/bijak/attempts/${id}`)).body.data)
    expect(served.questions.map((q) => q.id)).toEqual(IDS)
    const choicePart = served.questions.find((q) => q.id === 'm5')!.parts?.[0]
    expect(choicePart?.answer).toMatchObject({ kind: 'essay_choice', topics: [{ id: 'T1', label: 'Tajuk satu' }, { id: 'T2', label: 'Tajuk dua' }] })
    expect(JSON.stringify(served)).not.toContain('fotosintesis')

    // autosave all five
    const answers = {
      m1: { choice: 'B' },
      'm2-a': { text: 'Fotosintesis' },
      'm3-a': { final: '12' },
      'm4-a': { text: 'Perpaduan menjamin keamanan dan kemakmuran negara.' },
      'm5-a': { choice: 'T2', text: 'Tajuk dua: kerjasama membina negara.' },
    }
    const saved = await me.put(`/api/bijak/attempts/${id}/answers`, { changes: Object.entries(answers).map(([partId, a]) => change(partId, a)) })
    expect(saved.status, JSON.stringify(saved.body)).toBe(200)

    // a FRESH read (reload / another device) restores every answer, the chosen topic included
    const reload = BijakAttemptPaperViewSchema.parse((await (await loginAs(t, STUDENT)).get(`/api/bijak/attempts/${id}`)).body.data)
    for (const [partId, a] of Object.entries(answers)) expect(reload.attempt.answers[partId], partId).toMatchObject({ answer: a })

    // submit (nothing new in the payload) and read the result
    const sub = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'five', changes: [] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    expect(BijakAttemptSubmitResultSchema.parse(sub.body.data)).toMatchObject({ attemptId: id })
    const { result } = BijakAttemptResultViewSchema.parse((await me.get(`/api/bijak/attempts/${id}/result`)).body.data)
    const part = (pid: string) => result.questions.flatMap((q) => q.parts).find((p) => p.partId === pid)!
    // objective modes are marked on the server
    expect(part('m1')).toMatchObject({ awarded: 1, status: 'betul' })
    expect(part('m2-a')).toMatchObject({ awarded: 2, status: 'betul' })
    expect(part('m3-a')).toMatchObject({ awarded: 2, status: 'betul' })
    // both essay modes wait for a person (never right or wrong automatically) and are self-markable
    expect(part('m4-a')).toMatchObject({ awarded: 0, status: 'belum_dimarkah', selfMarkable: true })
    expect(part('m5-a')).toMatchObject({ awarded: 0, status: 'belum_dimarkah', selfMarkable: true })
    // the result keeps what the pupil wrote, the chosen topic included
    expect(part('m5-a').answer).toEqual({ choice: 'T2', text: 'Tajuk dua: kerjasama membina negara.' })
    expect(result).toMatchObject({ score: 5, max: 25, provisional: true })
    expect(result.pendingReview).toBe(2)
    // Semakan: the essay_choice part is marked by the pupil like any rubric part
    const mark = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: 'm5-a', mark: 7, band: 'Baik' })
    expect(mark.status, JSON.stringify(mark.body)).toBe(200)
    expect(mark.body.data).toMatchObject({ awarded: 7, band: 'Baik', attemptScore: 12 })
  })
})
