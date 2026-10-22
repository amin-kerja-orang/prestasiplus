import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError } from '../helpers'

/**
 * Mohon Keluarga Angkat (BE-47, M21 #15) API-only scenarios: the guards, the 201, the 422 `fields` body with the exact BM
 * copy and the identical answer for a non-student and an unknown e-mail. Deep rules (stored values, is_test, rate limit,
 * logs, constraints) are in `apps/api/test/sponsorship`. The response is parsed against the contract schema by the runner.
 */

const OK_BODY = { studentEmail: 'pelajar@demo.test', studentCategory: 'B40', familyIncomeRange: 'RM1,000 - RM2,500', reason: 'Pelajar tinggal bersama nenek.' }
const fieldsOf = (res: { body: unknown }): Record<string, unknown> => (errorOf(res as never).fields ?? {}) as Record<string, unknown>

export const fosterApplicationScenarios: Scenario[] = [
  {
    id: 'sponsorship-api/foster application: a guest is 401, a missing CSRF header is 403',
    domain: 'sponsorship',
    targets: API_ONLY,
    async run(ctx) {
      const guest = await ctx.anonymous().request('POST', '/mohon-keluarga-angkat', { body: OK_BODY })
      expectError(ctx, guest, 401, 'UNAUTHORIZED')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/mohon-keluarga-angkat', { body: OK_BODY }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'sponsorship-api/foster application: student, teacher and admin each get 201 {data: {id}} with a decimal-string id, no-store',
    domain: 'sponsorship',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'teacher', 'admin'] as const) {
        const res = await (await ctx.as(role)).request('POST', '/mohon-keluarga-angkat', { body: OK_BODY })
        ctx.expectStatus(res, 201)
        ctx.check(/^[1-9]\d*$/.test(String(dataOf(res).id)), `${role}: id must be a decimal string`)
        ctx.check(Object.keys(dataOf(res)).join() === 'id', `${role}: only the id is returned`)
        ctx.check(res.headers['cache-control'] === 'no-store', `${role}: the answer must be no-store`)
      }
      const blank = await (await ctx.as('student')).request('POST', '/mohon-keluarga-angkat', { body: { ...OK_BODY, familyIncomeRange: '' } })
      ctx.expectStatus(blank, 201)
    },
  },
  {
    id: 'sponsorship-api/foster application: 422 collects every field in order with the exact BM copy and the message suffix',
    domain: 'sponsorship',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const all = await student.request('POST', '/mohon-keluarga-angkat', { body: { studentEmail: 'bukan-emel', studentCategory: 'VIP', familyIncomeRange: 'RM9', reason: '  ' } })
      expectError(ctx, all, 422, 'VALIDATION_ERROR')
      ctx.check(
        JSON.stringify(fieldsOf(all)) === JSON.stringify({ studentEmail: 'Format e-mel tidak sah.', studentCategory: 'Pilihan tidak sah.', familyIncomeRange: 'Pilihan tidak sah.', reason: 'Sila isi ruangan ini.' }),
        'fields must be in the order studentEmail, studentCategory, familyIncomeRange, reason with the BM copy',
      )
      ctx.check(errorOf(all).message === 'Format e-mel tidak sah. (and 3 more errors)', 'top-level message must carry the suffix')
      const empty = await student.request('POST', '/mohon-keluarga-angkat', { body: {} })
      ctx.check(errorOf(empty).message === 'Sila isi ruangan ini. (and 2 more errors)', 'missing fields: first message plus the suffix')
    },
  },
  {
    id: 'sponsorship-api/foster application: a teacher, an admin and an unknown e-mail give the same 422 (no enumeration)',
    domain: 'sponsorship',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const answers: string[] = []
      for (const studentEmail of ['guru@demo.test', 'admin@demo.test', 'tiada.siapa@demo.test']) {
        const res = await student.request('POST', '/mohon-keluarga-angkat', { body: { ...OK_BODY, studentEmail } })
        expectError(ctx, res, 422, 'VALIDATION_ERROR')
        ctx.check(fieldsOf(res).studentEmail === 'Email pelajar tidak dijumpai dalam PrestasiPlus.', `${studentEmail}: wrong studentEmail message`)
        answers.push(JSON.stringify({ ...errorOf(res), requestId: null }))
      }
      ctx.check(answers.every((a) => a === answers[0]), 'the three answers must be identical apart from the request id')
    },
  },
]
