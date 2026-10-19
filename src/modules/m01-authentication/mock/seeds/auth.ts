/**
 * M01-T1 seed (SRS M01 §6.8): the two demo password-reset tokens. Runs in the M01 seed phase, with
 * the seed clock. (The users, their secrets and the settings defaults need no seed rows: the
 * canonical accounts are anchors of the F-23 users dataset, and a user without a settings row reads
 * the BR-17 defaults.)
 */

import type { SeedContext } from '@/mock/define'

import { passwordResetsRepo } from '../handlers/auth-state'

/**
 * MOCK AND DEMO ONLY (security L5): seeds well-known reset tokens (and the accounts use the demo
 * password `DEMO_PASSWORD`). None of this may go into real-backend fixtures or seeds.
 */
export function seedAuth(ctx: SeedContext): void {
  passwordResetsRepo.seedDemo(ctx.clock.now())
}
