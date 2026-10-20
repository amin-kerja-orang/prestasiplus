import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

const post = (over: Record<string, unknown> = {}) => ({ title: 'Perutusan conformance', body: '<p>Isi.</p>', status: 'published', ...over })

/**
 * Perutusan (BE-24 part B) scenarios: who may write, the visibility rules, reads, reactions, comments and the public page.
 * The body is JSON here (the conformance client sends one file part and no fields; the endpoint also takes JSON, the
 * multipart upload is covered by the integration suite). API target only (cookie session with CSRF).
 */
export const perutusanScenarios: Scenario[] = [
  {
    id: 'content-perutusan-api/only admin and school admin write; the rest are 403 (401 without a session, 403 CSRF without a token)',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      expectError(ctx, await ctx.anonymous().request('POST', '/perutusan', { body: post() }), 401, 'UNAUTHORIZED')
      for (const role of ['student', 'teacher'] as const) {
        expectError(ctx, await (await ctx.as(role)).request('POST', '/perutusan', { body: post() }), 403, 'FORBIDDEN')
      }
      expectError(ctx, await (await ctx.as('admin', { csrf: false })).request('POST', '/perutusan', { body: post() }), 403, 'CSRF_INVALID')
      const student = await ctx.as('student')
      const ctxStudent = await student.request('GET', '/perutusan/compose-context')
      ctx.expectStatus(ctxStudent, 200)
      ctx.check(dataOf(ctxStudent).canWrite === false && dataOf(ctxStudent).scope === null, 'a student can write according to compose-context')
      const admin = await (await ctx.as('admin')).request('GET', '/perutusan/compose-context')
      ctx.check(dataOf(admin).scope === 'national' && dataOf(admin).canWrite === true, 'admin compose-context is not national')
    },
  },
  {
    id: 'content-perutusan-api/a national post: feed, page with the read count, reactions, comments and the public page',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const created = await admin.request('POST', '/perutusan', { body: post({ title: 'Kebangsaan conformance', isPublic: true, body: '<p>Halo</p><script>alert(1)</script>' }) })
      ctx.expectStatus(created, 201)
      ctx.check((created.body as { status?: string }).status === 'Perutusan berjaya dihantar.', 'the flash differs')
      const id = String(dataOf(created).id)
      ctx.check(!String(dataOf(created).body).includes('script'), 'the stored body kept a script tag')

      const student = await ctx.as('student')
      const feed = await student.request('GET', '/perutusan')
      ctx.expectStatus(feed, 200)
      ctx.check(listOf(feed).some((p) => p.id === id), 'the student feed misses a national post')

      const first = await student.request('GET', `/perutusan/${id}`)
      ctx.expectStatus(first, 200)
      ctx.check(dataOf(first).reads === 1, 'the first open must count one read (including this open)')
      ctx.check(dataOf(await student.request('GET', `/perutusan/${id}`)).reads === 1, 'a repeat open counted again')

      const on = await student.request('POST', `/perutusan/${id}/reactions`, { body: { type: 'like' } })
      ctx.expectStatus(on, 200)
      ctx.check(JSON.stringify(dataOf(on).myReactions) === '["like"]', 'the reaction was not recorded')
      const off = await student.request('POST', `/perutusan/${id}/reactions`, { body: { type: 'like' } })
      ctx.check(JSON.stringify(dataOf(off).myReactions) === '[]', 'the second like did not remove the reaction')

      const comment = await student.request('POST', `/perutusan/${id}/comments`, { body: { body: 'Terima kasih.' } })
      ctx.expectStatus(comment, 201)
      ctx.check(dataOf(comment).status === 'pending', 'a comment must start pending')
      ctx.check(dataOf(await student.request('GET', `/perutusan/${id}`)).commentCount === 0, 'a pending comment is counted')

      const pub = await ctx.anonymous().request('GET', `/public/perutusan/${id}`)
      ctx.expectStatus(pub, 200)
      ctx.check(dataOf(pub).title === 'Kebangsaan conformance', 'the public page shows another post')
    },
  },
  {
    id: 'content-perutusan-api/drafts: only the author and an admin open them; nobody sees them in the feed; the public page hides them',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const schoolAdmin = await ctx.as('school_admin')
      const draft = await schoolAdmin.request('POST', '/perutusan', { body: post({ status: 'draft', title: 'Draf conformance', isPublic: true }) })
      ctx.expectStatus(draft, 201)
      ctx.check((draft.body as { status?: string }).status === 'Draf perutusan disimpan.', 'the draft flash differs')
      const id = String(dataOf(draft).id)
      ctx.check(String(dataOf(draft).scopeLabel).length > 0 && dataOf(draft).scopeLabel !== 'Seluruh Malaysia (Kebangsaan)', 'a school admin post is not school scoped')

      ctx.expectStatus(await schoolAdmin.request('GET', `/perutusan/${id}`), 200)
      ctx.expectStatus(await (await ctx.as('admin')).request('GET', `/perutusan/${id}`), 200)
      const student = await ctx.as('student')
      expectError(ctx, await student.request('GET', `/perutusan/${id}`), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('POST', `/perutusan/${id}/reactions`, { body: { type: 'like' } }), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('POST', `/perutusan/${id}/comments`, { body: { body: 'Hai' } }), 404, 'NOT_FOUND')
      ctx.check(!listOf(await schoolAdmin.request('GET', '/perutusan')).some((p) => p.id === id), 'a draft is in the feed')
      ctx.check(listOf(await schoolAdmin.request('GET', '/perutusan/mine')).some((p) => p.id === id), 'the author does not see the draft in "mine"')
      expectError(ctx, await ctx.anonymous().request('GET', `/public/perutusan/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'content-perutusan-api/validation: required fields, unknown keys, the scheduled time, the comment length, the id',
    domain: 'content',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const fieldsOf = (res: { body: unknown }) => (errorOf(res as Parameters<typeof errorOf>[0]).fields ?? {}) as Record<string, string>
      const empty = await admin.request('POST', '/perutusan', { body: {} })
      expectError(ctx, empty, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(empty).title === 'Medan ini diperlukan.' && fieldsOf(empty).status === 'Medan ini diperlukan.', 'required messages differ')
      const extra = await admin.request('POST', '/perutusan', { body: post({ authorId: '1' }) })
      expectError(ctx, extra, 422, 'VALIDATION_ERROR')
      ctx.check(fieldsOf(extra).authorId === 'Medan ini tidak sah.', 'a client authorId was not refused')
      expectError(ctx, await admin.request('POST', '/perutusan', { body: post({ status: 'scheduled', scheduledAt: '2020-01-01T10:00' }) }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('POST', '/perutusan', { body: post({ status: 'scheduled' }) }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('POST', '/perutusan', { body: post({ youtubeUrl: 'https://vimeo.com/1' }) }), 422, 'VALIDATION_ERROR')

      const created = await admin.request('POST', '/perutusan', { body: post({ title: 'Untuk komen' }) })
      const id = String(dataOf(created).id)
      const student = await ctx.as('student')
      expectError(ctx, await student.request('POST', `/perutusan/${id}/comments`, { body: {} }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await student.request('POST', `/perutusan/${id}/comments`, { body: { body: 'x'.repeat(1001) } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await student.request('POST', `/perutusan/${id}/reactions`, { body: { type: 'angry' } }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await student.request('GET', '/perutusan/not-an-id'), 404, 'NOT_FOUND')
      expectError(ctx, await student.request('GET', '/perutusan/999999999'), 404, 'NOT_FOUND')
      expectError(ctx, await ctx.anonymous().request('GET', '/public/perutusan/999999999'), 404, 'NOT_FOUND')
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', `/perutusan/${id}/reactions`, { body: { type: 'like' } }), 403, 'CSRF_INVALID')
      expectError(ctx, await noCsrf.request('POST', `/perutusan/${id}/comments`, { body: { body: 'Hai' } }), 403, 'CSRF_INVALID')
    },
  },
]
