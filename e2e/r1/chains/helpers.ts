/**
 * Shared helpers of the R1 end-to-end chain specs `e2e/r1/chains/chain-<n>.http.spec.ts` (card S9-T06,
 * AC-CHAIN-1..10, 40 section X9). Wraps the existing `@api` helpers; duplicates none of them.
 *
 * - Logins come from `../../api/helpers` (`account(role)`: seed users, password from the environment or the
 *   fixture default) and `../../fixtures/api` (`loginViaUi`, `gotoApi`, `currentSession`).
 * - Every record a chain creates is named with `ujiName(label)`: `UJI <team> <YYYY-MM-DD> <label>`. The prefix
 *   lets the designated UAT developer remove the records afterwards (U-OP-14); `isUjiRecord` is that test.
 * - Team and session come from `R1_TEAM` and `R1_SESSION` (R1-START-HERE decision 12).
 *
 * A chain-last card imports exactly these names; a missing helper is asked for on the S9-T06 issue.
 */
import type { Page } from '@playwright/test'

import { account, type Account, type ApiRole } from '../../api/helpers'
import { currentSession, gotoApi, loginViaUi } from '../../fixtures/api'

export { account, currentSession, gotoApi, loginViaUi }
export type { Account, ApiRole }

/** The prefix of every chain record (U-OP-14 removes the records that carry it). */
export const UJI_PREFIX = 'UJI '

/** The team running the chain: `R1_TEAM`, else `lokal`. */
export function r1Team(): string {
  return process.env.R1_TEAM?.trim() || 'lokal'
}

/** The session running the chain: `R1_SESSION`, else `S-0`. */
export function r1Session(): string {
  return process.env.R1_SESSION?.trim() || 'S-0'
}

/** `YYYY-MM-DD` of a date (UTC calendar day, ISO). */
function isoDay(on: Date): string {
  return on.toISOString().slice(0, 10)
}

/** The name of a chain record: `UJI <team> <YYYY-MM-DD> <label>` (date of `on`, default today). */
export function ujiName(label: string, on: Date = new Date()): string {
  return `${UJI_PREFIX}${r1Team()} ${isoDay(on)} ${label}`
}

/** True when a name belongs to a chain record (it starts with `UJI `). */
export function isUjiRecord(name: string): boolean {
  return name.startsWith(UJI_PREFIX)
}

/** Signs in as a seed role through the real login form and returns the account used. */
export async function loginAs(page: Page, role: ApiRole): Promise<Account> {
  const a = account(role)
  await loginViaUi(page, a.user, a.pass)
  return a
}
