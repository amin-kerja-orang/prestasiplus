import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'

/**
 * API-GUR-21 teacher weekly class report (S6-T01). One canonical route; the legacy
 * `GET /weekly-report` (API-RPT-13) stays 403 for every role. Role code `teacher` only (an admin
 * has no classes, D115); another teacher's class is 403 (AC-GUR-43-6).
 */

const isRealDate = (s: string): boolean => {
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m! - 1 && dt.getUTCDate() === d
}
const oneDecimal = (v: number): boolean => Math.round(v * 10) / 10 === v

const count = z.number().int().min(0)
const accuracy = z
  .number()
  .min(0)
  .max(100)
  .refine(oneDecimal, { message: 'At most one decimal.' })
  .meta({
    description:
      'Pooled correct / answered x 100 over all modes of practice_answers (XS-8), ONE decimal at most on the wire (a value with no fraction has none: 100, not 100.0). The screen shows the whole number rounded half up (4.6, D-T10-1).',
  })

export const GuruWeeklyReportQuerySchema = z
  .object({
    classroomId: IdSchema,
    week: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine(isRealDate, { message: 'Not a real calendar date.' })
      .optional()
      .meta({
        description:
          'Any date YYYY-MM-DD inside the wanted week; the report covers Monday 00:00 to Sunday 23:59 MYT containing it. Default: the current week.',
      }),
  })
  .strict()
  .meta({ id: 'GuruWeeklyReportQuery' })
export type GuruWeeklyReportQuery = z.infer<typeof GuruWeeklyReportQuerySchema>

export const GuruWeeklyReportSchema = z
  .object({
    classroom: z.object({ id: IdSchema, name: z.string() }),
    week: z
      .object({
        from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).meta({ description: 'Monday, YYYY-MM-DD.' }),
        to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).meta({ description: 'Sunday, YYYY-MM-DD.' }),
        label: z.string().meta({ example: '02 Nov 2026 — 08 Nov 2026' }),
      })
      .meta({
        description:
          'Monday 00:00 to Sunday 23:59 MYT of the week containing the requested date (default: current week). The previous week is the 7 days before.',
      }),
    summary: z.object({
      answered: count.meta({ description: 'Answers of the class in the week, all modes of practice_answers (XS-8).' }),
      activePupils: count.meta({ description: 'Class pupils with >= 1 answer in the week (XS-2).' }),
      improvedPupils: count.meta({ description: 'Count of ALL pupils that qualify for mostImproved, not only the 5 listed.' }),
      attentionSubjects: count.meta({ description: 'Length of attentionSubjects.' }),
    }),
    topPerformers: z
      .array(
        z.object({
          rank: z.number().int().min(1),
          name: z.string(),
          answered: count,
          accuracy,
        }),
      )
      .max(5)
      .meta({
        description:
          'Pupils with answered >= 5, sorted by whole-number accuracy desc, ties answered desc then name; max 5.',
      }),
    mostImproved: z
      .array(
        z.object({
          name: z.string(),
          previousAccuracy: accuracy,
          accuracy,
          delta: z.number().int().meta({ description: 'whole(accuracy) - whole(previousAccuracy); the shown "+{delta}%".' }),
        }),
      )
      .max(5)
      .meta({
        description:
          'Pupils with answers in both weeks and delta > 0, delta desc, ties by name; max 5. summary.improvedPupils counts all of them.',
      }),
    attentionSubjects: z
      .array(z.object({ subject: z.string(), accuracy, answered: count }))
      .meta({ description: 'Subjects whose whole-number weekly accuracy is < 50, ascending by accuracy.' }),
  })
  .meta({ id: 'GuruWeeklyReport' })
export type GuruWeeklyReport = z.infer<typeof GuruWeeklyReportSchema>

export const GuruWeeklyReportResponseSchema = envelopeOf(GuruWeeklyReportSchema)

/** Components contributed by S6-T01, spread into COMPONENT_SCHEMAS in openapi.ts. */
export const GURU_WEEKLY_REPORT_COMPONENT_SCHEMAS = {
  GuruWeeklyReportQuery: GuruWeeklyReportQuerySchema,
  GuruWeeklyReport: GuruWeeklyReportSchema,
} as const

const err = (description: string) => ({
  description,
  content: { 'application/json': { schema: ErrorBodySchema } },
})

export function registerGuruWeeklyReportPaths(registry: OpenAPIRegistry): void {
  registry.registerPath({
    method: 'get',
    path: '/guru/weekly-report',
    tags: ['performance'],
    summary: 'Teacher weekly class report (API-GUR-21)',
    description:
      'Role teacher only; own classes only. Pupil names are those of the own class. Accuracy fields carry at most one decimal.',
    request: { query: GuruWeeklyReportQuerySchema },
    responses: {
      200: {
        description: 'Weekly report.',
        headers: { 'Cache-Control': { description: 'no-store: holds pupil names.', schema: { type: 'string' as const, example: 'no-store' } } },
        content: { 'application/json': { schema: GuruWeeklyReportResponseSchema } },
      },
      401: err('UNAUTHORIZED: no valid session.'),
      403: err('FORBIDDEN: not a teacher, or the class belongs to another teacher (AC-GUR-43-6).'),
      422: err('VALIDATION_ERROR: classroomId missing, or week malformed.'),
    },
  })
}
