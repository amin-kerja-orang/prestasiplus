import { QuestionDetailSchema, QuestionRowSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { CurriculumRepository } from '../../src/modules/curriculum'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { flatFromVersion } from '../../src/modules/questions/projection'
import { QuestionBankAdapter } from '../../src/modules/questions/workflow/bank-adapter'
import { cannedExplanation } from '../../src/modules/questions/workflow/ai-explanation/canned-explanation'
import { adminActor, mcqInput, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, loginAs, parseData, parseList, type Client, type QuestionsTestApp } from './helpers'

const topics = [
  { id: 'a', label: 'Kepentingan membaca' },
  { id: 'b', label: 'Cinta akan alam sekitar' },
]
const points = { kind: 'points', marks: 30, points: [{ id: 'p1', code: 'P', label: 'Jawapan model', marks: 30, text: { ms: 'Contoh karangan model.' } }], modelText: 'Contoh karangan model.' }
const leaf = (mode: 'essay' | 'essay_choice') => ({
  label: '',
  prompt: { ms: 'Tulis karangan.' },
  mode,
  marks: 30,
  key: points,
  ...(mode === 'essay_choice' ? { topics, wordRange: { min: 150, max: 200 } } : {}),
})

/**
 * R1-H-A7: an `essay_choice` question in the flat admin shape (list row, detail, bank adapter). The flat `questionType` stays
 * `essay` (the m04 form has no other value); the topics ride on the additive optional `essayTopics`, present only for esei pilihan.
 */
describe('essay_choice in the flat admin views (H-A7)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let admin: Client
  let tag: Tag
  let actor: Awaited<ReturnType<typeof adminActor>>
  let choiceId: string
  let essayId: string

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    admin = await loginAs(t, 'admin')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    actor = await adminActor(t.db)
    const make = (mode: 'essay' | 'essay_choice', text: string) =>
      svc.create(mcqInput(tag, { questionType: 'essay', options: undefined, correctAnswer: undefined, questionText: text, parts: [leaf(mode)] as never }), actor)
    choiceId = (await make('essay_choice', 'Karangan pilihan tajuk untuk paparan rata.')).id
    essayId = (await make('essay', 'Karangan biasa untuk paparan rata.')).id
  })
  afterAll(async () => {
    await t.close()
  })

  it('flatFromVersion: esei pilihan reads as an essay with its model answer and topics; a plain essay has none', async () => {
    const choice = flatFromVersion((await repo.get(choiceId, 'latest'))!.version)
    expect(choice).toMatchObject({ questionType: 'essay', modelAnswer: 'Contoh karangan model.', essayTopics: topics, pointsValue: 30 })
    const essay = flatFromVersion((await repo.get(essayId, 'latest'))!.version)
    expect(essay.essayTopics).toBeNull()
    expect(essay.questionType).toBe('essay')
  })

  it('the admin list row and the detail carry essayTopics for esei pilihan only', async () => {
    const rows = parseList(await admin.get('/api/questions?search=paparan%20rata'), QuestionRowSchema)
    const choice = rows.find((r) => r.id === choiceId)
    const essay = rows.find((r) => r.id === essayId)
    expect(choice?.essayTopics).toEqual(topics)
    expect(essay).toBeDefined()
    expect(essay?.essayTopics).toBeUndefined()

    const detail = parseData(await admin.get(`/api/questions/${choiceId}`), QuestionDetailSchema)
    expect(detail.questionType).toBe('essay')
    expect(detail.essayTopics).toEqual(topics)
    expect(detail.parts[0]).toMatchObject({ mode: 'essay_choice', topics })
    const plain = parseData(await admin.get(`/api/questions/${essayId}`), QuestionDetailSchema)
    expect(plain.essayTopics).toBeUndefined()
  })

  it('a flat edit of an esei pilihan question keeps its topics (the parts tree is not rewritten)', async () => {
    const before = (await repo.get(choiceId, 'latest'))!
    const res = await admin.put(`/api/questions/${choiceId}`, { questionText: 'Karangan pilihan tajuk untuk paparan rata (disunting).', difficultyLevel: 3, subjectId: tag.subjectId, educationLevelId: tag.levelId })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const after = (await repo.get(choiceId, 'latest'))!
    expect(after.version.parts).toEqual(before.version.parts)
    expect(after.version.parts[0]).toMatchObject({ mode: 'essay_choice', topics })
  })

  it('bank adapter: the explanation source is typed essay_choice with the model answer, and the canned text says Esei pilihan', async () => {
    const adapter = new QuestionBankAdapter(repo, svc, t.app.get(CurriculumRepository), t.app.get(PrismaService))
    const source = await adapter.getExplanationSource(choiceId)
    expect(source).toMatchObject({ id: choiceId, type: 'essay_choice', answerText: 'Contoh karangan model.', options: null })
    expect(cannedExplanation(source!, 0)).toContain('Esei pilihan')
    const plain = await adapter.getExplanationSource(essayId)
    expect(plain?.type).toBe('essay')
    // The reporting brief still treats it as structured (not mcq), as every non-MCQ question.
    expect((await adapter.describe([choiceId])).get(choiceId)?.type).toBe('structured')
  })
})
