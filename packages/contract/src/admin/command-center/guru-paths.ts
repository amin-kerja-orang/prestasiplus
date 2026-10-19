import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../../zod'
import { ErrorBodySchema } from '../../common/error'
import * as g from './guru'

/** Components contributed by BE-22 (guru half); keys equal the `.meta({ id })` ids. */
export const COMMAND_CENTER_GURU_COMPONENT_SCHEMAS = {
  CommandCenterGuruEducationLevel: g.CommandCenterGuruEducationLevelSchema,
  CommandCenterGuruClassRow: g.CommandCenterGuruClassRowSchema,
  CommandCenterGuruStudentRank: g.CommandCenterGuruStudentRankSchema,
  CommandCenterGuruFeedItem: g.CommandCenterGuruFeedItemSchema,
  CommandCenterGuruRecentBadge: g.CommandCenterGuruRecentBadgeSchema,
  CommandCenterGuruEngagement: g.CommandCenterGuruEngagementSchema,
  CommandCenterGuruMood: g.CommandCenterGuruMoodSchema,
  CommandCenterGuruLiveData: g.CommandCenterGuruLiveDataSchema,
  CommandCenterGuruDrillType: g.CommandCenterGuruDrillTypeSchema,
  CommandCenterGuruDrillQuery: g.CommandCenterGuruDrillQuerySchema,
  CommandCenterGuruDrillStudentRow: g.CommandCenterGuruDrillStudentRowSchema,
  CommandCenterGuruDrillTodayRow: g.CommandCenterGuruDrillTodayRowSchema,
  CommandCenterGuruDrillSubjectRow: g.CommandCenterGuruDrillSubjectRowSchema,
  CommandCenterGuruDrillGpsRow: g.CommandCenterGuruDrillGpsRowSchema,
  CommandCenterGuruDrillKirkRow: g.CommandCenterGuruDrillKirkRowSchema,
  CommandCenterGuruMoodName: g.CommandCenterGuruMoodNameSchema,
  CommandCenterGuruDrillMoodRow: g.CommandCenterGuruDrillMoodRowSchema,
  CommandCenterGuruEngagementBand: g.CommandCenterGuruEngagementBandSchema,
  CommandCenterGuruDrillEngagementRow: g.CommandCenterGuruDrillEngagementRowSchema,
  CommandCenterGuruDrillVs: g.CommandCenterGuruDrillVsSchema,
  CommandCenterGuruDrillRow: g.CommandCenterGuruDrillRowSchema,
  CommandCenterGuruDrill: g.CommandCenterGuruDrillSchema,
  CommandCenterGuruRisk: g.CommandCenterGuruRiskSchema,
  CommandCenterGuruTrendLabel: g.CommandCenterGuruTrendLabelSchema,
  CommandCenterGuruGrade: g.CommandCenterGuruGradeSchema,
  CommandCenterGuruPrediction: g.CommandCenterGuruPredictionSchema,
  CommandCenterGuruPredictive: g.CommandCenterGuruPredictiveSchema,
  CommandCenterGuruEvaluationRisk: g.CommandCenterGuruEvaluationRiskSchema,
  CommandCenterGuruEvaluationAlert: g.CommandCenterGuruEvaluationAlertSchema,
  CommandCenterGuruEvaluation: g.CommandCenterGuruEvaluationSchema,
  CommandCenterGuruBadgeStat: g.CommandCenterGuruBadgeStatSchema,
  CommandCenterGuruNewAward: g.CommandCenterGuruNewAwardSchema,
  CommandCenterGuruAchievements: g.CommandCenterGuruAchievementsSchema,
  CommandCenterGuruBadgeHoldersQuery: g.CommandCenterGuruBadgeHoldersQuerySchema,
  CommandCenterGuruBadgeHolders: g.CommandCenterGuruBadgeHoldersSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const FORBIDDEN = err(
  'FORBIDDEN "This action is unauthorized." (role is not teacher or admin; school_admin gets 403 here).',
)
const BASE = '/guru/command-center'
const COMMON =
  "Roles teacher and admin. Scope: the viewer's own students (distinct students with an active enrolment in an active class the viewer owns); admin sees only its own (normally empty) classes. The body is bare (no `{ data }` envelope). GET only, polling-friendly."

/** Registers the six teacher Command Center read routes (BE-22, guru half). */
export function registerCommandCenterGuruPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: `${BASE}/live-data`,
    tags: ['command-center-guru'],
    summary: 'Command Center live tiles and panels (polled every 10 s)',
    description: `${COMMON} Each count has a formatted string and a \`...Raw\` number. MYT day windows: week = 7 calendar days ending today.`,
    responses: {
      200: json(g.CommandCenterGuruLiveDataSchema, 'Live data.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: `${BASE}/drill`,
    tags: ['command-center-guru'],
    summary: 'Drill-down table behind a tile or panel',
    description: `${COMMON} Row shape depends on \`type\`; kirk t2-t4 return an empty \`students\` plus \`extra\` and \`vsLabel\`.`,
    request: { query: g.CommandCenterGuruDrillQuerySchema },
    responses: {
      200: json(g.CommandCenterGuruDrillSchema, 'Title and rows.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      422: err(
        'VALIDATION_ERROR with fields.type "Jenis drill tidak sah." or fields.filter "Penapis tidak sah."; message = the same text.',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: `${BASE}/evaluate`,
    tags: ['command-center-guru'],
    summary: 'Risk evaluation alerts (read-only)',
    description: `${COMMON} Alerts: inactive >= 7 days, accuracy < 40%, trend < -10.`,
    responses: {
      200: json(g.CommandCenterGuruEvaluationSchema, 'Summary and alerts.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: `${BASE}/predictive`,
    tags: ['command-center-guru'],
    summary: 'Predicted SPM grade per student',
    description: `${COMMON} Students with at least 10 answers only.`,
    responses: {
      200: json(g.CommandCenterGuruPredictiveSchema, 'Predictions and aggregates.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: `${BASE}/achievements`,
    tags: ['command-center-guru'],
    summary: "Badge statistics of the viewer's students (read-only)",
    description: `${COMMON} Nothing is awarded on GET.`,
    responses: {
      200: json(g.CommandCenterGuruAchievementsSchema, 'Achievements panel.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
    },
  })

  registry.registerPath({
    method: 'get',
    path: `${BASE}/badge-holders`,
    tags: ['command-center-guru'],
    summary: "Holders of one badge among the viewer's students",
    description: COMMON,
    request: { query: g.CommandCenterGuruBadgeHoldersQuerySchema },
    responses: {
      200: json(g.CommandCenterGuruBadgeHoldersSchema, 'Badge and holders.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN,
      404: err('NOT_FOUND "Lencana tidak dijumpai." (unknown badge).'),
      422: err('VALIDATION_ERROR fields.badgeId "Lencana tidak sah." (missing or not an integer >= 1).'),
    },
  })
}
