import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * BE-13 (overview) API-only scenarios: GET /dashboard, /practice/subjects, /practice/subjects/{code},
 * /practice/chapter-subjects and /practice/chapter-subjects/{code}. Every response is also checked against the
 * contract by the runner. Deep cases (figures, locking, topic progress) are in `apps/api/test/practice-reads/overview`.
 */

const ROUTES = ['/dashboard', '/practice/subjects', '/practice/subjects/MATH', '/practice/chapter-subjects', '/practice/chapter-subjects/MATH'] as const

export const practiceReadsOverviewScenarios: Scenario[] = [
  {
    id: 'practice-reads-overview-api/anonymous is 401 on every overview route',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ROUTES) expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'practice-reads-overview-api/dashboard: any signed-in role gets its own read model',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      for (const role of ['student', 'teacher', 'admin'] as const) {
        const res = await (await ctx.as(role)).request('GET', '/dashboard')
        ctx.expectStatus(res, 200)
        const d = dataOf(res)
        ctx.check((d.user as { role?: string } | undefined)?.role === role, `the dashboard of the ${role} must carry its own role`)
        ctx.check(Array.isArray(d.subjects) && Array.isArray(d.subjectStats) && Array.isArray(d.difficultyChart), 'the dashboard lists are missing')
        ctx.check((d.difficultyChart as unknown[]).length === 5, 'the difficulty chart has five levels')
      }
    },
  },
  {
    id: 'practice-reads-overview-api/subjects: an unpaged list; the config of a known code is 200, an unknown code 404',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const list = await student.request('GET', '/practice/subjects')
      ctx.expectStatus(list, 200)
      const rows = listOf(list)
      ctx.check(rows.length > 0, 'the active subjects must be listed')
      const meta = (list.body as { meta?: { page?: number; totalPages?: number; totalItems?: number; pageSize?: number } }).meta
      ctx.check(meta?.page === 1 && meta.totalPages === 1 && meta.totalItems === rows.length && meta.pageSize === Math.max(1, rows.length), 'an unpaged list carries one page')
      const code = String(rows[0]?.code)
      const one = await student.request('GET', `/practice/subjects/${code}`)
      ctx.expectStatus(one, 200)
      ctx.check((dataOf(one).subject as { code?: string } | undefined)?.code === code, 'the config must be of the asked subject')
      const lower = await student.request('GET', `/practice/subjects/${code.toLowerCase()}`)
      ctx.expectStatus(lower, 200)
      const missing = await student.request('GET', '/practice/subjects/TIADA')
      expectError(ctx, missing, 404, 'NOT_FOUND')
      ctx.check(errorOf(missing).message === 'Rekod tidak dijumpai.', 'not-found message differs')
    },
  },
  {
    id: 'practice-reads-overview-api/chapter subjects: an unpaged list for any role; the chapter list of a known code is 200, an unknown code 404',
    domain: 'practice-reads',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const list = await teacher.request('GET', '/practice/chapter-subjects')
      ctx.expectStatus(list, 200)
      const student = await ctx.as('student')
      const detail = await student.request('GET', '/practice/chapter-subjects/MATH?levelId=999999999')
      ctx.expectStatus(detail, 200)
      const d = dataOf(detail)
      ctx.check((d.subject as { code?: string } | undefined)?.code === 'MATH', 'the chapter list must be of the asked subject')
      ctx.check(Array.isArray(d.levels) && Array.isArray(d.chapters), 'levels and chapters must be lists')
      const chapters = d.chapters as { state?: string }[]
      ctx.check(chapters.length === 0 || chapters[0]?.state === 'open', 'chapter 1 is always open')
      const missing = await student.request('GET', '/practice/chapter-subjects/TIADA')
      expectError(ctx, missing, 404, 'NOT_FOUND')
      ctx.check(errorOf(missing).message === 'Rekod tidak dijumpai.', 'not-found message differs')
    },
  },
]
