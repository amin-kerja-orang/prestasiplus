import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

const YT = 'https://www.youtube.com/watch?v=abcdefghijk'
const video = (over: Record<string, unknown> = {}) => ({ videoUrl: YT, title: 'Video conformance', category: 'tutorial', visibility: 'global', ...over })

/**
 * Videos (BE-24 part B) scenarios: visibility by school, the write rules and the CSRF / session rules. Every response is
 * checked against the contract by the runner. API target only (cookie session with CSRF).
 */
export const videosScenarios: Scenario[] = [
  {
    id: 'content-videos-api/a school video is visible to the own school and to nobody outside it',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      const created = await teacher.request('POST', '/videos', { body: video({ title: 'Video sekolah conformance', visibility: 'school' }) })
      ctx.expectStatus(created, 201)
      ctx.check((created.body as { status?: string }).status === 'Video berjaya diterbitkan.', 'create did not answer the flash text')
      const id = String(dataOf(created).id)

      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', `/videos/${id}`), 404, 'NOT_FOUND')
      const guestList = await anon.request('GET', '/videos?search=conformance')
      ctx.expectStatus(guestList, 200)
      ctx.check(!listOf(guestList).some((v) => v.id === id), 'a guest list shows a school video')

      const student = await ctx.as('student')
      ctx.expectStatus(await student.request('GET', `/videos/${id}`), 200)
      const studentList = await student.request('GET', '/videos?search=conformance')
      ctx.check(listOf(studentList).some((v) => v.id === id), 'a classmate does not see the school video')
      // Visible but not theirs: 403, not 404.
      expectError(ctx, await student.request('PUT', `/videos/${id}`, { body: video() }), 403, 'FORBIDDEN')
      expectError(ctx, await student.request('DELETE', `/videos/${id}`), 403, 'FORBIDDEN')

      const del = await teacher.request('DELETE', `/videos/${id}`)
      ctx.expectStatus(del, 200)
      ctx.check(dataOf(del).deleted === 1, 'delete did not answer { deleted: 1 }')
      expectError(ctx, await student.request('GET', `/videos/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'content-videos-api/the page shows the views before this open and the next open counts it',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const created = await admin.request('POST', '/videos', { body: video({ title: 'Video paparan conformance' }) })
      ctx.expectStatus(created, 201)
      const id = String(dataOf(created).id)
      const anon = ctx.anonymous()
      ctx.check(dataOf(await anon.request('GET', `/videos/${id}`)).views === 0, 'the first open must show 0 views')
      ctx.check(dataOf(await anon.request('GET', `/videos/${id}`)).views === 1, 'the second open must show 1 view')
      ctx.check(dataOf(await admin.request('GET', `/videos/${id}?for=edit`)).views === 2, 'for=edit must not count a view for a manager')
      ctx.check(dataOf(await admin.request('GET', `/videos/${id}?for=edit`)).views === 2, 'for=edit counted a view for a manager')
      ctx.expectStatus(await admin.request('DELETE', `/videos/${id}`), 200)
    },
  },
  {
    id: 'content-videos-api/validation, session and CSRF rules of the writes',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('POST', '/videos', { body: video() }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/videos/form-context'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('PUT', '/videos/1', { body: video() }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('DELETE', '/videos/1'), 401, 'UNAUTHORIZED')

      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/videos', { body: video() }), 403, 'CSRF_INVALID')

      const student = await ctx.as('student')
      const empty = await student.request('POST', '/videos', { body: {} })
      expectError(ctx, empty, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(empty).fields as Record<string, string> | undefined)?.title === 'Medan ini diperlukan.', 'a missing title is not "Medan ini diperlukan."')
      const extra = await student.request('POST', '/videos', { body: video({ uploaderId: '1' }) })
      expectError(ctx, extra, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(extra).fields as Record<string, string> | undefined)?.uploaderId === 'Medan ini tidak sah.', 'a client uploaderId was not refused')
      const bad = await student.request('POST', '/videos', { body: video({ videoUrl: 'javascript:alert(1)' }) })
      expectError(ctx, bad, 422, 'VALIDATION_ERROR')
      expectError(ctx, await student.request('GET', '/videos/not-an-id'), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('GET', '/videos/999999999'), 404, 'NOT_FOUND')

      // The central admin account has no school, so a school video cannot be shared.
      const admin = await ctx.as('admin')
      const noSchool = await admin.request('POST', '/videos', { body: video({ visibility: 'school' }) })
      expectError(ctx, noSchool, 422, 'VALIDATION_ERROR')
      ctx.check((errorOf(noSchool).fields as Record<string, string> | undefined)?.visibility === 'Anda tiada sekolah untuk dikongsi.', 'the no-school message differs')
      const context = await student.request('GET', '/videos/form-context')
      ctx.expectStatus(context, 200)
      ctx.check((dataOf(context).uploader as { roleLabel?: string }).roleLabel === 'Pelajar', 'form-context uploader role label is not Pelajar')
    },
  },
]
