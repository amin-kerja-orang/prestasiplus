import { QuestionPublicSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, expectError, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'

const SECRET_KEYS = ['key', 'correctAnswer', 'tfAnswer', 'correctAnswerText', 'altAnswers', 'modelAnswer', 'explanation', 'aiExplanation', 'sourceFile', 'sourcePage', 'sourceSet', 'explanationMs', 'explanationEn', 'createdBy']

/** Every key of a JSON value, however deep. */
function keysOf(value: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(value)) value.forEach((v) => keysOf(v, out))
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysOf(v, out)
    }
  }
  return out
}

describe('AC 8: a student never reaches an answer key, explanation or unpublished question', () => {
  let t: QuestionsTestApp
  let student: Client
  let service: QuestionsService
  beforeAll(async () => {
    t = await bootQuestionsApp()
    student = await loginAs(t, 'student')
    service = t.app.get(QuestionsService)
  })
  afterAll(async () => {
    await t.close()
  })

  it('every question route is 403 for a student, for published and unpublished ids alike, with no question data in the body', async () => {
    const ids = await Promise.all(['SEED-MCQ-MATH-T4', 'SEED-DRAFT-BM-T4', 'SEED-REVIEW-SCI-T5', 'SEED-ARCHIVED-MATH-T4', 'SEED-STR-TREE'].map((ref) => questionIdOf(t.db, ref)))
    const urls = [
      '/api/questions',
      '/api/questions/summary',
      '/api/structured-questions',
      '/api/guru/questions',
      ...ids.flatMap((id) => [`/api/questions/${id}`, `/api/structured-questions/${id}`, `/api/guru/questions/${id}`]),
    ]
    for (const url of urls) {
      const res = await student.get(url)
      expectError(res, 'FORBIDDEN')
      const body = JSON.stringify(res.body)
      for (const word of ['correctAnswer', 'questionText', 'sourceFile', 'explanation']) expect(body, url).not.toContain(word)
    }
  })

  it('there is no student question route: a student cannot write through the admin or Guru routes either', async () => {
    expectError(await student.post('/api/questions', {}), 'FORBIDDEN')
    expectError(await student.post('/api/guru/questions', {}), 'FORBIDDEN')
    expectError(await student.post('/api/questions/bulk-action', { action: 'delete', ids: ['1'] }), 'FORBIDDEN')
  })

  it('the learner projection of a published question carries no key, explanation or source at any depth', async () => {
    for (const ref of ['SEED-MCQ-MATH-T4', 'SEED-STR-TREE', 'SEED-STR-ANYN', 'SEED-GRP-AYAT-1']) {
      const id = await questionIdOf(t.db, ref)
      const pub = await service.getPublicForLearner(id)
      QuestionPublicSchema.parse(pub)
      const found = [...keysOf(pub)].filter((k) => SECRET_KEYS.includes(k))
      expect(found, ref).toEqual([])
    }
  })

  it('draft, review, archived and unknown ids are 404 for the learner projection', async () => {
    for (const ref of ['SEED-DRAFT-BM-T4', 'SEED-REVIEW-SCI-T5', 'SEED-ARCHIVED-MATH-T4']) {
      const id = await questionIdOf(t.db, ref)
      await expect(service.getPublicForLearner(id), ref).rejects.toMatchObject({ code: 'NOT_FOUND' })
    }
    await expect(service.getPublicForLearner('999999999')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('a deactivated published question is 404 for the learner at once', async () => {
    const id = await questionIdOf(t.db, 'SEED-MCQ-SCI-T4')
    expect((await service.getPublicForLearner(id)).id).toBe(id)
    await service.deactivate(id)
    await expect(service.getPublicForLearner(id)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    await service.reactivate(id)
    expect((await service.getPublicForLearner(id)).id).toBe(id)
  })
})
