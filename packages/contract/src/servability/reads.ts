import { z } from '../zod'
import { IdSchema } from '../common/ids'
import {
  SERVABILITY_ACTIVITIES,
  ServabilityActivitySchema,
  ServabilityReasonCodeSchema,
  ServabilityReasonSchema,
  ServabilityReportSchema,
} from './schema'

/**
 * R1-B11 (T30): shapes of the admin servability reads ("Dilihat murid di", hub cards, lanes S5.1 and S5.2). Read-only; the copy
 * (reason sentences, activity labels) stays in `./schema`.
 */

/** Most ids one batch read accepts (a hub page, a paper). */
export const SERVABILITY_BATCH_MAX = 100

export const ServabilityBatchRequestSchema = z
  .strictObject({
    ids: z
      .array(IdSchema)
      .min(1, 'Sila pilih sekurang-kurangnya satu soalan.')
      .max(SERVABILITY_BATCH_MAX, `Paling banyak ${String(SERVABILITY_BATCH_MAX)} soalan sekali gus.`),
  })
  .meta({ id: 'ServabilityBatchRequest' })
export type ServabilityBatchRequest = z.infer<typeof ServabilityBatchRequestSchema>

export const ServabilityBatchResultSchema = z
  .strictObject({
    reports: z.array(ServabilityReportSchema).meta({ description: 'One report per known question, in the order of the request (a repeated id once).' }),
    notFound: z.array(IdSchema).meta({ description: 'Ids the bank does not return (unknown, PKSK, Darjah).' }),
  })
  .meta({ id: 'ServabilityBatchResult' })
export type ServabilityBatchResult = z.infer<typeof ServabilityBatchResultSchema>

/** How a count was obtained: `sql` = the reader's own bank filter; `evaluated` = `evaluate` over the questions; `pool` = Jana pool facts before the bridge check. */
export const SERVABILITY_COUNT_BASES = ['sql', 'evaluated', 'pool'] as const

export const ServabilityOverviewActivitySchema = z
  .strictObject({
    activity: ServabilityActivitySchema,
    label: z.string(),
    served: z.number().int().min(0),
    total: z.number().int().min(0).meta({
      description:
        'The questions the activity could show: the approved, active bank; for Simulasi (kertas) the questions placed on published papers; for the Databank the rows of the Databank lane (MCQs of Databank subjects, any status), so `attention` equals the lane rows with a reason.',
    }),
    attention: z.number().int().min(0).meta({ description: 'total - served.' }),
    basis: z.enum(SERVABILITY_COUNT_BASES),
  })
  .meta({ id: 'ServabilityOverviewActivity' })

/**
 * The hub "Kandungan SPM" (Panel `/spm`, R1-21.1 / P1): one card per lane the screen exists for. V2 prints six lanes in this order;
 * R1 builds two (Databank Soalan, Bijak SPM), so the other four (Tracking A, Subjektif, Kertas Subjektif, Latih Tubi) are not
 * returned until their screens exist (no link to a missing screen). Titles, descriptions and attention labels are V2's own text
 * (docs/discovery/cloud-student-mechanism.md 3.0; BIJAK-SPM-cloud.md 3.10 for the Bijak SPM label). V2 prints the six labels in
 * the lane order, which gives `tidak boleh ditanda` to Databank Soalan (the McqGate lane) and `tiada kunci jawapan` to Bijak SPM.
 */
export const SERVABILITY_HUB_LANES = ['databank', 'bijak-spm'] as const
export const ServabilityHubLaneSchema = z.enum(SERVABILITY_HUB_LANES).meta({ id: 'ServabilityHubLane' })
export type ServabilityHubLane = z.infer<typeof ServabilityHubLaneSchema>

export const SERVABILITY_HUB_CARDS: Readonly<Record<ServabilityHubLane, { title: string; description: string; attentionLabel: string }>> = {
  databank: { title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
  'bijak-spm': { title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
}

/** Hub texts around the cards (V2 `hub.tsx`): intro line, the all-clear badge and the card button. */
export const SERVABILITY_HUB_COPY = {
  title: 'Kandungan SPM',
  intro: 'Setiap kad ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
  allGood: 'Semua elok',
  open: 'Buka senarai',
} as const

/** Sentence of a lane page that is asked for a page past the window. [PROPOSED]: V2 has no such limit (it pages the whole lane). */
export const SERVABILITY_LANE_WINDOW_MS = 'Halaman terlalu jauh. Gunakan Tapis atau Cari untuk mengecilkan senarai.'

/**
 * One hub card. `total` and `attention` are measured on the rows of the lane the card opens (one scope, `GET .../lanes/{lane}`
 * unfiltered): `total` is the number of rows, `attention` the number of rows with a reason (AC "attention count equals lane rows").
 */
export const ServabilityHubCardSchema = z
  .strictObject({
    lane: ServabilityHubLaneSchema,
    title: z.string().meta({ example: 'Databank Soalan' }),
    description: z.string(),
    total: z.number().int().min(0).meta({ description: 'Rows of the lane (Databank: MCQs of Databank subjects, any status; Bijak SPM: pilihan papers, any status).' }),
    attention: z.number().int().min(0).meta({ description: 'Lane rows that carry at least one reason (`attention.length > 0`).' }),
    attentionLabel: z.string().meta({ description: 'V2 label printed after the count: "{attention} {attentionLabel}", or "Semua elok" when 0.' }),
  })
  .meta({ id: 'ServabilityHubCard' })
export type ServabilityHubCard = z.infer<typeof ServabilityHubCardSchema>

export const ServabilityOverviewSchema = z
  .strictObject({
    bank: z.number().int().min(0).meta({ description: 'Approved, active, secondary-level, non-PKSK questions.' }),
    activities: z.array(ServabilityOverviewActivitySchema).length(SERVABILITY_ACTIVITIES.length),
    cards: z.array(ServabilityHubCardSchema).meta({ description: 'The hub cards in V2 order (R1: Databank Soalan, then Bijak SPM).' }),
  })
  .meta({ id: 'ServabilityOverview' })
export type ServabilityOverview = z.infer<typeof ServabilityOverviewSchema>

/** Rows a lane list can page through (`page` x `pageSize`): a deeper page is refused so OFFSET never scans the whole bank. */
export const SERVABILITY_LANE_WINDOW = 10_000

/** Query of both lane lists (S5.2): `Subjek`, `Status`, `Cari`, then the page. Unknown values match nothing. */
export const ServabilityLaneQuerySchema = z
  .object({
    subjectId: IdSchema.optional(),
    status: z.string().trim().max(20).optional(),
    search: z.string().trim().max(100).optional(),
    page: z.coerce.number().int().min(1).max(SERVABILITY_LANE_WINDOW).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .refine((q) => q.page * q.pageSize <= SERVABILITY_LANE_WINDOW, {
    message: SERVABILITY_LANE_WINDOW_MS,
    path: ['page'],
  })
  .meta({ id: 'ServabilityLaneQuery' })
export type ServabilityLaneQuery = z.infer<typeof ServabilityLaneQuerySchema>

export const ServabilityLaneSubjectSchema = z.strictObject({ id: IdSchema, name: z.string() }).meta({ id: 'ServabilityLaneSubject' })

/** Lane "Databank Soalan": one bank question per row; `attention` are the reasons it is not served in the Databank (empty = served). */
export const ServabilityDatabankRowSchema = z
  .strictObject({
    questionId: IdSchema,
    title: z.string().meta({ description: 'Stem, at most 90 characters.' }),
    subject: ServabilityLaneSubjectSchema.nullable(),
    status: z.string().meta({ description: 'Lifecycle code of the latest version.' }),
    attention: z.array(ServabilityReasonSchema),
  })
  .meta({ id: 'ServabilityDatabankRow' })
export type ServabilityDatabankRow = z.infer<typeof ServabilityDatabankRowSchema>

export const ServabilityAttentionCountSchema = z
  .strictObject({ code: ServabilityReasonCodeSchema, message: z.string(), count: z.number().int().min(1) })
  .meta({ id: 'ServabilityAttentionCount' })

/** The statuses of a paper (`ck_papers_status`), as the lane shows and filters them. */
export const SERVABILITY_PAPER_STATUSES = ['draft', 'ready', 'published', 'withdrawn'] as const

/**
 * Lane "Bijak SPM": one paper per row. `attention` counts the placed questions the Bijak bridge cannot serve, by reason; "not on a
 * published paper" is not counted (the paper `status` says it).
 */
export const ServabilityPaperRowSchema = z
  .strictObject({
    paperId: IdSchema,
    title: z.string(),
    subject: ServabilityLaneSubjectSchema.nullable(),
    status: z.enum(SERVABILITY_PAPER_STATUSES),
    questionCount: z.number().int().min(0),
    attentionCount: z.number().int().min(0).meta({ description: 'Placed questions with at least one reason.' }),
    attention: z.array(ServabilityAttentionCountSchema),
  })
  .meta({ id: 'ServabilityPaperRow' })
export type ServabilityPaperRow = z.infer<typeof ServabilityPaperRowSchema>
