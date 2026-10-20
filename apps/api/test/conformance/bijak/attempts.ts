import type { Scenario } from '@pp/contract-tests'

import { makePng } from '../../files/fixtures'
import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

const UNKNOWN_ATTEMPT = '00000000-0000-4000-8000-000000000000'
const UNKNOWN_PAPER = '999999999'
const png = () => new Uint8Array(makePng())

/**
 * Bijak attempts (BE-16). The conformance app has no paper or question source plugged in (BE-15 and
 * BE-09 own them), so no attempt can be started here; the success paths, marking and the reveal
 * rules are proved by `test/bijak-attempts/**` with fakes for the ports and the contract schemas.
 * These scenarios send a request to every route of the card and check status, error code, message and
 * the contract shape of each answer. API target only (cookie session with CSRF, multipart).
 */
export const bijakAttemptsScenarios: Scenario[] = [
  {
    id: 'bijak-attempts-api/student: nothing to resume, an unknown paper or attempt is 404, bad bodies are 422',
    domain: 'bijak-attempts',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const inProgress = await me.request('GET', `/bijak/papers/${UNKNOWN_PAPER}/in-progress`)
      ctx.expectStatus(inProgress, 200)
      ctx.check((inProgress.body as { data: unknown }).data === null, 'in-progress must be { data: null } when nothing is open')

      const start = await me.request('POST', '/bijak/attempts', { body: { paperId: UNKNOWN_PAPER, mode: 'exam' } })
      expectError(ctx, start, 404, 'NOT_FOUND')
      ctx.check((start.body as { error: { message: string } }).error.message === 'Kertas tidak ditemui', 'wrong message for an unknown paper')
      expectError(ctx, await me.request('POST', '/bijak/attempts', { body: { paperId: UNKNOWN_PAPER, mode: 'sprint' } }), 422, 'VALIDATION_ERROR')

      const notFound = async (res: Promise<{ status: number; body: unknown }>) => {
        const r = (await res) as Awaited<ReturnType<typeof me.request>>
        expectError(ctx, r, 404, 'NOT_FOUND')
        ctx.check((r.body as { error: { message: string } }).error.message === 'Percubaan tidak ditemui', 'wrong message for an unknown attempt')
      }
      await notFound(me.request('GET', `/bijak/attempts/${UNKNOWN_ATTEMPT}`))
      await notFound(me.request('PUT', `/bijak/attempts/${UNKNOWN_ATTEMPT}/answers`, { body: { changes: [] } }))
      await notFound(me.request('POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/submit`, { body: { idempotencyKey: 'k', changes: [] } }))
      await notFound(me.request('POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/abandon`))
      await notFound(me.request('POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/questions/q1/check`))
      await notFound(me.request('GET', `/bijak/attempts/${UNKNOWN_ATTEMPT}/result`))

      expectError(ctx, await me.request('PUT', `/bijak/attempts/${UNKNOWN_ATTEMPT}/answers`, { body: { changes: 'x' } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await me.request('POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/submit`, { body: { changes: [] } }), 422, 'VALIDATION_ERROR')
      // The multipart route validates the partId field before it looks at the attempt.
      expectError(ctx, await me.request('POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/photos`, { file: { field: 'file', filename: 'g.png', contentType: 'image/png', content: png() } }), 422, 'VALIDATION_ERROR')

      const history = await me.request('GET', '/bijak/history')
      ctx.expectStatus(history, 200)
      ctx.check(listOf(history).length === 0, 'a fresh student has no attempts')
    },
  },
  {
    id: 'bijak-attempts-api/anonymous is 401 and a teacher is 403 on every route',
    domain: 'bijak-attempts',
    targets: API_ONLY,
    async run(ctx) {
      const calls: [Parameters<ReturnType<typeof ctx.anonymous>['request']>[0], string, object?][] = [
        ['GET', `/bijak/papers/${UNKNOWN_PAPER}/in-progress`],
        ['POST', '/bijak/attempts', { paperId: UNKNOWN_PAPER, mode: 'exam' }],
        ['GET', `/bijak/attempts/${UNKNOWN_ATTEMPT}`],
        ['PUT', `/bijak/attempts/${UNKNOWN_ATTEMPT}/answers`, { changes: [] }],
        ['POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/submit`, { idempotencyKey: 'k', changes: [] }],
        ['POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/abandon`],
        ['POST', `/bijak/attempts/${UNKNOWN_ATTEMPT}/questions/q1/check`],
        ['GET', `/bijak/attempts/${UNKNOWN_ATTEMPT}/result`],
        ['GET', '/bijak/history'],
      ]
      const anon = ctx.anonymous()
      for (const [method, path, body] of calls) expectError(ctx, await anon.request(method, path, body ? { body } : {}), 401, 'UNAUTHORIZED')
      const teacher = await ctx.as('teacher')
      for (const [method, path, body] of calls) expectError(ctx, await teacher.request(method, path, body ? { body } : {}), 403, 'FORBIDDEN')
      ctx.check(dataOf(await teacher.request('GET', '/bijak/history')).data === undefined, 'a teacher must get no attempt data')
    },
  },
]
