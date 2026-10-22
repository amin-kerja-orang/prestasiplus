import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * SPM hub (BE-41) API-only scenarios: the 14 routes of M06 on the conformance database (curriculum, demo question bank
 * and the SPM seed). The deep cases (set statuses, mock grading, walkthrough limits, Duta rules) are in `apps/api/test/spm`.
 * The mock exam in these scenarios is Paper 1 of Matematik, which the demo bank can fill with its single pool question.
 */

const UNKNOWN_MOCK = '11111111-1111-4111-8111-111111111111'
const fieldsOf = (res: { body: unknown }): Record<string, string> => (errorOf(res as never).fields as Record<string, string> | undefined) ?? {}

export const spmScenarios: Scenario[] = [
  {
    id: 'spm-api/anonymous is 401 on all 14 routes',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/spm/overview', '/spm/databank', '/spm/latih-tubi', '/spm/latih-tubi/MATH', '/spm/tracking-a', '/spm/tracking-a/MATH', '/spm/subjektif', '/spm-mocks', `/spm-mocks/${UNKNOWN_MOCK}`, `/spm-mocks/${UNKNOWN_MOCK}/result`, '/duta/recommendations']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      for (const path of ['/spm-mocks', `/spm-mocks/${UNKNOWN_MOCK}/submit`, '/spm-walkthrough/solve']) {
        expectError(ctx, await anon.request('POST', path, { body: {} }), 401, 'UNAUTHORIZED')
      }
    },
  },
  {
    id: 'spm-api/a POST without the CSRF token is 403 CSRF_INVALID',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/spm-mocks', { body: { subject: 'Sejarah' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await student.request('POST', `/spm-mocks/${UNKNOWN_MOCK}/submit`, { body: { answers: [] } }), 403, 'CSRF_INVALID')
      expectError(ctx, await student.request('POST', '/spm-walkthrough/solve', { body: { subject: 'Matematik', question_text: 'x' } }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'spm-api/hub reads work for every role; readiness is admin only',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'teacher', 'school_admin', 'admin'] as const) {
        const c = await ctx.as(role)
        for (const path of ['/spm/overview', '/spm/databank', '/spm/latih-tubi', '/spm/latih-tubi/MATH', '/spm/tracking-a', '/spm/tracking-a/MATH', '/spm/subjektif', '/spm-mocks', '/duta/recommendations']) {
          const res = await c.request('GET', path)
          ctx.expectStatus(res, 200)
          ctx.check(res.headers['cache-control']?.includes('no-store') === true, `${path} must be no-store`)
        }
        const hub = dataOf(await c.request('GET', '/spm/tracking-a'))
        ctx.check((hub.readiness === null) === (role !== 'admin'), `readiness for ${role} differs`)
      }
      const databank = listOf(await (await ctx.as('student')).request('GET', '/spm/databank'))
      ctx.check(databank.length === 18 && databank[0]?.code === 'BM', 'the databank lists 18 subjects in order')
      const groups = dataOf(await (await ctx.as('student')).request('GET', '/spm/latih-tubi'))
      ctx.check(Array.isArray(groups.teras) && groups.teras.length === 7 && Array.isArray(groups.elektif) && groups.elektif.length === 12, 'Latih Tubi lists 7 teras and 12 elektif subjects')
    },
  },
  {
    id: 'spm-api/unknown subject codes are 404 "Not Found."; BM and BI redirect to the bahasa track',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      for (const path of ['/spm/latih-tubi/NOPE', '/spm/latih-tubi/SK', '/spm/tracking-a/NOPE']) {
        const res = await student.request('GET', path)
        expectError(ctx, res, 404, 'NOT_FOUND')
        ctx.check(errorOf(res).message === 'Not Found.', `${path} message differs`)
      }
      const redirect = dataOf(await student.request('GET', '/spm/tracking-a/BM'))
      ctx.check(typeof redirect.redirect === 'string' && /^\/latihan-berstruktur\?subject_id=\d+&scope=spm&track=bahasa$/.test(redirect.redirect), 'BM must redirect to the bahasa track')
    },
  },
  {
    id: 'spm-api/mock exam: create, sit, submit, result; a second submit is 409; a foreign mock is 404',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const created = await student.request('POST', '/spm-mocks', { body: { subject: 'Matematik', paperNumber: 1 } })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      const paper = dataOf(await student.request('GET', `/spm-mocks/${id}`))
      ctx.check(Array.isArray(paper.items) && paper.items.length >= 1, 'the paper has items')
      ctx.check(!JSON.stringify(paper).includes('modelAnswer'), 'the paper must not carry a key')

      const early = await student.request('GET', `/spm-mocks/${id}/result`)
      expectError(ctx, early, 409, 'NOT_SUBMITTED')
      ctx.check(errorOf(early).message === 'Mock belum dihantar.', 'NOT_SUBMITTED message differs')

      const bad = await student.request('POST', `/spm-mocks/${id}/submit`, { body: { answers: 'x' } })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(bad).answers === 'Jawapan tidak sah.', 'answers message differs')

      const submitted = await student.request('POST', `/spm-mocks/${id}/submit`, { body: { answers: [{ no: 1, answer: 'A' }] } })
      ctx.expectStatus(submitted, 200)
      const result = dataOf(submitted)
      ctx.check(result.id === id && typeof result.grade === 'string', 'the result carries the grade')
      const again = await student.request('POST', `/spm-mocks/${id}/submit`, { body: { answers: [] } })
      expectError(ctx, again, 409, 'CONFLICT')
      ctx.check(errorOf(again).message === 'Mock ini sudah dihantar.', 'conflict message differs')
      ctx.expectStatus(await student.request('GET', `/spm-mocks/${id}/result`), 200)
      ctx.check(listOf(await student.request('GET', '/spm-mocks')).some((m) => m.id === id && m.status === 'submitted'), 'the list shows the submitted mock')

      const teacher = await ctx.as('teacher')
      for (const [method, path] of [['GET', `/spm-mocks/${id}`], ['GET', `/spm-mocks/${id}/result`], ['POST', `/spm-mocks/${id}/submit`]] as const) {
        const res = await teacher.request(method, path, method === 'POST' ? { body: { answers: [] } } : {})
        expectError(ctx, res, 404, 'NOT_FOUND')
        ctx.check(errorOf(res).message === 'Not Found.', `${path} message differs`)
      }
      expectError(ctx, await student.request('GET', `/spm-mocks/${UNKNOWN_MOCK}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'spm-api/mock exam validation: subject and paper (422 with the BM messages)',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const subject = await student.request('POST', '/spm-mocks', { body: { subject: 'Muzik' } })
      expectError(ctx, subject, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(subject).subject === 'Sila pilih subjek.', 'subject message differs')
      const paper = await student.request('POST', '/spm-mocks', { body: { subject: 'Sejarah', paperNumber: 3 } })
      expectError(ctx, paper, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(paper).paperNumber === 'Paper mesti 1 atau 2.', 'paper message differs')
    },
  },
  {
    id: 'spm-api/walkthrough: canned text, business errors are HTTP 200, only an unlisted subject is 422',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const ok = await student.request('POST', '/spm-walkthrough/solve', { body: { subject: 'Matematik', question_text: 'Selesaikan 2x + 3 = 11' } })
      ctx.expectStatus(ok, 200)
      const body = ok.body as { ok?: boolean; walkthrough?: string }
      ctx.check(body.ok === true && /^Soalan: Selesaikan 2x \+ 3 = 11\n\nLangkah 1:/.test(body.walkthrough ?? ''), 'the walkthrough text differs')
      const empty = await student.request('POST', '/spm-walkthrough/solve', { body: { subject: 'Matematik', question_text: '  ' } })
      ctx.expectStatus(empty, 200)
      ctx.check(JSON.stringify(empty.body) === JSON.stringify({ ok: false, error: 'Sila masukkan soalan atau muat naik gambar soalan.' }), 'the empty-question body differs')
      const subject = await student.request('POST', '/spm-walkthrough/solve', { body: { subject: 'Muzik', question_text: 'x' } })
      expectError(ctx, subject, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(subject).subject === 'Sila pilih subjek.', 'subject message differs')
      // A file part alone carries no subject: 422. A file over 5 MB is a business error, not a 413.
      const noSubject = await student.request('POST', '/spm-walkthrough/solve', { file: { field: 'image', filename: 'a.png', contentType: 'image/png', content: new Uint8Array(10) } })
      expectError(ctx, noSubject, 422, 'VALIDATION_ERROR')
      const huge = await student.request('POST', '/spm-walkthrough/solve', { file: { field: 'image', filename: 'a.png', contentType: 'image/png', content: new Uint8Array(5 * 1024 * 1024 + 1) } })
      ctx.expectStatus(huge, 200)
      ctx.check(JSON.stringify(huge.body) === JSON.stringify({ ok: false, error: 'Gambar tidak sah.' }), 'the oversize body differs')
    },
  },
  {
    id: 'spm-api/duta: an active bintang card, deterministic per seed',
    domain: 'spm',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const a = await student.request('GET', '/duta/recommendations?seed=5')
      const b = await student.request('GET', '/duta/recommendations?seed=5')
      ctx.expectStatus(a, 200)
      const card = dataOf(a)
      ctx.check(card.tier === 'bintang' && card.active === true, 'only an active bintang card is returned')
      ctx.check(JSON.stringify(a.body) === JSON.stringify(b.body), 'the same seed must give the same card')
      const preferred = dataOf(await student.request('GET', '/duta/recommendations?subject=Matematik&seed=1'))
      ctx.check(preferred.subject === 'Matematik', 'the subject is preferred')
    },
  },
]
