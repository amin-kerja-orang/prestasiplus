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
import { questionSetsStep } from './question-set-steps'

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
  steps: (a) => [articlesStep(a), bannersStep(a), notesStep(a), videosStep(a), audioSetsStep(a), questionSetsStep(a)],
  notMigrated: [
    { table: 'banner / article / audio file paths (image_path, audio_path)', reason: 'file migration is off (Q2): file ids stay null; the rows that had a path are counted in the report notes' },
  ],
}

export const opsGroup: ActivityGroup = {
  name: 'ops',
  steps: (a) => [ticketsStep(a), timelineStep(a), feedbackStep(a)],
  notMigrated: [],
}
