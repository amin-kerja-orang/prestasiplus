import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * BE-13 (writes) API-only scenarios: SPM targets and structured questions. The conformance database
 * has the curriculum and the question seed (three published structured sets, MATH T4, MATH T5, SCI T4).
 * The deep cases (ordering, paging, filters, marks, is_test, limits) are in `apps/api/test/practice-reads/writes`.
 */

const TARGETS = '/spm-targets'
const STRUCTURED = '/practice/structured'

export const practiceReadsWritesScenarios: Scenario[] = [
  {
    id: 'practice-reads-writes-api/anonymous is 401 on the five routes',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', TARGETS), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('PUT', TARGETS, { body: { targets: {} } }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', STRUCTURED), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', `${STRUCTURED}/1`), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', `${STRUCTURED}/1/attempts`, { body: { answers: [] } }), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'practice-reads-writes-api/a write without the CSRF token is 403 CSRF_INVALID',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('PUT', TARGETS, { body: { targets: {} } }), 403, 'CSRF_INVALID')
      expectError(ctx, await student.request('POST', `${STRUCTURED}/1/attempts`, { body: { answers: [] } }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'practice-reads-writes-api/spm targets: 20 subjects, replace-all save is idempotent, a bad grade is 422 "Gred target tidak sah."',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const first = await student.request('GET', TARGETS)
      ctx.expectStatus(first, 200)
      const subjects = (dataOf(first).subjects as { id: string; target: string | null }[] | undefined) ?? []
      ctx.check(subjects.length === 20, `expected 20 SPM subjects, got ${String(subjects.length)}`)
      const [a, b] = subjects
      if (!a || !b) return
      const body = { targets: { [a.id]: 'A', [b.id]: 'C+' } }
      const saved = await student.request('PUT', TARGETS, { body })
      ctx.expectStatus(saved, 200)
      ctx.check(dataOf(saved).saved === 20 && (saved.body as { status?: unknown }).status === 'Target berjaya disimpan.', 'the save answer differs')
      const again = await student.request('PUT', TARGETS, { body })
      ctx.check(JSON.stringify(again.body) === JSON.stringify(saved.body), 'the second identical save answered differently')
      const read = (dataOf(await student.request('GET', TARGETS)).subjects as { id: string; target: string | null }[] | undefined) ?? []
      ctx.check(read.filter((s) => s.target !== null).length === 2 && read.find((s) => s.id === a.id)?.target === 'A' && read.find((s) => s.id === b.id)?.target === 'C+', 'the stored targets differ')
      const bad = await student.request('PUT', TARGETS, { body: { targets: { [a.id]: 'F' } } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(errorOf(bad).message === 'Gred target tidak sah.', 'the invalid-grade message differs')
      const cleared = await student.request('PUT', TARGETS, { body: { targets: {} } })
      ctx.expectStatus(cleared, 200)
      const after = (dataOf(await student.request('GET', TARGETS)).subjects as { target: string | null }[] | undefined) ?? []
      ctx.check(after.every((s) => s.target === null), 'an empty save must clear every target')
    },
  },
  {
    id: 'practice-reads-writes-api/structured: list, detail and attempt with marks per sub-question; unknown ids are 404, a bad body 422',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const listed = await student.request('GET', STRUCTURED)
      ctx.expectStatus(listed, 200)
      const cards = listOf(listed)
      ctx.check(cards.length === 3, `expected the 3 seeded structured sets, got ${String(cards.length)}`)
      const card = cards[0]
      if (!card) return
      const id = String(card.id)
      const detail = await student.request('GET', `${STRUCTURED}/${id}`)
      ctx.expectStatus(detail, 200)
      const subs = (dataOf(detail).subQuestions as { id: string; marks: number }[] | undefined) ?? []
      ctx.check(subs.length > 0 && !JSON.stringify(detail.body).includes('modelAnswer'), 'the detail must list sub-questions and no model answer')
      const leafSub = subs.find((s) => s.marks > 0)
      if (!leafSub) return
      const done = await student.request('POST', `${STRUCTURED}/${id}/attempts`, { body: { answers: [{ subQuestionId: leafSub.id, text: 'Jawapan yang cukup panjang untuk markah penuh.' }] } })
      ctx.expectStatus(done, 201)
      const out = dataOf(done) as { marks?: { subQuestionId: string; awarded: number; max: number }[]; totalAwarded?: number; totalMax?: number; modelAnswers?: unknown[] }
      ctx.check((out.marks ?? []).length === subs.length, 'one mark entry per sub-question expected')
      ctx.check(out.marks?.find((m) => m.subQuestionId === leafSub.id)?.awarded === leafSub.marks, 'a long answer must earn the full marks of its sub-question')
      ctx.check(out.totalAwarded === leafSub.marks && out.totalMax === subs.reduce((n, s) => n + s.marks, 0), 'the totals differ')
      ctx.check((out.modelAnswers ?? []).length === subs.length, 'one model answer per sub-question expected')
      expectError(ctx, await student.request('GET', `${STRUCTURED}/999999999`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('POST', `${STRUCTURED}/999999999/attempts`, { body: { answers: [] } }), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('POST', `${STRUCTURED}/${id}/attempts`, { body: { answers: 'x' } }), 422, 'VALIDATION_ERROR')
    },
  },
]
