import { QuestionPublicSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { BuilderRepository } from '../../src/modules/exam/builder/builder.repository'
import { QuestionBankBuilderSource } from '../../src/modules/exam/builder/question-bank.source'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { checkKeysGate } from '../../src/modules/questions/publish-gate'
import { gradeQuestion } from '../../src/modules/questions/grading'
import { adminActor, apiError, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

const rubric = { kind: 'rubric', marks: 30, criteria: [{ id: 'c1', name: 'Isi' }], bands: [{ name: 'Cemerlang', range: [25, 30] }] }
const topics = [
  { id: 'a', label: 'Kepentingan membaca' },
  { id: 'b', label: 'Cinta akan alam sekitar' },
  { id: 'c', label: 'Hormat kepada guru' },
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

/**
 * R1-T25: `essay_choice` is stored (migration 0101), read back with its topics and word range, approved and published, shown to a
 * pupil without the key, graded as needs-review, mapped as an essay by the builder, and a bad topics set is refused in BM.
 * V2 has 39 such parts, 31 on approved questions (cloud-student-mechanism 1.4).
 */
describe('essay_choice storage (migration 0101)', () => {
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

  const make = (parts: unknown[], over: Record<string, unknown> = {}) =>
    svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, questionText: 'Karangan pilihan tajuk untuk ujian storan.', parts: parts as never, ...over }), admin)

  it('the migration adds the mode, the topics column and the topics CHECK', async () => {
    const [col] = await t.db.query<{ data_type: string; is_nullable: string }>(
      `select data_type, is_nullable from information_schema.columns where table_name = 'question_parts' and column_name = 'topics'`,
    )
    expect(col).toEqual({ data_type: 'jsonb', is_nullable: 'YES' })
    const defs = await t.db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) def from pg_constraint where conname in ('ck_question_parts_mode', 'ck_question_parts_topics')`,
    )
    expect(defs.map((d) => d.def).join(' ')).toContain('essay_choice')
  })

  it('stores a question, reads it back with topics, word range and rubric key, approves and publishes it', async () => {
    const q = await make([leaf()], { tag: tagBody(tag, 4) })
    const [row] = await t.db.query<{ mode: string; topics: unknown; word_min: number; word_max: number }>(
      `select p.mode, p.topics, p.word_min, p.word_max from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1`,
      [q.id],
    )
    expect(row).toEqual({ mode: 'essay_choice', topics, word_min: 150, word_max: 200 })

    await svc.setStatus(q.id, 'review', admin.userId)
    // R1-B01 (0100): approved = servable, there is no separate publish step.
    const published = await svc.setStatus(q.id, 'approved', admin.userId)
    expect(published.version.status).toBe('approved')
    const stored = (await repo.get(q.id, 'live'))?.version.parts[0]
    expect(stored).toMatchObject({ mode: 'essay_choice', marks: 30, topics, wordRange: { min: 150, max: 200 }, key: { kind: 'rubric' } })

    // A pupil sees the topics and the word range, never the key (nor the scheme).
    const pub = await svc.getPublicForLearner(q.id)
    QuestionPublicSchema.parse(pub)
    const part = (pub as { parts: Record<string, unknown>[] }).parts[0] as Record<string, unknown>
    expect(part).toMatchObject({ mode: 'essay_choice', topics, wordRange: { min: 150, max: 200 } })
    expect(JSON.stringify(pub)).not.toContain('"criteria"')
    expect('key' in part).toBe(false)
  })

  it('a points key works too, and the builder reads the question as an essay with its word range', async () => {
    const points = { kind: 'points', marks: 10, points: [{ id: 'p1', code: 'K', label: 'Isi', marks: 10 }] }
    const q = await make([leaf({ key: points, marks: 10 })])
    const prisma = t.app.get(PrismaService)
    const source = new QuestionBankBuilderSource(prisma, repo, new BuilderRepository(prisma))
    const review = await source.review([q.id])
    const part = review.questions[0]?.parts?.[0]
    expect(part?.answer).toEqual({ kind: 'essay', wordRange: { min: 150, max: 200 } })
    expect(review.questions[0]?.marks).toBe(10)
  })

  it('is graded as needs_review, never right or wrong automatically', () => {
    const parts = [leaf()] as never
    const grade = gradeQuestion('1', parts, [{ value: { kind: 'text', text: 'Karangan saya' } }])
    expect(JSON.stringify(grade)).toContain('needs_review')
    expect(JSON.stringify(gradeQuestion('1', parts, []))).toContain('needs_review')
  })

  it('refuses a bad topics set with a BM message and stores nothing', async () => {
    const before = (await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n
    const cases: [string, unknown[], string][] = [
      ['one topic', topics.slice(0, 1), 'Sila masukkan 2 hingga 6 tajuk.'],
      ['seven topics', Array.from({ length: 7 }, (_, i) => ({ id: `t${String(i)}`, label: `Tajuk ${String(i)}` })), 'Sila masukkan 2 hingga 6 tajuk.'],
      ['duplicate ids', [topics[0], { ...topics[1], id: 'a' }], 'Setiap tajuk mesti mempunyai id yang berbeza.'],
    ]
    for (const [name, bad, message] of cases) {
      const err = await apiError(() => make([leaf({ topics: bad })]))
      expect(err.getStatus(), name).toBe(422)
      expect(Object.values(err.fields ?? {}), name).toContain(message)
    }
    expect((await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n).toBe(before)
  })

  it('the database itself refuses topics on a non-essay_choice part and an essay_choice part without topics', async () => {
    const q = await make([leaf()])
    const [part] = await t.db.query<{ id: string }>(
      `select p.id::text id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1`,
      [q.id],
    )
    await expect(t.db.query(`update question_parts set topics = null where id = $1`, [part?.id])).rejects.toThrow(/ck_question_parts_topics/)
    await expect(t.db.query(`update question_parts set topics = '[{"id":"a","label":"x"}]'::jsonb where id = $1`, [part?.id])).rejects.toThrow(/ck_question_parts_topics/)
    await expect(t.db.query(`update question_parts set mode = 'essay', marks = 30 where id = $1`, [part?.id])).rejects.toThrow(/ck_question_parts_topics/)
  })

  it('the publish gate re-checks topics and the key marks of a stored essay_choice leaf', () => {
    const bad = [leaf({ topics: [topics[0], { ...topics[1], id: 'a' }] }), leaf({ label: '(b)', marks: 20 })] as never
    const fields = checkKeysGate(bad)
    expect(fields['parts..topics'] ?? fields['parts.topics']).toBe('Esei pilihan mesti mempunyai 2 hingga 6 tajuk yang berbeza.')
    expect(Object.keys(fields).some((k) => k.endsWith('.key'))).toBe(true)
    expect(checkKeysGate([leaf()] as never)).toEqual({})
  })
})
