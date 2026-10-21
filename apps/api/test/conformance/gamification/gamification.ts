import type { Scenario } from '@pp/contract-tests'

import { API_ONLY, dataOf, expectError, listOf, nextTag } from '../helpers'

/**
 * M14 gamification (BE-23 part A): student reads and convert, admin economy and operations. The shared smoke
 * scenarios prove each route against its contract schema; these add the authorisation matrix, the convert money
 * rule and a write round trip per admin resource. API target only (they rely on seeded data).
 */

const TIER = { labelMs: 'Perak Konformans', icon: 'x', color: '#c0c0c0', minSyiling: 500, conversionRate: 40, sortOrder: 2, quizRewardL1: 1, quizRewardL2: 2, quizRewardL3: 3, quizRewardL4: 4, quizRewardL5: 5, pkskRewardCorrect: 5, boardGameRewardCorrect: 5, boardGameRewardWin: 25 }
const CHALLENGE = { title: 'Cabaran Konformans', description: 'Selesaikan 2 kuiz', icon: 'x', challengeType: 'quiz_count', targetValue: 2, rewardSyiling: 10, rewardXp: 5, difficulty: 'easy', sortOrder: 10 }

const STUDENT_READS = ['dashboard', 'challenges', 'achievements', 'leaderboard', 'referral', 'share-cards', 'convert']
const ADMIN_READS = ['/admin/gamification/overview', '/admin/gamification/students', '/admin/gamification/transactions', '/admin/gamification/tiers', '/admin/gamification/challenges', '/admin/gamification/settings', '/admin/reward-control']
const ADMIN_WRITES: [string, string][] = [
  ['POST', '/admin/gamification/award'],
  ['POST', '/admin/gamification/challenges'],
  ['PUT', '/admin/gamification/challenges/1'],
  ['DELETE', '/admin/gamification/challenges/1'],
  ['POST', '/admin/gamification/challenges/1/toggle'],
  ['POST', '/admin/gamification/tiers'],
  ['PUT', '/admin/gamification/tiers/1'],
  ['POST', '/admin/gamification/tiers/1/toggle'],
  ['PUT', '/admin/gamification/settings'],
  ['POST', '/admin/reward-control/draws'],
  ['PUT', '/admin/reward-control/rewards/1/cost'],
  ['PUT', '/admin/reward-control/settings'],
]

export const gamificationScenarios: Scenario[] = [
  {
    id: 'gamification-api/student reads need a session, are no-store and any role may read',
    domain: 'gamification',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const p of STUDENT_READS) expectError(ctx, await anon.request('GET', `/gamification/${p}`), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student')
      for (const p of STUDENT_READS) {
        const res = await student.request('GET', `/gamification/${p}`)
        ctx.expectStatus(res, 200)
        ctx.check(/no-store/.test(String(res.headers?.['cache-control'] ?? '')), `/gamification/${p} must send Cache-Control: no-store`)
      }
      const teacher = await ctx.as('teacher')
      ctx.expectStatus(await teacher.request('GET', '/gamification/dashboard'), 200)
    },
  },
  {
    id: 'gamification-api/convert: the balance moves once by the amount, bad amounts are 422',
    domain: 'gamification',
    targets: API_ONLY,
    async run(ctx) {
      const student = await ctx.as('student')
      const view = dataOf(await student.request('GET', '/gamification/convert'))
      const rate = Number(view.conversionRate ?? view.rate)
      ctx.check(rate > 0, 'the convert view must carry a positive conversion rate')

      const res = await student.request('POST', '/gamification/convert', { body: { syilingAmount: rate * 2 + 1 } })
      ctx.expectStatus(res, 200)
      ctx.check(listOf(await student.request('GET', '/gamification/transactions?type=convert')).length > 0, 'a conversion must leave a convert ledger row')

      for (const bad of [0, -5, 1.5, 'abc', 10_000_000]) {
        expectError(ctx, await student.request('POST', '/gamification/convert', { body: { syilingAmount: bad } }), 422, 'VALIDATION_ERROR')
      }
      const anon = ctx.anonymous()
      ctx.check([401, 403].includes((await anon.request('POST', '/gamification/convert', { body: { syilingAmount: 100 } })).status), 'anonymous convert must be refused')
    },
  },
  {
    id: 'gamification-api/admin routes: anonymous 401, student 403, and writes without the CSRF header 403',
    domain: 'gamification',
    targets: API_ONLY,
    async run(ctx) {
      const anon = ctx.anonymous()
      for (const p of ADMIN_READS) expectError(ctx, await anon.request('GET', p), 401, 'UNAUTHORIZED')
      const student = await ctx.as('student')
      for (const p of ADMIN_READS) expectError(ctx, await student.request('GET', p), 403, 'FORBIDDEN')
      for (const [m, p] of ADMIN_WRITES) {
        expectError(ctx, await student.request(m as 'POST', p, { body: {} }), 403, 'FORBIDDEN')
      }
      const noCsrf = await ctx.as('admin', { csrf: false })
      for (const [m, p] of ADMIN_WRITES) {
        expectError(ctx, await noCsrf.request(m as 'POST', p, { body: {} }), 403, 'CSRF_INVALID')
      }
      const admin = await ctx.as('admin')
      for (const p of ADMIN_READS) {
        const res = await admin.request('GET', p)
        ctx.expectStatus(res, 200)
        ctx.check(/no-store/.test(String(res.headers?.['cache-control'] ?? '')), `${p} must send Cache-Control: no-store`)
      }
    },
  },
  {
    id: 'gamification-api/admin tiers and challenges: create, update, toggle and delete round trips',
    domain: 'gamification',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const tierName = nextTag('konf').toLowerCase()
      const created = await admin.request('POST', '/admin/gamification/tiers', { body: { ...TIER, tierName } })
      ctx.expectStatus(created, 201)
      const tierId = dataOf(created).id
      expectError(ctx, await admin.request('POST', '/admin/gamification/tiers', { body: { ...TIER, tierName } }), 422, 'VALIDATION_ERROR')
      const updated = await admin.request('PUT', `/admin/gamification/tiers/${String(tierId)}`, { body: { ...TIER, labelMs: 'Berubah' } })
      ctx.expectStatus(updated, 200)
      ctx.check(dataOf(updated).labelMs === 'Berubah', 'the tier label must be updated')
      const off = await admin.request('POST', `/admin/gamification/tiers/${String(tierId)}/toggle`)
      ctx.expectStatus(off, 200)
      ctx.check(dataOf(off).isActive === false, 'the first toggle must deactivate the tier')
      expectError(ctx, await admin.request('POST', '/admin/gamification/tiers/999999/toggle'), 404, 'NOT_FOUND')
      ctx.check(listOf(await admin.request('GET', '/admin/gamification/tiers')).some((t) => t.id === tierId), 'the new tier must be listed')

      const challenge = await admin.request('POST', '/admin/gamification/challenges', { body: { ...CHALLENGE, title: nextTag('Cabaran ') } })
      ctx.expectStatus(challenge, 201)
      const cid = String(dataOf(challenge).id)
      ctx.expectStatus(await admin.request('PUT', `/admin/gamification/challenges/${cid}`, { body: { ...CHALLENGE, title: nextTag('Ubah '), targetValue: 4 } }), 200)
      const toggled = await admin.request('POST', `/admin/gamification/challenges/${cid}/toggle`)
      ctx.expectStatus(toggled, 200)
      ctx.check(dataOf(toggled).isActive === false, 'the first toggle must deactivate the challenge')
      expectError(ctx, await admin.request('POST', '/admin/gamification/challenges', { body: { ...CHALLENGE, title: ' ', targetValue: 0 } }), 422, 'VALIDATION_ERROR')
      ctx.expectStatus(await admin.request('DELETE', `/admin/gamification/challenges/${cid}`), 200)
      expectError(ctx, await admin.request('DELETE', `/admin/gamification/challenges/${cid}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'gamification-api/admin award, students and transactions agree, and settings and reward control round trip',
    domain: 'gamification',
    targets: API_ONLY,
    async run(ctx) {
      const admin = await ctx.as('admin')
      const students = listOf(await admin.request('GET', '/admin/gamification/students'))
      ctx.check(students.length > 0, 'the seeded students must be listed')
      const target = students[0] as Record<string, unknown>
      const userId = String(target.userId ?? target.id)
      ctx.expectStatus(await admin.request('POST', '/admin/gamification/award', { body: { userId, amount: 5, reason: 'Ujian konformans' } }), 200)
      ctx.check(listOf(await admin.request('GET', '/admin/gamification/transactions')).length > 0, 'the award must show in the transactions list')
      expectError(ctx, await admin.request('POST', '/admin/gamification/award', { body: { userId: '999999', amount: 5, reason: 'x' } }), 404, 'NOT_FOUND')
      expectError(ctx, await admin.request('POST', '/admin/gamification/award', { body: { userId, amount: 0, reason: '' } }), 422, 'VALIDATION_ERROR')

      ctx.expectStatus(await admin.request('PUT', '/admin/gamification/settings', { body: { settings: [{ key: 'min_cash_withdrawal', value: 100 }] } }), 200)
      expectError(ctx, await admin.request('PUT', '/admin/gamification/settings', { body: {} }), 422, 'VALIDATION_ERROR')

      ctx.expectStatus(await admin.request('GET', '/admin/reward-control'), 200)
      ctx.expectStatus(await admin.request('PUT', '/admin/reward-control/settings', { body: { currentSessionYear: 2026 } }), 200)
      expectError(ctx, await admin.request('PUT', '/admin/reward-control/settings', { body: {} }), 422, 'VALIDATION_ERROR')
      const draw = await admin.request('POST', '/admin/reward-control/draws', {
        body: { title: nextTag('Cabutan '), description: 'Ujian', ticketCostSyiling: 20, maxTicketsPerStudent: 5, closesAt: '2030-12-31', prizePool: [{ label: 'A', value_sen: 100, qty: 2 }] },
      })
      ctx.expectStatus(draw, 201)
      ctx.check(dataOf(draw).status === 'draft', 'a new draw must be a draft')
      expectError(ctx, await admin.request('POST', '/admin/reward-control/draws', { body: {} }), 422, 'VALIDATION_ERROR')
      expectError(ctx, await admin.request('PUT', '/admin/reward-control/rewards/999999/cost', { body: { costValueSen: 100 } }), 404, 'NOT_FOUND')
    },
  },
]
