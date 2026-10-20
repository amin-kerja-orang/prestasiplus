import type { Scenario } from '@pp/contract-tests'

import { registerStudent } from '../account/account'
import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Bijak SPM papers (BE-15) scenarios: the seeded PoC papers, covers, Kontrak and subjects; Jana Kertas
 * (201, private to its creator, a new id per call); NO_BLUEPRINT, SHORTAGE and the validation error;
 * roles and CSRF. API target only (cookie session with CSRF, seeded exam data). Every response is also
 * checked against the contract by the runner.
 */
const KEYS_NEVER_RETURNED = ['scheme', 'answerKey', 'answer', 'accepted', 'correct', 'correctOption', 'explanation', 'questionIds', 'questionId', 'pool']

const keysOf = (value: unknown, out = new Set<string>()): Set<string> => {
  if (Array.isArray(value)) for (const v of value) keysOf(v, out)
  else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      out.add(k)
      keysOf(v, out)
    }
  }
  return out
}

export const bijakPapersScenarios: Scenario[] = [
  {
    id: 'bijak-papers-api/the seeded PoC papers, covers, contracts and subjects, with no answer key anywhere',
    domain: 'bijak-papers',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const list = await me.request('GET', '/bijak/papers')
      ctx.expectStatus(list, 200)
      const papers = listOf(list)
      ctx.check(papers.length === 4, `expected 4 published PoC papers, got ${String(papers.length)}`)
      ctx.check(papers.every((p) => p.kind === 'pilihan' && p.status === 'belum'), 'every seeded paper must be a pilihan paper not yet started')
      const mat2 = papers.find((p) => p.code === '1449/2')
      ctx.check(mat2?.marks === 21 && mat2?.questionCount === 6, 'Matematik Kertas 2 must total 21 marks over 6 questions (choose-N counted once)')

      const cover = await me.request('GET', `/bijak/papers/${String(mat2?.id)}`)
      ctx.expectStatus(cover, 200)
      const sections = (dataOf(cover).sections ?? []) as { label: string; instruction: string; chooseN?: number }[]
      ctx.check(sections.map((s) => s.instruction).join('|') === 'Jawab semua soalan.|Jawab semua soalan.|Jawab 1 daripada 2 soalan.', 'section instructions differ from the mock')
      ctx.check(sections[2]?.chooseN === 1, 'Bahagian C must be choose 1')

      const contracts = await me.request('GET', '/bijak/contracts')
      ctx.expectStatus(contracts, 200)
      ctx.check(listOf(contracts).length === 4, 'expected 4 blueprints')
      const subjects = await me.request('GET', '/bijak/subjects')
      ctx.expectStatus(subjects, 200)
      ctx.check(listOf(subjects).map((s) => s.code).join(',') === 'MAT,SN,SEJ', 'hub subjects differ (MAT, SN, SEJ expected)')

      for (const res of [list, cover, contracts, subjects]) {
        const found = KEYS_NEVER_RETURNED.filter((k) => keysOf(res.body).has(k))
        ctx.check(found.length === 0, `a response carries keys that must never be returned: ${found.join(', ')}`)
      }
      expectError(ctx, await me.request('GET', '/bijak/papers/999999999'), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'bijak-papers-api/generate: 201, a new private paper per call; another student gets 404',
    domain: 'bijak-papers',
    targets: API_ONLY,
    async run(ctx) {
      const owner = (await registerStudent(ctx)).client
      const first = await owner.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 2 } })
      ctx.expectStatus(first, 201)
      const second = await owner.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 2 } })
      ctx.expectStatus(second, 201)
      const a = String(dataOf(first).paperId)
      const b = String(dataOf(second).paperId)
      ctx.check(a !== b, 'a second generate must create a new paper id')
      const cover = await owner.request('GET', `/bijak/papers/${a}`)
      ctx.expectStatus(cover, 200)
      ctx.check(dataOf(cover).kind === 'jana' && Array.isArray(dataOf(cover).sections) && (dataOf(cover).sections as unknown[]).length === 3, 'the generated paper must be kind jana with the 3 blueprint sections')
      ctx.check(!listOf(await owner.request('GET', '/bijak/papers')).some((p) => p.id === a), 'a generated paper must not be listed in Kertas Pilihan')

      const other = (await registerStudent(ctx)).client
      const foreign = await other.request('GET', `/bijak/papers/${a}`)
      expectError(ctx, foreign, 404, 'NOT_FOUND')
      ctx.check(errorOf(foreign).message === 'Kertas tidak ditemui', 'the 404 message must be "Kertas tidak ditemui"')
    },
  },
  {
    id: 'bijak-papers-api/generate errors: NO_BLUEPRINT, SHORTAGE with a list, VALIDATION_ERROR',
    domain: 'bijak-papers',
    targets: API_ONLY,
    async run(ctx) {
      const me = await ctx.as('student')
      const none = await me.request('POST', '/bijak/papers/generate', { body: { subject: 'SEJ', kertas: 2 } })
      expectError(ctx, none, 422, 'NO_BLUEPRINT')
      ctx.check(errorOf(none).message === 'Belum ada kontrak untuk subjek dan kertas ini', 'the NO_BLUEPRINT message differs')
      const short = await me.request('POST', '/bijak/papers/generate', { body: { subject: 'SN', kertas: 1 } })
      expectError(ctx, short, 422, 'SHORTAGE')
      const shortages = ((errorOf(short).details ?? {}) as { shortages?: { section: string; need: number; have: number }[] }).shortages ?? []
      ctx.check(shortages.length === 1 && shortages[0]?.need === 40 && shortages[0]?.have === 0, 'SHORTAGE must list Bahagian A: need 40, have 0')
      expectError(ctx, await me.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 0 } }), 422, 'VALIDATION_ERROR')
    },
  },
  {
    id: 'bijak-papers-api/roles: anonymous 401, a teacher 403, a POST without CSRF 403',
    domain: 'bijak-papers',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/bijak/papers'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/bijak/contracts'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 1 } }), 401, 'UNAUTHORIZED')
      const teacher = await ctx.as('teacher')
      expectError(ctx, await teacher.request('GET', '/bijak/papers'), 403, 'FORBIDDEN')
      expectError(ctx, await teacher.request('GET', '/bijak/subjects'), 403, 'FORBIDDEN')
      expectError(ctx, await teacher.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 1 } }), 403, 'FORBIDDEN')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/bijak/papers/generate', { body: { subject: 'MAT', kertas: 1 } }), 403, 'CSRF_INVALID')
    },
  },
]
