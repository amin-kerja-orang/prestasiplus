import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Practice (BE-12) API-only scenarios: the four session routes. The question source is the BE-09 bank
 * (`PracticeQuestionsBridgeModule`) and the assigned work is BE-18's; the ramalan source still answers its
 * documented default until BE-41 merges. The deep scenarios (a full start, check and submit with a fake bank)
 * are in `apps/api/test/practice`; the bank-backed ones in `apps/api/test/practice-question-source`.
 */

/** Keys that must never appear in a start response (AC 4). */
const KEY_FIELDS = new Set(['correctLabel', 'correctAnswer', 'correctOptionId', 'correct', 'explanation', 'key', 'isCorrect', 'tfAnswer', 'modelAnswer'])
const leakedKeys = (value: unknown, out: string[] = []): string[] => {
  if (Array.isArray(value)) for (const v of value) leakedKeys(v, out)
  else if (value !== null && typeof value === 'object')
    for (const [k, v] of Object.entries(value)) {
      if (KEY_FIELDS.has(k)) out.push(k)
      leakedKeys(v, out)
    }
  return out
}

const SESSION = '11111111-1111-4111-8111-111111111111'
const fieldsOf = (res: { body: unknown }): Record<string, string> => (errorOf(res as never).fields as Record<string, string> | undefined) ?? {}

export const practiceScenarios: Scenario[] = [
  {
    id: 'practice-api/anonymous is 401 on every session route',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('POST', '/practice/sessions', { body: { mode: 'random' } }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', `/practice/sessions/${SESSION}/check-answer`, { body: {} }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', `/practice/sessions/${SESSION}/submit`, { body: {} }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/practice/sessions?modes=random'), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'practice-api/a write without the CSRF token is 403 CSRF_INVALID',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/practice/sessions', { body: { mode: 'random' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await student.request('POST', `/practice/sessions/${SESSION}/check-answer`, { body: {} }), 403, 'CSRF_INVALID')
      expectError(ctx, await student.request('POST', `/practice/sessions/${SESSION}/submit`, { body: {} }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'practice-api/start: an unknown assigned item is 404 (BE-18 bound), a bad body is 422 "Nilai tidak sah.", an unknown subject is 404',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      // BE-18 binds the assignment source: an unknown assigned item (mission, remedial, question_set) is 404.
      const mission = await student.request('POST', '/practice/sessions', { body: { mode: 'mission', missionId: '987654321' } })
      expectError(ctx, mission, 404, 'NOT_FOUND')
      ctx.check(errorOf(mission).message === 'Rekod tidak dijumpai.', 'unknown mission message differs')
      for (const body of [{ mode: 'remedial', remedialTestId: '987654321' }, { mode: 'question_set', questionSetId: '987654321' }]) {
        expectError(ctx, await student.request('POST', '/practice/sessions', { body }), 404, 'NOT_FOUND')
      }
      const bad = await student.request('POST', '/practice/sessions', { body: { mode: 'bogus' } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(bad).message === 'Nilai tidak sah.' && fieldsOf(bad).mode === 'Nilai tidak sah.', 'invalid mode message differs')
      const pksk = await student.request('POST', '/practice/sessions', { body: { mode: 'pksk' } })
      expectError(ctx, pksk, 422, 'VALIDATION_ERROR')
      const unknown = await student.request('POST', '/practice/sessions', { body: { mode: 'random', subjectCode: 'TIADA', count: 5 } })
      expectError(ctx, unknown, 404, 'NOT_FOUND')
      ctx.check(errorOf(unknown).message === 'Rekod tidak dijumpai.', 'not-found message differs')
      ctx.check(unknown.headers['cache-control']?.includes('no-store') === true, 'a practice answer is cacheable')
    },
  },
  {
    id: 'practice-api/check-answer and submit: an unknown or foreign session is 404 "Rekod tidak dijumpai."',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      for (const id of [SESSION, 's_unknown']) {
        const check = await student.request('POST', `/practice/sessions/${id}/check-answer`, { body: { questionId: '1', selectedOptionId: 0 } })
        expectError(ctx, check, 404, 'NOT_FOUND')
        ctx.check(errorOf(check).message === 'Rekod tidak dijumpai.', 'not-found message differs')
        expectError(ctx, await student.request('POST', `/practice/sessions/${id}/submit`, { body: { timeSpent: 10 } }), 404, 'NOT_FOUND')
      }
      const invalid = await student.request('POST', `/practice/sessions/${SESSION}/check-answer`, { body: {} })
      expectError(ctx, invalid, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(invalid).message === 'Jawapan tidak sah.', 'invalid-answer message differs')
    },
  },
  {
    id: 'practice-api/history: any role gets 200 with meta.stats, a bad mode is 422 "Mod tidak sah."',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['teacher', 'admin'] as const) {
        const res = await (await ctx.as(role)).request('GET', '/practice/sessions?modes=random')
        ctx.expectStatus(res, 200)
        ctx.check(listOf(res).length === 0, `${role} must have no practice session`)
        const meta = (res.body as { meta?: { activeType?: unknown; stats?: Record<string, unknown> } }).meta
        ctx.check(meta?.activeType === null && meta.stats?.sessions === 0 && meta.stats.avgAccuracyPct === 0, 'the stats of an empty history differ')
        ctx.check(res.headers['cache-control']?.includes('no-store') === true, 'the history is cacheable')
      }
      const student = await ctx.as('student')
      for (const modes of ['bogus', 'random,bogus', '']) {
        const res = await student.request('GET', `/practice/sessions?modes=${modes}`)
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check(errorOf(res).message === 'Mod tidak sah.' && fieldsOf(res).modes === 'Mod tidak sah.', 'invalid modes message differs')
      }
      const missing = await student.request('GET', '/practice/sessions')
      expectError(ctx, missing, 422, 'VALIDATION_ERROR')
      ctx.check(dataOf(missing).sessions === undefined, 'an error carries no data')
    },
  },
  {
    id: 'practice-api/start from the BE-09 bank: past_year serves seeded published SPM-pool MCQs without the key; an empty draw is 422 NOT_ENOUGH_QUESTIONS',
    domain: 'practice',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      // The base seed has one published, active, SPM-pool MCQ per subject (SEED-MCQ-*-T5): past_year serves it.
      const res = await student.request('POST', '/practice/sessions', { body: { mode: 'past_year', subjectCode: 'MATH', count: 5 } })
      ctx.expectStatus(res, 201)
      const data = dataOf(res) as { mode?: unknown; questions?: { id: string; options: unknown[] }[] }
      ctx.check(data.mode === 'past_year', 'the started mode differs')
      ctx.check(Array.isArray(data.questions) && data.questions.length >= 1, 'no question was served from the bank')
      ctx.check((data.questions ?? []).every((q) => q.options.length >= 3), 'a served MCQ has fewer than 3 options')
      const leaked = leakedKeys(res.body)
      ctx.check(leaked.length === 0, `the start response leaks ${leaked.join(', ')}`)
      // A subject with no question in the bank cannot fill a draw (Darjah is hidden, D72, and the SPM levels of MATH are stocked by the
      // battle fixture, so the empty case is a subject nobody seeded).
      const empty = await student.request('POST', '/practice/sessions', { body: { mode: 'random', subjectCode: 'SEJ', count: 5 } })
      expectError(ctx, empty, 422, 'NOT_ENOUGH_QUESTIONS')
    },
  },
]
