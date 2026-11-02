import type { Scenario } from '../runner'

/**
 * `GET /admin/questions/{id}/paper-servability` (REQ-A-018, AC-04.3 / AC-04.4). The smoke scenarios skip a route with a path
 * parameter, so a route like this one was never sent to the mock, and a mock-versus-real difference in its body went unseen
 * (REQ-A-026b: the mock answered a bare list where the contract has `{ data, meta }`). These four scenarios send it to every target.
 *
 * The 200 case tries the question ids 1..30 in turn and stops at the first 200 (every answer is checked against the contract; a 404 is a
 * declared answer for a PKSK, Darjah or missing question), so it needs no id that is the same on the mock and the API. The 401 and 403 cases
 * need no real id (the role check comes before the lookup); the 404 case uses an id no target holds.
 */
const PATH = '/admin/questions/{id}/paper-servability'
const at = (id: string): string => PATH.replace('{id}', id)
const NO_SUCH_QUESTION = '999999999'
const TRIED_IDS = 30

export const paperServabilityScenarios: Scenario[] = [
  {
    id: `servability/GET ${PATH} -> 200`,
    domain: 'servability',
    async run(ctx) {
      const admin = await ctx.as('admin')
      let last = await admin.request('GET', at('1'))
      for (let id = 2; id <= TRIED_IDS && last.status !== 200; id++) last = await admin.request('GET', at(String(id)))
      ctx.expectStatus(last, 200) // records one assertion when none of the ids answered 200
    },
  },
  {
    id: `servability/GET ${PATH} unknown question -> 404`,
    domain: 'servability',
    async run(ctx) {
      ctx.expectStatus(await (await ctx.as('admin')).request('GET', at(NO_SUCH_QUESTION)), 404)
    },
  },
  {
    id: `servability/GET ${PATH} anonymous -> 401`,
    domain: 'servability',
    async run(ctx) {
      ctx.expectStatus(await ctx.anonymous().request('GET', at('1')), 401)
    },
  },
  {
    id: `servability/GET ${PATH} as student -> 403`,
    domain: 'servability',
    async run(ctx) {
      ctx.expectStatus(await (await ctx.as('student')).request('GET', at('1')), 403)
    },
  },
]
