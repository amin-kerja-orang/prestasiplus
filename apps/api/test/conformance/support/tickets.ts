import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, errorOf, expectError, listOf } from '../helpers'

/**
 * Support tickets (BE-24 part C) scenarios: create and list as a learner, the read-only admin queue and the
 * open-count, validation copy, roles, CSRF. API target only (cookie session with CSRF).
 */
export const supportTicketScenarios: Scenario[] = [
  {
    id: 'support-api/tickets: a learner creates and lists its own, the admin queue shows them, read-only',
    domain: 'support',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const teacher = await ctx.as('teacher')
      const admin = await ctx.as('admin')

      const openBefore = Number(dataOf(await admin.request('GET', '/admin/tiket/open-count')).count)
      const created = await student.request('POST', '/tiket', { body: { subject: '  Konformans tiket  ', body: 'Butiran ujian', userId: '1' } })
      ctx.expectStatus(created, 201)
      const ticket = dataOf(created)
      ctx.check(ticket.status === 'dibuka' && ticket.statusLabel === 'Dibuka' && ticket.adminReply === null, 'a new ticket must be dibuka with no reply')
      ctx.check(ticket.subject === 'Konformans tiket', 'the subject must be trimmed')

      const mine = await student.request('GET', '/tiket')
      ctx.expectStatus(mine, 200)
      ctx.check(listOf(mine).some((r) => r.id === ticket.id), 'the learner list must hold the new ticket')
      const others = await teacher.request('GET', '/tiket')
      ctx.expectStatus(others, 200)
      ctx.check(!listOf(others).some((r) => r.id === ticket.id), 'another user must not see the ticket')

      const queue = await admin.request('GET', '/admin/tiket')
      ctx.expectStatus(queue, 200)
      const row = listOf(queue).find((r) => r.id === ticket.id)
      ctx.check(row !== undefined && row.replied === false, 'the admin queue must hold the new ticket (replied false)')
      ctx.check(row !== undefined && !('body' in row), 'a queue row must not carry the ticket body')
      ctx.expectStatus(await admin.request('GET', '/admin/tiket?status=dibuka'), 200)
      const openAfter = Number(dataOf(await admin.request('GET', '/admin/tiket/open-count')).count)
      ctx.check(openAfter === openBefore + 1, `open-count must grow by one (${String(openBefore)} to ${String(openAfter)})`)
      // read-only (D27): the contract has no write operation on the admin paths (integration spec: 404 on every write)
    },
  },
  {
    id: 'support-api/tickets: validation copy and limits',
    domain: 'support',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const empty = await student.request('POST', '/tiket', { body: {} })
      expectError(ctx, empty, 422, 'VALIDATION_ERROR')
      const fields = (errorOf(empty).fields ?? {}) as Record<string, string>
      ctx.check(fields.subject === 'Subjek diperlukan.' && fields.body === 'Butiran diperlukan.', 'required copy differs')
      const long = await student.request('POST', '/tiket', { body: { subject: 'x'.repeat(256), body: 'y'.repeat(5001) } })
      expectError(ctx, long, 422, 'VALIDATION_ERROR')
      const longFields = (errorOf(long).fields ?? {}) as Record<string, string>
      ctx.check(longFields.subject === 'Subjek tidak boleh melebihi 255 aksara.' && longFields.body === 'Butiran tidak boleh melebihi 5000 aksara.', 'too-long copy differs')
      ctx.expectStatus(await student.request('POST', '/tiket', { body: { subject: 'x'.repeat(255), body: 'y'.repeat(5000) } }), 201)
    },
  },
  {
    id: 'support-api/roles: anonymous is 401, non-admins are 403 on the queue, a missing CSRF token is 403',
    domain: 'support',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/tiket'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/tiket', { body: { subject: 'a', body: 'b' } }), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/admin/tiket'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/admin/tiket/open-count'), 401, 'UNAUTHORIZED')
      for (const role of ['student', 'teacher'] as const) {
        const who = await ctx.as(role)
        expectError(ctx, await who.request('GET', '/admin/tiket'), 403, 'FORBIDDEN')
        expectError(ctx, await who.request('GET', '/admin/tiket/open-count'), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/tiket', { body: { subject: 'a', body: 'b' } }), 403, 'CSRF_INVALID')
    },
  },
  {
    id: 'support-api/config: the support contact is public',
    domain: 'support',
    targets: API_ONLY,
    async run(ctx) {
      const res = await ctx.anonymous().request('GET', '/config/support')
      ctx.expectStatus(res, 200)
    },
  },
]
