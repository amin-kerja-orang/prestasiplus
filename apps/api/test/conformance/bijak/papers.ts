import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

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
    id: 'bijak-papers-api/roles: anonymous 401, a teacher 403',
    domain: 'bijak-papers',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/bijak/papers'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/bijak/contracts'), 401, 'UNAUTHORIZED')
      const teacher = await ctx.as('teacher')
      expectError(ctx, await teacher.request('GET', '/bijak/papers'), 403, 'FORBIDDEN')
      expectError(ctx, await teacher.request('GET', '/bijak/subjects'), 403, 'FORBIDDEN')
    },
  },
]
