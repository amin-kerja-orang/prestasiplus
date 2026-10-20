import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf } from '../helpers'

/**
 * Wallet reads (BE-11): own wallet, own ledger and the app shell chips, against the seeded demo accounts
 * (pelajar has a wallet and a ledger; the teacher has none and reads the defaults). The shared smoke
 * scenarios already prove each route against its contract schema; these add the cross-route agreement
 * and the ownership rules. API target only (they rely on seeded data).
 */
export const walletScenarios: Scenario[] = [
  {
    id: 'wallet-api/wallet, ledger and chips agree for the signed-in student and every row is the caller own',
    domain: 'wallet',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const wallet = await student.request('GET', '/gamification/wallet')
      ctx.expectStatus(wallet, 200)
      const w = dataOf(wallet)
      const tx = await student.request('GET', '/gamification/transactions')
      ctx.expectStatus(tx, 200)
      const rows = listOf(tx)
      ctx.check(rows.length > 0, 'the seeded student must have ledger rows')

      const meta = (tx.body as { meta?: { currentSyiling?: number; type?: string } }).meta
      ctx.check(meta?.currentSyiling === w.currentSyiling, 'transactions meta.currentSyiling differs from the wallet')
      ctx.check(meta?.type === '', 'meta.type must echo an absent filter as an empty string')
      ctx.check(!('page' in (meta ?? {})) && !('total' in (meta ?? {})), 'the ledger list is not paginated (no page keys in meta)')

      // Newest first, and the newest row carries the running balance of the wallet.
      const times = rows.map((r) => Date.parse(String(r.createdAt)))
      ctx.check(times.every((t, i) => i === 0 || (times[i - 1] as number) >= t), 'ledger rows are not newest first')
      ctx.check(rows[0]?.balanceAfter === w.currentSyiling, 'the newest row balanceAfter differs from the wallet balance')
      ctx.check(rows.every((r) => !('sourceId' in r) && !('userId' in r) && !('legacyId' in r)), 'internal columns leaked into a ledger row')

      const chips = await student.request('GET', '/me/gamification-summary')
      ctx.expectStatus(chips, 200)
      const c = dataOf(chips)
      const streak = w.streak as { current?: number }
      ctx.check(c.coins === w.currentSyiling && c.points === w.xp && c.streakDays === streak.current, 'chips differ from the wallet (coins, points, streakDays)')
    },
  },
  {
    id: 'wallet-api/type filter: a known type narrows the list, an unknown type is an empty list and not an error',
    domain: 'wallet',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const earn = await student.request('GET', '/gamification/transactions?type=earn')
      ctx.expectStatus(earn, 200)
      const earnRows = listOf(earn)
      ctx.check(earnRows.length > 0 && earnRows.every((r) => r.type === 'earn'), 'type=earn must return only earn rows')
      ctx.check((earn.body as { meta?: { type?: string } }).meta?.type === 'earn', 'meta.type must echo the filter')

      const spend = await student.request('GET', '/gamification/transactions?type=spend')
      ctx.expectStatus(spend, 200)
      ctx.check(listOf(spend).every((r) => r.type === 'spend'), 'type=spend returned a row of another type')

      const unknown = await student.request('GET', '/gamification/transactions?type=nonsense')
      ctx.expectStatus(unknown, 200)
      ctx.check(listOf(unknown).length === 0, 'an unknown type must return an empty list')
      const all = listOf(await student.request('GET', '/gamification/transactions?type='))
      ctx.check(all.length === listOf(await student.request('GET', '/gamification/transactions')).length, 'an empty type must mean all rows')
    },
  },
  {
    id: 'wallet-api/a user without a wallet reads the defaults, and a read creates nothing',
    domain: 'wallet',
    targets: API_ONLY,
    async run(ctx) {
      const teacher = await ctx.as('teacher')
      for (let n = 0; n < 2; n++) {
        const wallet = await teacher.request('GET', '/gamification/wallet')
        ctx.expectStatus(wallet, 200)
        const w = dataOf(wallet)
        const streak = w.streak as { current?: number; best?: number; multiplier?: number }
        ctx.check(w.currentSyiling === 0 && w.totalSyilingEarned === 0 && w.xp === 0 && w.level === 1, 'a user without a wallet must read 0 syiling, 0 xp, level 1')
        ctx.check(streak.current === 0 && streak.best === 0 && streak.multiplier === 1, 'a user without a streak must read 0 / 0 / 1')
      }
      const tx = await teacher.request('GET', '/gamification/transactions')
      ctx.expectStatus(tx, 200)
      ctx.check(listOf(tx).length === 0, 'a user without a ledger must read an empty list')
      const chips = await teacher.request('GET', '/me/gamification-summary')
      ctx.expectStatus(chips, 200)
      const c = dataOf(chips)
      ctx.check(c.coins === 0 && c.points === 0 && c.streakDays === 0, 'chips of a user without rows must be 0 / 0 / 0')
    },
  },
  {
    id: 'wallet-api/another user wallet cannot be asked for: an id parameter is ignored and each role reads its own',
    domain: 'wallet',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const admin = await ctx.as('admin')
      const own = dataOf(await student.request('GET', '/gamification/wallet'))
      const spoof = dataOf(await student.request('GET', `/gamification/wallet?userId=${String(dataOf(await admin.request('GET', '/gamification/wallet')).userId)}`))
      ctx.check(spoof.userId === own.userId, 'a userId query parameter must not change whose wallet is read')
      const adminWallet = dataOf(await admin.request('GET', '/gamification/wallet'))
      ctx.check(adminWallet.userId !== own.userId, 'two accounts must not read the same wallet')
      const adminRows = listOf(await admin.request('GET', '/gamification/transactions'))
      const studentRows = listOf(await student.request('GET', '/gamification/transactions'))
      const adminIds = new Set(adminRows.map((r) => String(r.id)))
      ctx.check(studentRows.every((r) => !adminIds.has(String(r.id))), 'a ledger row appears in two users ledgers')
    },
  },
  {
    id: 'wallet-api/anonymous is 401 on all three routes and the answers are not cacheable',
    domain: 'wallet',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const path of ['/gamification/wallet', '/gamification/transactions', '/me/gamification-summary']) {
        expectError(ctx, await anon.request('GET', path), 401, 'UNAUTHORIZED')
      }
      const student = await ctx.as('student')
      for (const path of ['/gamification/wallet', '/gamification/transactions', '/me/gamification-summary']) {
        const res = await student.request('GET', path)
        ctx.expectStatus(res, 200)
        ctx.check(/no-store/.test(String(res.headers?.['cache-control'] ?? '')), `${path} must send Cache-Control: no-store`)
      }
    },
  },
]
