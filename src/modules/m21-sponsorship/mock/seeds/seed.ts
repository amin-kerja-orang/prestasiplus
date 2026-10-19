/**
 * M21 seed (SRS M21 v1.2 §6.11). M21-T1 loads the six observed sponsors (A). The anak-angkat record
 * (B) and the three applications (C) need the users 5231-5234 and 5412 that M02 does not have yet
 * (XR-M21-01); they are loaded by M21-T3, so both stores start empty.
 * `finalise` checks the named-query seed values and stops the boot on a mismatch.
 */

import type { SeedContext } from '@/mock/define'

import { resetMailLog } from '../mail-log'
import { anakAngkatRepo } from '../repository/anak-angkat'
import { bindM21Clock } from '../repository/clock'
import { fosterApplicationsRepo } from '../repository/foster-applications'
import { sponsorsRepo } from '../repository/sponsors'
import { SPONSORS } from './sponsors-data'

export function seedSponsorship(ctx: SeedContext): void {
  bindM21Clock(ctx.clock)
  // The recorded notice log is module state: a boot / reset never inherits it.
  resetMailLog()
  sponsorsRepo.seed(SPONSORS)
}

export function checkSeed(): void {
  const issues: string[] = []
  const expectCount = (label: string, got: number, want: number) => {
    if (got !== want) issues.push(`${label}: ${String(got)} instead of ${String(want)}`)
  }
  // Q-M17-SPONSORS / Q-M21-SPONSOR-STATS (M21 §6.8): 6 / 0 / 0 / 0 / 6.
  expectCount('Q-M17-SPONSORS', sponsorsRepo.count('Q-M17-SPONSORS'), 6)
  expectCount('Q-M17-SPONSORS APPROVED', sponsorsRepo.count('Q-M17-SPONSORS', 'APPROVED'), 0)
  expectCount('Q-M17-SPONSORS PENDING', sponsorsRepo.count('Q-M17-SPONSORS', 'PENDING'), 0)
  expectCount('Q-M17-SPONSORS REJECTED', sponsorsRepo.count('Q-M17-SPONSORS', 'REJECTED'), 0)
  expectCount('Q-M17-SPONSORS SUSPENDED', sponsorsRepo.count('Q-M17-SPONSORS', 'SUSPENDED'), 6)
  // The T3 seeds are not loaded yet.
  expectCount('anakAngkat (T3 seed deferred)', anakAngkatRepo.tabs().all, 0)
  expectCount(
    'fosterApplications (T3 seed deferred)',
    fosterApplicationsRepo.count('Q-M21-APP-TABS'),
    0,
  )
  if (issues.length > 0) {
    throw new Error(`M21 store build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`)
  }
}
