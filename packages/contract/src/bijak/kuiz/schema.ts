import { z } from '../../zod'
import { IdSchema } from '../../common/ids'

/**
 * Bijak SPM "Simulasi Kuiz" (R1-B16, pipeline 13.4, decision U8 / D85). Two entry points:
 *
 * - RANDOM quiz (`/simulasi/kuiz`): `POST /bijak/kuiz/sessions` draws N objective (MCQ) questions, `.../check` marks one
 *   answer on the server, `.../finish` closes the session. A random quiz is stored as a practice session (U8), so a wrong
 *   answer feeds Soalan Aku Salah.
 * - PER-PAPER quiz (`/simulasi/{paper}/kuiz`): `GET /bijak/kuiz/papers/{id}?page=n` returns one Bahagian of a published
 *   paper; `.../check` marks one answer. NOTHING is stored (U8).
 *
 * V2 trust boundary (ExamQuizController): a question carries only `{id, label, text}` per option, never which option is
 * right. The server marks and answers with `correct` and `correctOptionId`. Option ids are the stored option letters
 * (A..H) and stay stable while the shown label (A, B, C ...) follows the shuffled order, so a shuffled quiz is still
 * markable. Every response object is strict: a stray key (a key, a scheme) fails parsing instead of leaving the server.
 */

/** V2 `ExamQuizController::COUNTS`. */
export const BIJAK_KUIZ_COUNTS = [5, 10, 20, 40] as const
export const BIJAK_KUIZ_DEFAULT_COUNT = 20

export const BIJAK_KUIZ_MESSAGES = {
  invalidValue: 'Nilai tidak sah.',
  invalidAnswer: 'Jawapan tidak sah.',
  /** V2 empty state of the random quiz. */
  noQuestions: 'Belum ada soalan objektif',
  notFound: 'Kuiz tidak ditemui',
  paperNotFound: 'Kertas tidak ditemui',
  /** [PROPOSED] H-A13: same line as a new sitting of a paper that places an archived question. */
  paperUnavailable: 'Kertas ini sedang dikemas kini dan tidak boleh dicuba buat masa ini.',
  alreadyFinished: 'Kuiz ini sudah selesai.',
} as const

export const BijakKuizStartRequestSchema = z
  .strictObject({
    subject: z.string().trim().min(1).max(20).optional().meta({ description: 'Curriculum subject code, for example MATH. Absent = every subject.' }),
    count: z
      .unknown()
      .optional()
      .meta({ description: '5, 10, 20 or 40. Anything else, or absent, falls back to 20 (V2 ExamQuizController). Never a 422.' }),
  })
  .meta({ id: 'BijakKuizStartRequest' })
export type BijakKuizStartRequest = z.infer<typeof BijakKuizStartRequestSchema>

/** V2 `(int) $request->query('count', 20)` then `in_array(COUNTS) ? $count : 20`. */
export function normaliseKuizCount(raw: unknown): number {
  const n = typeof raw === 'number' ? Math.trunc(raw) : typeof raw === 'string' ? Number.parseInt(raw, 10) : Number.NaN
  return (BIJAK_KUIZ_COUNTS as readonly number[]).includes(n) ? n : BIJAK_KUIZ_DEFAULT_COUNT
}

export const BijakKuizOptionSchema = z
  .strictObject({
    id: z.string().regex(/^[A-H]$/).meta({ description: 'Stable option id (the stored letter). Send it back on check.' }),
    label: z.string().regex(/^[A-H]$/).meta({ description: 'Letter shown to the pupil (follows the shuffled order).' }),
    text: z.string(),
    imageToken: z.string().nullable().meta({ description: 'Public file token of an option picture, else null. Read it from /api/files/{token}.' }),
  })
  .meta({ id: 'BijakKuizOption' })

export const BijakKuizStimulusSchema = z
  .strictObject({
    kind: z.enum(['passage', 'table', 'diagram', 'image', 'map', 'infographic', 'graph']).meta({ description: 'The seven stimulus kinds (R1-T07).' }),
    label: z.string(),
    body: z.string().nullable(),
    imageToken: z.string().nullable(),
    alt: z.string().nullable(),
    caption: z.string().nullable().meta({ description: 'Figure caption (R1-T07).' }),
    source: z.string().nullable().meta({ description: 'Source line of a passage or picture (R1-T07).' }),
    table: z
      .strictObject({ head: z.array(z.string()), rows: z.array(z.array(z.string())) })
      .nullable()
      .meta({ description: 'The grid of a table stimulus; null for every other kind.' }),
  })
  .meta({ id: 'BijakKuizStimulus' })

export const BijakKuizItemSchema = z
  .strictObject({
    id: z.string().min(1).max(80).meta({ description: 'Question id, or "{questionId}:{part path}" for a part of a structured question (per-paper quiz).' }),
    groupId: z.string().nullable().meta({ description: 'Shared stimulus group (D90). Random quiz: the group stimulus is in `stimuli` above the item. Per-paper quiz: it is in the page `groups[]`, once for all members.' }),
    kind: z.enum(['mcq', 'open']).meta({ description: 'open = a non-objective part: shown with an unsaved textarea, cannot be checked.' }),
    stem: z.string().nullable(),
    lead: z.array(z.string()).meta({ description: 'Prompts of the parent parts, outermost first.' }),
    path: z.string().nullable().meta({ description: 'Part label path, for example "a.i"; null for a single-part question.' }),
    prompt: z.string(),
    marks: z.number().int().min(0),
    markable: z.boolean(),
    subjectName: z.string().nullable(),
    stimuli: z.array(BijakKuizStimulusSchema),
    options: z.array(BijakKuizOptionSchema),
  })
  .meta({ id: 'BijakKuizItem' })
export type BijakKuizItem = z.infer<typeof BijakKuizItemSchema>

export const BijakKuizSessionSchema = z
  .strictObject({
    sessionId: z.uuid(),
    count: z.number().int().min(1),
    items: z.array(BijakKuizItemSchema),
  })
  .meta({ id: 'BijakKuizSession' })
export type BijakKuizSession = z.infer<typeof BijakKuizSessionSchema>

export const BijakKuizCheckRequestSchema = z
  .strictObject({
    itemId: z.string().min(1).max(80),
    optionId: z.string().regex(/^[A-H]$/, BIJAK_KUIZ_MESSAGES.invalidAnswer),
  })
  .meta({ id: 'BijakKuizCheckRequest' })
export type BijakKuizCheckRequest = z.infer<typeof BijakKuizCheckRequestSchema>

export const BijakKuizCheckResultSchema = z
  .strictObject({
    correct: z.boolean(),
    correctOptionId: z.string().regex(/^[A-H]$/),
    explanation: z.string().nullable(),
  })
  .meta({ id: 'BijakKuizCheckResult' })
export type BijakKuizCheckResult = z.infer<typeof BijakKuizCheckResultSchema>

export const BijakKuizFinishRequestSchema = z
  .strictObject({ timeSpent: z.number().min(0).max(86_400).optional() })
  .meta({ id: 'BijakKuizFinishRequest' })
export type BijakKuizFinishRequest = z.infer<typeof BijakKuizFinishRequestSchema>

export const BijakKuizResultSchema = z
  .strictObject({
    score: z.number().int().min(0),
    total: z.number().int().min(0),
    answered: z.number().int().min(0),
    gamification: z.strictObject({
      coinsEarned: z.number().int().min(0),
      streakCount: z.number().int().min(0),
      pointsEarned: z.number().int().min(0),
      totalBalance: z.number().int().min(0),
    }),
  })
  .meta({ id: 'BijakKuizResult' })
export type BijakKuizResult = z.infer<typeof BijakKuizResultSchema>

export const BijakKuizPaperQuerySchema = z
  .strictObject({ page: z.coerce.number().int().min(1).max(200).optional() })
  .meta({ id: 'BijakKuizPaperQuery' })

export const BijakKuizPaperPageSchema = z
  .strictObject({
    paper: z.strictObject({ id: IdSchema, title: z.string(), subjectName: z.string(), code: z.string() }),
    page: z.number().int().min(1),
    pageCount: z.number().int().min(0),
    section: z
      .strictObject({ id: IdSchema, label: z.string(), instruction: z.string().nullable() })
      .nullable()
      .meta({ description: 'The Bahagian of this page; null when the paper has no question to show.' }),
    items: z.array(BijakKuizItemSchema).meta({ description: 'In display order. The members of a stimulus group are contiguous, in group order.' }),
    groups: z
      .array(z.strictObject({ id: z.string(), stimuli: z.array(BijakKuizStimulusSchema) }))
      .meta({ description: 'D90: each stimulus group of this page once. Render its stimuli above its member items (items whose groupId matches); the stimulus is never an item.' }),
    markableTotal: z.number().int().min(0).meta({ description: 'Objective parts of the whole paper (V2 "Skor: n / markableTotal").' }),
  })
  .meta({ id: 'BijakKuizPaperPage' })
export type BijakKuizPaperPage = z.infer<typeof BijakKuizPaperPageSchema>
