import type { Scenario } from '@pp/contract-tests'

import { POC_BANK, pocQuestionId } from '../../../src/modules/bijak/papers/poc'
import { registerStudent } from '../account/account'
import { API_ONLY, dataOf, listOf } from '../helpers'

/** Correct choice of each PoC MCQ by its reserved question id (the paper views carry those ids). */
const correctChoice = new Map<string, string>()
for (const q of POC_BANK.questions) {
  if (!q.mcq) continue
  const s = POC_BANK.schemes.find((x) => x.id === q.id)?.scheme as { kind: string; correct?: string } | undefined
  if (s?.kind === 'option' && s.correct) correctChoice.set(pocQuestionId(q.id).toString(), s.correct)
}

/**
 * The wired success path of the Bijak cards (BE-15 papers, BE-16 attempts, BE-12 aggregate, BE-11 reward),
 * through the real `BijakIntegrationModule`. It signs in a freshly registered student so no other scenario
 * (for instance "a fresh student has no attempts") sees its attempt. API target only.
 */
export const bijakIntegrationScenarios: Scenario[] = [
  {
    id: 'bijak-integration-api/student: list papers, start an exam, autosave, submit, result and history (wired BE-15/BE-16/BE-12/BE-11)',
    domain: 'bijak-integration',
    targets: API_ONLY,
    async run(ctx) {
      const { client: me } = await registerStudent(ctx)
      const list = await me.request('GET', '/bijak/papers')
      ctx.expectStatus(list, 200)
      const paper = listOf(list).find((p) => p.code === '1449/1')
      ctx.check(paper !== undefined, 'the published PoC paper 1449/1 must be listed')
      const paperId = String(paper?.id)

      const started = await me.request('POST', '/bijak/attempts', { body: { paperId, mode: 'exam' } })
      ctx.check(started.status === 200 || started.status === 201, `start must be 200 or 201, got ${String(started.status)}`)
      const attemptId = String(dataOf(started).attemptId)
      ctx.check(attemptId.length > 0 && attemptId !== 'undefined', 'start must return an attemptId')

      const view = await me.request('GET', `/bijak/attempts/${attemptId}`)
      ctx.expectStatus(view, 200)
      const questions = (dataOf(view).questions as { id: string }[] | undefined) ?? []
      const qid = questions.map((q) => q.id).find((id) => correctChoice.has(id))
      ctx.check(qid !== undefined, 'the paper must serve at least one PoC MCQ')

      const saved = await me.request('PUT', `/bijak/attempts/${attemptId}/answers`, {
        body: { changes: [{ partId: qid, answer: { choice: correctChoice.get(String(qid)) }, rev: 1, savedAt: new Date().toISOString() }] },
      })
      ctx.expectStatus(saved, 200)

      const submitted = await me.request('POST', `/bijak/attempts/${attemptId}/submit`, { body: { idempotencyKey: 'conformance-integration', changes: [] } })
      ctx.expectStatus(submitted, 200)
      ctx.check(dataOf(submitted).attemptId === attemptId, 'submit must answer the attempt id')

      const result = await me.request('GET', `/bijak/attempts/${attemptId}/result`)
      ctx.expectStatus(result, 200)
      const data = dataOf(result) as { attempt: { status: string }; result: { score: number; max: number } }
      ctx.check(data.attempt.status === 'submitted', `attempt status must be submitted, got ${data.attempt.status}`)
      ctx.check(typeof data.result.score === 'number' && typeof data.result.max === 'number' && data.result.score > 0 && data.result.max >= data.result.score, 'result needs a numeric score above 0 within max')

      const history = await me.request('GET', '/bijak/history')
      ctx.expectStatus(history, 200)
      ctx.check(listOf(history).some((h) => h.attemptId === attemptId), 'the history must contain the attempt')
    },
  },
]
