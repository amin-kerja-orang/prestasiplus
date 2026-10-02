/**
 * Tag convention (overview §12.2, ADR-0011).
 *
 * - `@mXX` (e.g. `@m01`): the module a test belongs to. Tests traced to an SRS id start their title
 *   with that id: `'E2E-M01-03 Admin login shows loading label then lands on /admin'`.
 * - `@provisional`: the test asserts unobserved, UNVERIFIED, INFERRED or PROPOSED behaviour (the SRS
 *   §12 row says "provisional"), or depends on a harness stand-in that a module will replace.
 *   `npm run test:e2e:observed` runs `--grep-invert @provisional`; QA reports both counts at G5.
 *   Every `@provisional` test must say why, with the `provisional` annotation.
 * - `@smoke`: the global smoke suite (`e2e/global/`).
 *
 * Tags may be written in the title (`… @m01`) or with the `tag` option; `provisional(reason)` gives
 * the option form with its annotation:
 *
 * ```ts
 * test('E2E-M06-31 Generate a mock paper @m06', provisional('pending L-8'), async () => { … })
 * ```
 *
 * `scripts/check-e2e-trace.mjs` checks the ids and the `@provisional` consistency.
 */

import type { TestDetails } from '@playwright/test'

export const TAG = {
  provisional: '@provisional',
  smoke: '@smoke',
} as const

/** `@m01` … `@m26`. */
export function moduleTag(n: number): `@m${string}` {
  if (!Number.isInteger(n) || n < 1 || n > 26) throw new RangeError(`moduleTag: bad module ${n}`)
  return `@m${String(n).padStart(2, '0')}`
}

/** Test details for a provisional test: the tag plus a `provisional` annotation with the reason. */
export function provisional(reason: string, extraTags: string[] = []): TestDetails {
  if (reason.trim() === '') throw new Error('provisional(reason): say why the test is provisional')
  return {
    tag: [TAG.provisional, ...extraTags],
    annotation: { type: 'provisional', description: reason },
  }
}
