/**
 * Documented display constants of M10 (D11 exception, overview §6.6; SRS M10 §6.10 DATA-M10-11
 * `TeacherDashboardSnapshot`): observed admin figures that no definition over the owners' stores
 * reproduces. They are excluded from the dataset fit check and never sit next to a contradicting
 * computed figure (S1 and S2 are different screens from S21, which computes 16,817 from M04).
 *
 * Alternatives considered (SRS §6.10): computing S1 from Q-CONTRIB + structured gives 20,881, not the
 * observed 20,719 / 19,361; showing S21's 16,817 on S1 would change two observed values.
 *
 * Only the admin (user 1) has a snapshot row; every other viewer's values are computed.
 */

import { defineDisplayConstant } from '@/mock/dataset/display-constants'

/** The admin account the observed snapshot belongs to (M01 canonical account 1). */
export const SNAPSHOT_USER_ID = 1

/** S1 "Soalan" of the admin (DV-M10-12; definition UNVERIFIED). */
export const ADMIN_DASHBOARD_QUESTIONS = defineDisplayConstant({
  module: 'M10',
  name: 'adminDashboardQuestions',
  value: 20719,
  dv: 'DV-M10-12',
  shownOn: ['S1'],
  note: 'Observed on live; equals the M14 questionsCount of the admin (XR-M14-04 b).',
})

/** S1 "diluluskan" of the admin (DV-M10-12; definition UNVERIFIED). */
export const ADMIN_DASHBOARD_QUESTIONS_APPROVED = defineDisplayConstant({
  module: 'M10',
  name: 'adminDashboardQuestionsApproved',
  value: 19361,
  dv: 'DV-M10-12',
  shownOn: ['S1'],
})

/** S2 `gpsOverall` of the admin (BR-M10-08; definition UNVERIFIED). Used by M10-T3. */
export const ADMIN_COMMAND_CENTER_GPS = defineDisplayConstant({
  module: 'M10',
  name: 'adminCommandCenterGps',
  value: 4.69,
  dv: 'DV-M10-12',
  shownOn: ['S2'],
})

/** Every M10 display constant, listed once for the unit test and for reviewers. */
export const M10_DISPLAY_CONSTANTS = [
  ADMIN_DASHBOARD_QUESTIONS,
  ADMIN_DASHBOARD_QUESTIONS_APPROVED,
  ADMIN_COMMAND_CENTER_GPS,
] as const
