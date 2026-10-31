import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { adminActor, apiError, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/** REQ-B-021 (B2 minors on T25 and H-A7): essay_choice write rules. */
const rubric = { kind: 'rubric', marks: 30, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Cemerlang', range: [25, 30] }] }
const topics = [
  { id: 'a', label: 'Kepentingan membaca' },
  { id: 'b', label: 'Cinta akan alam sekitar' },
]
const leaf = (over: Record<string, unknown> = {}) => ({
  label: '',
  prompt: { ms: 'Pilih satu tajuk dan tulis karangan.' },
  mode: 'essay_choice',
  marks: 30,
  key: rubric,
  topics,
  wordRange: { min: 150, max: 200 },
  ...over,
})

describe('essay_choice write rules (REQ-B-021)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const make = (parts: unknown[]) =>
    svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, questionText: 'Karangan pilihan tajuk untuk ujian REQ-B-021.', parts: parts as never }), admin)

  it('(a) a topic whose label is only spaces is refused with 422 and nothing is stored; a padded label is stored trimmed', async () => {
    const before = (await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n
    for (const label of ['', '   ', '\t\n ']) {
      const err = await apiError(() => make([leaf({ topics: [topics[0], { id: 'b', label }] })]))
      expect(err.getStatus(), JSON.stringify(label)).toBe(422)
      expect(Object.keys(err.fields ?? {}).some((k) => k.includes('topics')), JSON.stringify(label)).toBe(true)
    }
    expect((await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n).toBe(before)
    const ok = await make([leaf({ topics: [{ id: 'a', label: '  Kepentingan membaca  ' }, topics[1]] })])
    const part = (await repo.get(ok.id, 'latest'))?.version.parts[0] as { topics?: { label: string }[] }
    expect(part.topics?.[0]?.label).toBe('Kepentingan membaca')
  })
})
