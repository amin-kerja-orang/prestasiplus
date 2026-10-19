import type { Scenario } from '@pp/contract-tests'

import { registerStudent } from '../account/account'
import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

/**
 * Notification inbox (BE-06 part B) scenarios: list with counts, unread-count, read, delete, read-all and
 * the bulk calls with a foreign id. Notifications are created by the real account flow (a reset-ic match
 * notifies its owner, D59a), so no test-only route is needed. API target only (cookie session with CSRF).
 */
export const notificationsScenarios: Scenario[] = [
  {
    id: 'notifications-api/inbox: list, unread-count, read, read-all and delete by the owner',
    domain: 'notifications',
    targets: API_ONLY,
    async run(ctx) {
      const me = await registerStudent(ctx)
      const anon = ctx.anonymous()
      // Two reset-ic matches give the owner two notifications.
      for (let n = 0; n < 2; n++) {
        ctx.expectStatus(await anon.request('POST', '/auth/password/reset-ic', { body: { email: me.email, icNumber: '100101140077' } }), 200)
      }
      const list = await me.client.request('GET', '/me/notifications')
      ctx.expectStatus(list, 200)
      const items = listOf(list)
      ctx.check(items.length === 2, `expected 2 notifications, got ${String(items.length)}`)
      const meta = (list.body as { meta?: { counts?: { all?: number; unread?: number } } }).meta
      ctx.check(meta?.counts?.all === 2 && meta?.counts?.unread === 2, 'meta.counts differ from 2 / 2')
      const count = await me.client.request('GET', '/me/notifications/unread-count')
      ctx.expectStatus(count, 200)
      ctx.check(Object.values(dataOf(count)).includes(2), 'unread-count is not 2')

      const first = String(items[0]?.id)
      const second = String(items[1]?.id)
      const read = await me.client.request('POST', `/me/notifications/${first}/read`)
      ctx.expectStatus(read, 200)
      ctx.check(dataOf(read).success === true, 'read did not answer success')
      const readAll = await me.client.request('POST', '/me/notifications/read-all')
      ctx.expectStatus(readAll, 200)
      ctx.check(dataOf(readAll).updated === 1, 'read-all must update only the one unread item')
      const del = await me.client.request('DELETE', `/me/notifications/${second}`)
      ctx.expectStatus(del, 200)
      ctx.check(dataOf(del).success === true, 'delete did not answer { success: true } (200, not 204)')
      expectError(ctx, await me.client.request('DELETE', `/me/notifications/${second}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'notifications-api/another user id: 404 on read and delete, ignored silently by the bulk calls',
    domain: 'notifications',
    targets: API_ONLY,
    async run(ctx) {
      const owner = await registerStudent(ctx)
      const anon = ctx.anonymous()
      for (let n = 0; n < 2; n++) {
        ctx.expectStatus(await anon.request('POST', '/auth/password/reset-ic', { body: { email: owner.email, icNumber: '100101140077' } }), 200)
      }
      const mine = listOf(await owner.client.request('GET', '/me/notifications'))
      const ownA = String(mine[0]?.id)
      const ownB = String(mine[1]?.id)

      // The seeded student is another user: it must never see or touch the owner's items.
      const other = await ctx.as('student')
      expectError(ctx, await other.request('POST', `/me/notifications/${ownA}/read`), 404, 'NOT_FOUND')
      expectError(ctx, await other.request('DELETE', `/me/notifications/${ownA}`), 404, 'NOT_FOUND')
      ctx.expectStatus(await other.request('POST', '/me/notifications/bulk-read', { body: { ids: [ownA, ownB] } }), 200)
      ctx.expectStatus(await other.request('POST', '/me/notifications/bulk-delete', { body: { ids: [ownA, ownB] } }), 200)
      const still = listOf(await owner.client.request('GET', '/me/notifications'))
      ctx.check(still.length === 2 && still.every((n) => n.readAt === null || n.readAt === undefined), 'a foreign bulk call changed or deleted the owner items')

      // The owner's own bulk call with an unknown id mixed in only touches its own items.
      ctx.expectStatus(await owner.client.request('POST', '/me/notifications/bulk-read', { body: { ids: [ownA, '999999999'] } }), 200)
      expectError(ctx, await owner.client.request('POST', '/me/notifications/bulk-read', { body: { ids: [] } }), 422, 'VALIDATION_ERROR')
      ctx.expectStatus(await owner.client.request('POST', '/me/notifications/bulk-delete', { body: { ids: [ownA, ownB, '999999999'] } }), 200)
      ctx.check(listOf(await owner.client.request('GET', '/me/notifications')).length === 0, 'the owner bulk-delete did not remove both items')
    },
  },
  {
    id: 'notifications-api/anonymous is 401 and a write without CSRF is 403',
    domain: 'notifications',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      expectError(ctx, await anon.request('GET', '/me/notifications'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/me/notifications/unread-count'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('POST', '/me/notifications/read-all'), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student', { csrf: false })
      expectError(ctx, await student.request('POST', '/me/notifications/read-all'), 403, 'CSRF_INVALID')
    },
  },
]
