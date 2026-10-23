/**
 * The groups of BE-29 Part B, registered in `groups.ts`: catalogue (tiers, achievements, platform challenges,
 * settings), activity (completions, unlocks, referrals, SPM targets), content and operations.
 * The sources Part B reads are all on the default read list in `preflight.ts`, so no group needs `reads`.
 */
import { achievementsStep, challengesStep, settingsStep, tiersStep } from './catalogue-steps'
import type { ActivityGroup } from './context'
import { completionsStep, referralCodesStep, referralsStep, spmTargetsStep, unlocksStep } from './gamification-steps'
import { articlesStep, audioSetsStep, bannersStep, notesStep, videosStep } from './content-steps'
import { feedbackStep, ticketsStep, timelineStep } from './ops-steps'

export const catalogueGroup: ActivityGroup = {
  name: 'catalogue',
  steps: (a) => [tiersStep(a), achievementsStep(a), challengesStep(a), settingsStep(a)],
  notMigrated: [],
}

export const activityGroupB: ActivityGroup = {
  name: 'activity',
  steps: (a) => [completionsStep(a), unlocksStep(a), referralCodesStep(a), referralsStep(a), spmTargetsStep(a)],
  notMigrated: [],
}

export const contentGroup: ActivityGroup = {
  name: 'content',
  steps: (a) => [articlesStep(a), bannersStep(a), notesStep(a), videosStep(a), audioSetsStep(a)],
  notMigrated: [
    { table: 'banner image_path / audio_kbat audio_path (files)', reason: 'banner images are copied only with --files-dir (SHA256SUMS checked), else the file id stays null and the rows are counted; audio_path is never migrated (v2 keeps audio in authored sections, no staged source); articles, notes, videos and tickets have no staged file column' },
  ],
}

export const opsGroup: ActivityGroup = {
  name: 'ops',
  steps: (a) => [ticketsStep(a), timelineStep(a), feedbackStep(a)],
  notMigrated: [],
}
