import { QuestionWorkflowAiExplanationResultSchema, QUESTION_WORKFLOW_AI_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { cannedExplanation, nextVariant, variantOf } from '../../src/modules/questions/workflow/ai-explanation/canned-explanation'
import { bootWorkflowApp, expectCsrfInvalid, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

type Roles = Record<'admin' | 'teacher' | 'otherTeacher' | 'schoolAdmin' | 'student', Client>

describe('AI explanation stub (BE-10 AC 8, OD-7)', () => {
  let t: WorkflowTestApp
  let c: Roles

  beforeAll(async () => {
    t = await bootWorkflowApp()
    c = await loginAll(t)
  })
  afterAll(async () => {
    await t.close()
  })
  const stored = (id: string) => t.fake.questions.get(id)!.explanationSource.explanation
  const post = (id: string, query = '') => c.admin.post(`/api/questions/${id}/ai-explanation${query}`)

  it('401, CSRF 403, and 403 for teacher, school admin and student', async () => {
    t.fake.seed({ id: '601' })
    expectError(await t.http().post('/api/questions/601/ai-explanation'), 'UNAUTHORIZED')
    expectCsrfInvalid(await c.admin.noCsrf.post('/api/questions/601/ai-explanation'))
    for (const who of [c.teacher, c.schoolAdmin, c.student]) expectError(await who.post('/api/questions/601/ai-explanation'), 'FORBIDDEN')
    expect(stored('601')).toBeNull()
  })

  it('an unknown question is 404', async () => {
    expectError(await post('987654'), 'NOT_FOUND')
    expectError(await post('abc'), 'NOT_FOUND')
  })

  it('generates the canned text, says it is a stub, and never uses the network', async () => {
    t.fake.seed({ id: '602' }) // 602 % 3 = 2
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network must not be used'))
    try {
      const res = await post('602')
      expect(res.status).toBe(200)
      expect(QuestionWorkflowAiExplanationResultSchema.parse(res.body)).toEqual({ ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.generated, stub: true })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
    expect(stored('602')).toContain('## Penjelasan')
    expect(stored('602')).toContain('**Jawapan betul:** A. Pilihan A')
    expect(stored('602')).toContain('| A. Pilihan A | Betul |')
    expect(stored('602')).toContain('| B. Pilihan B | Tidak tepat |')
    expect(variantOf(stored('602')!)).toBe(2)
  })

  it('without force an existing explanation is returned unchanged', async () => {
    t.fake.seed({ id: '603', explanation: 'Penjelasan guru.' })
    const res = await post('603')
    expect(QuestionWorkflowAiExplanationResultSchema.parse(res.body)).toEqual({ ok: true, message: QUESTION_WORKFLOW_AI_MESSAGES.kept, stub: true })
    expect(stored('603')).toBe('Penjelasan guru.')
    expect(t.fake.calls.filter((x) => x.method === 'setExplanation' && x.args[0] === '603')).toHaveLength(0)
    await post('603', '?force=0')
    await post('603', '?force=true')
    expect(stored('603')).toBe('Penjelasan guru.')
  })

  it('force=1 replaces it, moving to the next variant each time', async () => {
    t.fake.seed({ id: '604' }) // 604 % 3 = 1
    await post('604')
    expect(variantOf(stored('604')!)).toBe(1)
    const first = stored('604')
    const res = await post('604', '?force=1')
    expect(QuestionWorkflowAiExplanationResultSchema.parse(res.body).message).toBe(QUESTION_WORKFLOW_AI_MESSAGES.generated)
    expect(variantOf(stored('604')!)).toBe(2)
    expect(stored('604')).not.toBe(first)
    await post('604', '?force=1')
    expect(variantOf(stored('604')!)).toBe(0)
  })

  it('force=1 over a hand-written explanation starts from id % 3', async () => {
    t.fake.seed({ id: '605', explanation: 'Tulisan tangan.' }) // 605 % 3 = 2
    await post('605', '?force=1')
    expect(variantOf(stored('605')!)).toBe(2)
  })

  it('is deterministic: the same question and variant give the same text', () => {
    const src = t.fake.questions.get('602')!.explanationSource
    expect(cannedExplanation(src, 1)).toBe(cannedExplanation(src, 1))
    expect(cannedExplanation(src, 1)).not.toBe(cannedExplanation(src, 2))
    expect(nextVariant(null, '7')).toBe(1)
  })

  it('a non-MCQ question gets the details table', () => {
    const text = cannedExplanation({ id: '1', type: 'true_false', stemText: 's', options: null, answerText: 'Betul', explanation: null, difficultyLevel: 3, pointsValue: 2 }, 0)
    expect(text).toContain('**Jawapan betul:** Betul')
    expect(text).toContain('| Jenis soalan | Betul / Salah |')
    expect(text).toContain('| Tahap kesukaran | 3 / 5 |')
    expect(text).toContain('| Nilai mata | 2 |')
  })
})
