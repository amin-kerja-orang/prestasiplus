import { z } from '../zod'
import { listEnvelopeOf, ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
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
 * The hub "SPM" (`/admin/spm`, R1-ADM-Q-01): one card per lane, in the PRD order (FR-ADM-Q01.1). The screen hides a card whose route
 * does not exist (FR-ADM-Q01.4), so the API returns all six. Titles and descriptions are V2's own text. `attentionLabel` is printed
 * after the count. On Kertas Subjektif it counts papers with no placement (FR-ADM-Q18.3, D9: "kandungan" replaces "halaman"). Subjektif has
 * a second line, "{n} tiada kunci jawapan".
 */
export const SERVABILITY_HUB_LANES = ['databank', 'tracking-a', 'subjektif', 'bijak-spm', 'kertas-subjektif', 'latih-tubi'] as const
export const ServabilityHubLaneSchema = z.enum(SERVABILITY_HUB_LANES).meta({ id: 'ServabilityHubLane' })
export type ServabilityHubLane = z.infer<typeof ServabilityHubLaneSchema>

export const SERVABILITY_HUB_CARDS: Readonly<Record<ServabilityHubLane, { title: string; description: string; attentionLabel: string }>> = {
  databank: { title: 'Databank Soalan', description: 'Bank soalan objektif SPM mengikut subjek.', attentionLabel: 'tidak boleh ditanda' },
  'tracking-a': { title: 'Tracking A', description: 'Set objektif penuh dan lane bahasa.', attentionLabel: 'set tidak lengkap' },
  subjektif: { title: 'Subjektif', description: 'Soalan berstruktur dan esei.', attentionLabel: 'tiada skema — tidak disajikan' },
  'bijak-spm': { title: 'Bijak SPM', description: 'Kertas SPM penuh dalam format sebenar.', attentionLabel: 'tiada kunci jawapan' },
  'kertas-subjektif': { title: 'Kertas Subjektif', description: 'Kertas 2, 3 & 4 percubaan negeri.', attentionLabel: 'tiada kandungan' },
  'latih-tubi': { title: 'Latih Tubi', description: 'Latihan ikut topik dan bab.', attentionLabel: 'tidak boleh ditanda' },
}

/** Hub texts around the cards (FR-ADM-Q01.1): title, intro line, the all-clear badge and the card button. */
export const SERVABILITY_HUB_COPY = {
  title: 'SPM',
  intro: 'Setiap kad di bawah ialah satu laluan yang pelajar boleh buka. Nombor merah menunjukkan berapa banyak item yang perlu diperiksa.',
  allGood: 'Semua elok',
  open: 'Buka senarai',
} as const

/** Sentence of a lane page that is asked for a page past the window. [PROPOSED]: V2 has no such limit (it pages the whole lane). */
export const SERVABILITY_LANE_WINDOW_MS = 'Halaman terlalu jauh. Gunakan Tapis atau Cari untuk mengecilkan senarai.'

/** One attention line of a hub card or a lane: the count and the full sentence, e.g. "20 set tidak lengkap". */
export const ServabilityLaneAttentionSchema = z
  .strictObject({ count: z.number().int().min(1), text: z.string() })
  .meta({ id: 'ServabilityLaneAttention' })
export type ServabilityLaneAttention = z.infer<typeof ServabilityLaneAttentionSchema>

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
    attentionLines: z.array(ServabilityLaneAttentionSchema).optional().meta({ description: 'The attention lines of the card; empty when nothing needs attention.' }),
    attentionOpen: z.literal(true).optional().meta({ description: 'No attention rule is decided for this lane yet: show neither a count nor "Semua elok".' }),
    failed: z.literal(true).optional().meta({ description: 'This card could not be computed; the other cards stay (SR-3).' }),
  })
  .meta({ id: 'ServabilityHubCard' })
export type ServabilityHubCard = z.infer<typeof ServabilityHubCardSchema>

export const ServabilityOverviewSchema = z
  .strictObject({
    bank: z.number().int().min(0).meta({ description: 'Approved, active, secondary-level, non-PKSK questions.' }),
    activities: z.array(ServabilityOverviewActivitySchema).length(SERVABILITY_ACTIVITIES.length),
    computedAt: TimestampSchema.meta({
      description: 'When these counts were computed (H-A21). Always sent: the overview is cached for 5 minutes and refreshed in the background after a question event or when the cache is older; show this time next to the counts.',
    }),
    cards: z.array(ServabilityHubCardSchema).meta({ description: 'The hub cards in the PRD order.' }),
  })
  .meta({ id: 'ServabilityOverview' })
export type ServabilityOverview = z.infer<typeof ServabilityOverviewSchema>
/** The counts alone, as `ServabilityReadsService.overview()` computes them; the cache adds `computedAt` (the time they were computed). */
export type ServabilityOverviewCounts = Omit<ServabilityOverview, 'computedAt'>

/** Rows a lane list can page through (`page` x `pageSize`): a deeper page is refused so OFFSET never scans the whole bank. */
export const SERVABILITY_LANE_WINDOW = 10_000

/** Query of both lane lists (S5.2): `Subjek`, `Status`, `Cari`, then the page. Unknown values match nothing. */
export const ServabilityLaneQuerySchema = z
  .object({
    subjectId: IdSchema.optional(),
    status: z.string().trim().max(20).optional(),
    search: z.string().trim().max(100, 'Carian tidak boleh melebihi 100 aksara.').optional(),
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

/**
 * A lane page is the list envelope plus `subjects`: the options of the lane's `Subjek` filter (REQ-C-020), in subject order, whatever
 * the current filters are. `count` is the lane's items under the current filters, so with no filter it equals the hub card's `total`
 * (API-BIJAK-12); on Latih Tubi it counts questions while `meta.totalItems` counts the cells. `attention` repeats the hub card's lines.
 * Both are optional only until the backend part of S3-T03 sends them.
 */
export const servabilityLaneListOf = <T extends z.ZodType>(row: T) =>
  listEnvelopeOf(row).extend({
    subjects: z.array(ServabilityLaneSubjectSchema).meta({ description: 'The options of the `Subjek` filter of this lane.' }),
    count: z.number().int().min(0).optional().meta({ description: 'Items of the lane under the current filters.' }),
    attention: z.array(ServabilityLaneAttentionSchema).optional().meta({ description: 'The attention lines of the hub card of this lane.' }),
  })

/** Lane "Databank Soalan": one bank question per row; `attention` are the reasons it is not served in the Databank (empty = served). */
export const ServabilityDatabankRowSchema = z
  .strictObject({
    questionId: IdSchema,
    title: z.string().meta({ description: 'Stem, at most 120 characters.' }),
    meta: z.string().optional().meta({ description: 'Meta line of the row.', example: '#451518 · Sains · Tingkatan 4 · 4 pilihan' }),
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

/** Row actions of a lane (field 02-06): `Pratonton`, `Salin`, `Sunting`. */
export const SERVABILITY_LANE_ACTIONS = ['preview', 'copy', 'edit'] as const

/**
 * A row of the Tracking A, Subjektif and Kertas Subjektif lanes (S3-T03). `id` is the set, question or paper id; `attention` holds the
 * full BM sentences, empty when nothing is wrong (the screen shows "—").
 */
export const ServabilityLaneRowSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    meta: z.string().meta({ example: '#1 · ramalan · 8 soalan' }),
    status: z.string(),
    attention: z.array(z.string()),
    actions: z.array(z.enum(SERVABILITY_LANE_ACTIONS)),
  })
  .meta({ id: 'ServabilityLaneRow' })
export type ServabilityLaneRow = z.infer<typeof ServabilityLaneRowSchema>

/** The switch state of a Latih Tubi cell, shown as a badge (`Dibuka`, `Ditutup`); it is edited in Kawalan Ciri only. */
export const SERVABILITY_LATIH_TUBI_SWITCH_LABELS = { open: 'Dibuka', closed: 'Ditutup' } as const

/** The Perhatian sentence of an incomplete Tracking A set. `available` counts servable questions and groups (D90). */
export const trackingSetAttentionMs = (filled: number, size: number, available: number): string =>
  `Hanya ${String(filled)} daripada ${String(size)} soalan — ${String(available)} tersedia untuk diisi`

/** The Perhatian text of a Latih Tubi cell. */
export const latihTubiCellAttentionMs = (n: number): string => `${String(n)} tidak boleh ditanda`

/**
 * Lane "Latih Tubi" (FR-ADM-Q02.4): one row per subject x Tingkatan. It carries counts, not a question, so `actions` is always empty.
 * `total` = approved active questions of the cell; `servable` = what the Latih Tubi draw can serve of them.
 */
export const ServabilityLatihTubiCellSchema = z
  .strictObject({
    id: z.string().meta({ description: 'Stable key of the cell: `{subjectId}:{levelId}`.' }),
    title: z.string().meta({ example: 'Sains · Tingkatan 4' }),
    meta: z.string().meta({ example: '#12 · 40 soalan' }),
    status: z.enum(['open', 'closed']).meta({ description: 'The `latih-tubi` switch.' }),
    attention: z.array(z.string()),
    actions: z.array(z.enum(SERVABILITY_LANE_ACTIONS)).max(0),
    subject: ServabilityLaneSubjectSchema,
    level: ServabilityLaneSubjectSchema.nullable(),
    servable: z.number().int().min(0),
    total: z.number().int().min(0),
  })
  .meta({ id: 'ServabilityLatihTubiCell' })
export type ServabilityLatihTubiCell = z.infer<typeof ServabilityLatihTubiCellSchema>

/** The Latih Tubi lane page: the list envelope with `meta.switchEnabled`, the Kawalan Ciri key `latih-tubi`. A key with no row is ON (FR-ADM-N06.4). */
export const ServabilityLatihTubiLaneSchema = servabilityLaneListOf(ServabilityLatihTubiCellSchema).extend({
  meta: ListMetaSchema.extend({ switchEnabled: z.boolean() }),
})

/**
 * REQ-A-018 / AC-04.3, AC-04.4 (V2 question detail "Dilihat murid di"): one published paper that carries the question, and whether pupils
 * can open that paper. `reasons` is empty when `served`; otherwise it lists, for each placed question that stops the paper, the reason
 * (`question_missing` for a placement that points at no question). `detail` is the id of that placed question, then the machine detail.
 */
export const QuestionPaperServabilityRowSchema = z
  .strictObject({
    paperId: IdSchema,
    title: z.string(),
    served: z.boolean().meta({ description: 'Pupils can open the paper in Simulasi (published and every placed question servable).' }),
    reasons: z.array(ServabilityReasonSchema).meta({ description: 'Empty when `served`. `detail` starts with the id of the placed question that stops the paper.' }),
  })
  .meta({ id: 'QuestionPaperServabilityRow' })
export type QuestionPaperServabilityRow = z.infer<typeof QuestionPaperServabilityRowSchema>

/** `meta` of `GET /admin/questions/{id}/paper-servability`: at most 200 papers are read; `total` counts all of them. */
export const QuestionPaperServabilityMetaSchema = z
  .strictObject({
    total: z.number().int().min(0).meta({ description: 'Published admin papers (kind pilihan) that place the question; a pupil\'s generated paper is never counted.' }),
    truncated: z.boolean().meta({ description: 'True when `total` is more than the rows returned (the first 200 by paper id).' }),
  })
  .meta({ id: 'QuestionPaperServabilityMeta' })
export type QuestionPaperServabilityMeta = z.infer<typeof QuestionPaperServabilityMetaSchema>

/** The 200 body of `GET /admin/questions/{id}/paper-servability`: `{ data, meta }` (the client resolves exactly this, not a bare array). */
export const QuestionPaperServabilityResponseSchema = z.object({ data: z.array(QuestionPaperServabilityRowSchema), meta: QuestionPaperServabilityMetaSchema })
export type QuestionPaperServabilityResponse = z.infer<typeof QuestionPaperServabilityResponseSchema>
