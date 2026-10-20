import type { Scenario } from '../runner'

/**
 * Auth and session smoke (BE-31). The full BE-03 set (throttle, role switch, Mod Pelajar, missing
 * CSRF) is added by BE-03 to this folder; these five only prove the harness path
 * login -> session -> logout against the contract.
 */
export const authScenarios: Scenario[] = [
  {
    id: 'auth/POST /auth/login -> 200',
    domain: 'auth',
    async run(ctx) {
      const res = await ctx.anonymous().request('POST', '/auth/login', {
        body: { ...ctx.credentials('student'), remember: false },
      })
      ctx.expectStatus(res, 200)
    },
  },
  {
    id: 'auth/POST /auth/login wrong password -> 401',
    domain: 'auth',
    async run(ctx) {
      const res = await ctx.anonymous().request('POST', '/auth/login', {
        body: { identifier: ctx.credentials('student').identifier, password: 'not-the-password' },
      })
      ctx.expectStatus(res, 401)
    },
  },
  {
    id: 'auth/GET /session anonymous -> 401',
    domain: 'auth',
    async run(ctx) {
      ctx.expectStatus(await ctx.anonymous().request('GET', '/session'), 401)
    },
  },
  {
    id: 'auth/GET /session as student -> 200',
    domain: 'auth',
    async run(ctx) {
      const student = await ctx.as('student')
      ctx.expectStatus(await student.request('GET', '/session'), 200)
    },
  },
  {
    id: 'auth/POST /auth/logout -> 204',
    domain: 'auth',
    async run(ctx) {
      const admin = await ctx.as('admin')
      ctx.expectStatus(await admin.request('POST', '/auth/logout'), 204)
    },
  },
]
