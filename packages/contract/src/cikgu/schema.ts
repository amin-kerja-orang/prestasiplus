import { z } from '../zod'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { IdSchema } from '../common/ids'

/**
 * M13 Cikgu Alesa (BE-43, contract-only; D53 matrix row 37).
 *
 * Source of truth is the frontend mock: `src/modules/m13-cikgu-alesa/{api,mock}` (handlers/index.ts,
 * repository/{cikgu,canned}.ts, api/{types,settings}.ts). Ten routes: the chat turn (any signed-in
 * role) and nine teacher tools (role `teacher` or `admin`).
 *
 * Wire rules:
 * - `POST /cikgu/send` is RAW (no `{data}` envelope) and snake_case, exactly as the live site:
 *   200 `{thread_id, reply, tier, turns_remaining, tool_hops, tokens}`, 401 `{}`, 422 `{}`,
 *   429 `{quota_exhausted: true}`. The other nine routes use the shared envelope and camelCase.
 * - Ids (thread, RPH, essay, tag, class, student, user) are opaque decimal strings (UD-1, `Id`),
 *   not the mock integers. `thread_id` is opaque: the client only echoes it back.
 * - Timestamps are `Timestamp` (+08:00); `lessonDate` is a `DateOnly` in Malaysia time.
 * - PDPA: the text typed by a minor (chat messages), the essays and student names typed by a teacher
 *   are personal data of children. They are never logged, never copied to another table and reach an
 *   AI provider only through the BE-36 adapter after redaction. Responses that carry them are
 *   `Cache-Control: no-store`. Whether chat content is used to train models is NOT stated in the card
 *   (open question 1 of the PR); the contract makes no such claim.
 *
 * AI provider: the reply, the marks and the RPH text come from the `mock` provider of the card (the
 * canned logic below) or, later, from the BE-36 adapter. BE-36's contract (`packages/contract/src/ai`)
 * is not on the base yet, so nothing is imported from it; the AI failure copy is approved by the LEAD.
 */

// --- constants (exact copy of the mock, api/settings.ts) -------------------------------------------

/** Rubric keys, in the order of the S5 options (the first is the fallback for an unknown label). */
export const CIKGU_RUBRIC_KEYS = [
  'spm_bm_karangan',
  'spm_bi_continuous_writing',
  'pt3_bm_karangan',
  'pt3_bi_essay',
  'sejarah_essay',
  'general',
] as const
export const CikguRubricKeySchema = z.enum(CIKGU_RUBRIC_KEYS).meta({ id: 'CikguRubricKey' })
export type CikguRubricKey = z.infer<typeof CikguRubricKeySchema>

export interface CikguRubric {
  key: CikguRubricKey
  label: string
  max: number
}

export const CIKGU_RUBRICS: readonly CikguRubric[] = [
  { key: 'spm_bm_karangan', label: 'SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)', max: 50 },
  { key: 'spm_bi_continuous_writing', label: 'SPM English — Continuous Writing (Section B) (50 markah)', max: 50 },
  { key: 'pt3_bm_karangan', label: 'PT3 Bahasa Melayu — Karangan (30 markah)', max: 30 },
  { key: 'pt3_bi_essay', label: 'PT3 English — Essay (30 markah)', max: 30 },
  { key: 'sejarah_essay', label: 'Sejarah — Karangan Esei (20 markah)', max: 20 },
  { key: 'general', label: 'Rubric Am (default) (100 markah)', max: 100 },
]

/** Level codes of the S3/S5 options: Darjah 1 to 6 and Tingkatan 1 to 5. */
export const CIKGU_LEVEL_CODES = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5'] as const
export const CikguLevelCodeSchema = z.enum(CIKGU_LEVEL_CODES).meta({ id: 'CikguLevelCode' })
export type CikguLevelCode = z.infer<typeof CikguLevelCodeSchema>

export const CIKGU_LEVELS: readonly { code: CikguLevelCode; label: string }[] = [
  { code: 'D1', label: 'Darjah 1' },
  { code: 'D2', label: 'Darjah 2' },
  { code: 'D3', label: 'Darjah 3' },
  { code: 'D4', label: 'Darjah 4' },
  { code: 'D5', label: 'Darjah 5' },
  { code: 'D6', label: 'Darjah 6' },
  { code: 'T1', label: 'Tingkatan 1' },
  { code: 'T2', label: 'Tingkatan 2' },
  { code: 'T3', label: 'Tingkatan 3' },
  { code: 'T4', label: 'Tingkatan 4' },
  { code: 'T5', label: 'Tingkatan 5' },
]

export function cikguLevelLabel(code: string): string {
  return CIKGU_LEVELS.find((l) => l.code === code)?.label ?? code
}

/** BR-M13-06 tiers. `admin` 100 turns, `teacher` -> tier `guru` 30, every other role -> `pelajar` 10. */
export const CIKGU_CHAT_TIERS = ['admin', 'guru', 'pelajar'] as const
export const CikguChatTierSchema = z.enum(CIKGU_CHAT_TIERS).meta({ id: 'CikguChatTier' })
export type CikguChatTier = z.infer<typeof CikguChatTierSchema>

export const CIKGU_TIERS = {
  admin: { tier: 'admin', dailyTurns: 100 },
  teacher: { tier: 'guru', dailyTurns: 30 },
  other: { tier: 'pelajar', dailyTurns: 10 },
} as const

/** Tier and daily limit of a role code (BR-M13-06). */
export function cikguTierOf(role: string): { tier: CikguChatTier; dailyTurns: number } {
  if (role === 'admin') return CIKGU_TIERS.admin
  if (role === 'teacher') return CIKGU_TIERS.teacher
  return CIKGU_TIERS.other
}

/** BR-M13-15 SP label per subject name; illustrative in the mock, not DSKP data (open question). */
export const CIKGU_SP_LABELS = { Kimia: '5.1.1', Sejarah: '1.1.1', default: '1.1.1' } as const

/** Page size of every list (fixed; there is no pageSize query). */
export const CIKGU_PAGE_SIZE = 20

/** BR-M13-08: the hand-off message that makes the chat run the `mark_essay` tool starts with this. */
export const CIKGU_HANDOFF_PREFIX = 'Tolong mark karangan ini menggunakan rubric '

export const CIKGU_CHAT_TOOLS = ['mark_essay', 'rph', 'practice'] as const
export type CikguChatTool = (typeof CIKGU_CHAT_TOOLS)[number]

// --- canned texts of the `mock` AI provider (SRS 8.2, PROPOSED COPY in the mock) --------------------

export const CIKGU_GENERAL_REPLY =
  'Soalan yang baik! Ini penerangan ringkas:\n' +
  '1. Mulakan dengan konsep asas dan satu contoh mudah.\n' +
  '2. Kaitkan konsep itu dengan pengalaman harian murid.\n' +
  '3. Akhiri dengan 2–3 soalan semakan kefahaman.\n' +
  'Nak saya sediakan latihan soalan untuk topik ini?'

export const CIKGU_PRACTICE_REPLY =
  'Ini 3 soalan latihan ringkas:\n' +
  '1. Nyatakan maksud konsep utama topik ini.\n' +
  '2. Berikan satu contoh konsep ini dalam kehidupan harian.\n' +
  '3. Terangkan perbezaan antara dua konsep yang berkaitan.\n' +
  'Cuba jawab dahulu, kemudian hantar jawapan untuk saya semak.'

export const CIKGU_RPH_FOLLOW_UP =
  'Boleh nyatakan subjek, tingkatan/tahun dan tajuk? Contoh: "Tolong jana RPH untuk Matematik T4 Bab 3 esok".'

/** `dateLabel` is `dd/mm/yyyy`. */
export const cikguRphConfirmation = (tajuk: string, subject: string, level: CikguLevelCode, dateLabel: string): string =>
  `Siap! RPH "${tajuk}" (${subject}, ${cikguLevelLabel(level)}) untuk ${dateLabel} telah dijana dan disimpan dalam senarai RPH.`

/** BR-M13-09: 70 % of the maximum, rounded (35/50, 35/50, 21/30, 21/30, 14/20, 70/100). */
export const cikguCannedMarks = (max: number): number => Math.round(0.7 * max)

export const cikguMarkingReply = (rubric: CikguRubric, marks: number): string =>
  `Markah: ${String(marks)}/${String(rubric.max)}\n` +
  `Rubric: ${rubric.label}\n` +
  'Komen membina:\n' +
  '1. Isi: idea utama jelas; tambah satu contoh untuk setiap isi.\n' +
  '2. Bahasa: ayat gramatis; kurangkan pengulangan perkataan.\n' +
  '3. Cadangan: kukuhkan penutup dengan rumusan yang merujuk tajuk.'

/** Client fallback text for any chat failure without a message (live copy, `CHAT_COPY.failed`). */
export const CIKGU_CHAT_FAILED_TEXT = 'Cikgu Alesa tak boleh respon. Cuba lagi.'

/**
 * Copy of the AI failure on `POST /cikgu/send` and `POST /cikgu/rph` (provider error, BE-36 rate limit
 * or `AI_BUDGET_EXHAUSTED`). The mock has no failure path; the LEAD approved this copy on 2026-10-19
 * (review BE-43). The screen shows a sentence and not a machine code.
 */
export const CIKGU_AI_UNAVAILABLE_MESSAGE = 'Cikgu Alesa tidak dapat menjawab sekarang. Sila cuba sebentar lagi.'
export const CIKGU_AI_UNAVAILABLE_CODE = 'AI_UNAVAILABLE'

/** Copy of the 429 RATE_LIMITED on the raw chat route (D57a, approved by the LEAD; same wording as the other contracts). */
export const CIKGU_RATE_LIMITED_MESSAGE = 'Terlalu banyak percubaan. Sila cuba sebentar lagi.'

// --- pure rules shared with the server (no I/O) ------------------------------------------------------

/** Unicode code points, as the mock counts (`[...s].length`). */
export const cikguCodePoints = (s: string): number => [...s].length

/** BR-M13-05: mock-provider token estimate of the trimmed message. */
export const cikguTokensIn = (message: string): number => 120 + Math.ceil(cikguCodePoints(message) / 4)
export const cikguTokensOut = (reply: string): number => Math.ceil(cikguCodePoints(reply) / 4)

/** BR-M13-14: TP band of a score. */
export function cikguTpOf(skor: number): number {
  if (skor < 20) return 1
  if (skor < 40) return 2
  if (skor < 60) return 3
  if (skor < 75) return 4
  if (skor < 90) return 5
  return 6
}

/** BR-M13-14: score = correct / answered x 100, one decimal. */
export const cikguSkorOf = (correct: number, answered: number): number => Math.round((correct / answered) * 1000) / 10

/** BR-M13-17 / SEC-M13-04: CSV cell with the spreadsheet-formula guard. */
export function cikguCsvCell(value: string | number): string {
  let s = String(value)
  if (/^[=+@-]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export const CIKGU_PBD_CSV_HEADER = 'pelajar,kelas,sp,skor,tp,tarikh_lulus'
export const CIKGU_PBD_CSV_FILENAME = 'pbd-approved.csv'

// --- chat turn (raw, un-enveloped, snake_case) ------------------------------------------------------

/** Longest `message` of a chat turn, in Unicode code points (security review BE-43). */
export const CIKGU_MESSAGE_MAX = 2000
export const CIKGU_MESSAGE_TOO_LONG = `Mesej terlalu panjang (maksimum ${String(CIKGU_MESSAGE_MAX)} aksara).`
/** Most tag ids one `bulk-approve` call accepts (security review BE-43). */
export const CIKGU_BULK_IDS_MAX = 100
export const CIKGU_BULK_IDS_TOO_MANY = `Terlalu banyak item dipilih (maksimum ${String(CIKGU_BULK_IDS_MAX)}).`

/**
 * Body of `POST /cikgu/send`. A non-string or blank (after trim) `message` is 422 `{}` (checked before
 * the thread and the AI call; nothing is stored). A `message` longer than 2000 code points is 422 with
 * the raw body `{error: "Mesej terlalu panjang (maksimum 2000 aksara).", code: "VALIDATION_ERROR"}`. A `thread_id` that is not a string, unknown, or
 * another user's starts a new thread (no error, no leak); the server never rejects it.
 */
export const CikguSendRequestSchema = z
  .object({
    message: z
      .string()
      .refine((v) => v.trim() !== '', { error: 'message must not be blank' })
      .refine((v) => cikguCodePoints(v) <= CIKGU_MESSAGE_MAX, { error: CIKGU_MESSAGE_TOO_LONG })
      .meta({
        description: `The turn text. Blank after trim = 422 \`{}\`. At most ${String(CIKGU_MESSAGE_MAX)} characters (code points): longer = 422 "${CIKGU_MESSAGE_TOO_LONG}" (cap added by the security review; the mock has none).`,
      }),
    thread_id: z
      .string()
      .nullish()
      .meta({
        description:
          'Opaque thread id returned by an earlier turn. Null, missing, non-string, unknown or foreign = a new thread.',
      }),
  })
  .meta({ id: 'CikguSendRequest' })
export type CikguSendRequest = z.input<typeof CikguSendRequestSchema>

export const CikguSendResponseSchema = z
  .object({
    thread_id: IdSchema.meta({ description: 'Opaque thread id (decimal string); echo it back to continue the thread.' }),
    reply: z.string(),
    tier: CikguChatTierSchema,
    turns_remaining: z
      .number()
      .int()
      .min(0)
      .meta({ description: 'limit - (used + 1); 0 after the last allowed turn.' }),
    tool_hops: z
      .union([z.literal(0), z.literal(1)])
      .meta({ description: '1 when the turn ran mark_essay, saved an RPH or returned practice questions; else 0.' }),
    tokens: z.object({ in: z.number().int().min(0), out: z.number().int().min(0) }),
  })
  .meta({ id: 'CikguSendResponse' })
export type CikguSendResponse = z.infer<typeof CikguSendResponseSchema>

/** 401 and 422 of `POST /cikgu/send`: exactly `{}`. */
export const CikguChatEmptyBodySchema = z.strictObject({}).meta({ id: 'CikguChatEmptyBody' })

/** 429 of `POST /cikgu/send` when the daily quota is used up: exactly `{"quota_exhausted": true}`. */
export const CikguChatQuotaBodySchema = z
  .strictObject({ quota_exhausted: z.literal(true) })
  .meta({ id: 'CikguChatQuotaBody' })

/**
 * Raw error body of `POST /cikgu/send` for 429 RATE_LIMITED (D57a), 503 AI_UNAVAILABLE and the 422 of an
 * over-long message (code VALIDATION_ERROR).
 * `error` is a BM STRING (not the `ErrorBody` object) because the live client shows `body.error` as text
 * when it is a non-empty string and falls back to its own copy otherwise.
 */
export const CikguChatErrorBodySchema = z
  .object({
    error: z.string().min(1).meta({ description: 'BM message for direct display.' }),
    code: z.enum(['RATE_LIMITED', CIKGU_AI_UNAVAILABLE_CODE, 'VALIDATION_ERROR']).meta({ description: 'Machine code.' }),
    retryAfter: z.number().int().nonnegative().optional().meta({ description: 'Seconds, on RATE_LIMITED only.' }),
  })
  .meta({ id: 'CikguChatErrorBody' })
export type CikguChatErrorBody = z.infer<typeof CikguChatErrorBodySchema>

// --- RPH (BR-M13-10 to 12) -------------------------------------------------------------------------

export const CIKGU_RPH_STATUSES = ['generated'] as const
export const CIKGU_RPH_SOURCES = ['form', 'chat'] as const

export const CikguRphSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    subjectName: z.string(),
    level: CikguLevelCodeSchema,
    tajuk: z.string(),
    className: z.string().nullable(),
    lessonDate: DateOnlySchema,
    durationMinutes: z.number().int().min(15).max(240),
    timeSlot: z.string().nullable(),
    tema: z.string().nullable(),
    pengajaranKeperluan: z.string().nullable(),
    status: z.enum(CIKGU_RPH_STATUSES),
    source: z.enum(CIKGU_RPH_SOURCES),
    content: z.string().meta({ description: 'The generated plan text, lines joined with \\n.' }),
    threadId: IdSchema.nullable().meta({ description: 'Set when source = chat; null for a form RPH.' }),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'CikguRph' })
export type CikguRph = z.infer<typeof CikguRphSchema>

export const CikguRphListItemSchema = z
  .object({
    id: IdSchema,
    lessonDate: DateOnlySchema,
    subjectName: z.string(),
    level: CikguLevelCodeSchema,
    tajuk: z.string(),
    status: z.enum(CIKGU_RPH_STATUSES),
  })
  .meta({ id: 'CikguRphListItem' })
export type CikguRphListItem = z.infer<typeof CikguRphListItemSchema>

/** Exact BM copy of BR-M13-12 (mock `VALIDATION_MSG`). */
export const CIKGU_VALIDATION_MESSAGES = {
  required: 'Medan ini diperlukan.',
  invalid: 'Medan ini tidak sah.',
  tooLong: (n: number): string => `Medan ini tidak boleh melebihi ${String(n)} aksara.`,
  duration: 'Tempoh mesti antara 15 dan 240 minit.',
  date: 'Tarikh tidak sah.',
} as const

/** The 422 `fields` keys of `POST /cikgu/rph`, in the order the server inserts them. */
export const CIKGU_RPH_FIELD_ORDER = [
  'subjectName',
  'level',
  'tajuk',
  'durationMinutes',
  'lessonDate',
  'pengajaranKeperluan',
  'className',
  'timeSlot',
  'tema',
] as const
export type CikguRphField = (typeof CIKGU_RPH_FIELD_ORDER)[number]

const M = CIKGU_VALIDATION_MESSAGES

/** `YYYY-MM-DD` and a real calendar date. */
export function isCikguDateKey(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const t = Date.parse(`${v}T00:00:00Z`)
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v
}

/** Required text: non-string or blank after trim is `required`; longer than `max` code points is `tooLong`. */
const requiredText = (max: number) =>
  z
    .string({ error: M.required })
    .trim()
    .min(1, { error: M.required })
    .refine((v) => cikguCodePoints(v) <= max, { error: M.tooLong(max) })

/** Optional text: a non-string or blank value becomes null; longer than `max` code points is `tooLong`. */
const optionalText = (max: number) =>
  z
    .preprocess(
      (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null),
      z
        .string()
        .refine((v) => cikguCodePoints(v) <= max, { error: M.tooLong(max) })
        .nullable(),
    )
    .optional()
    .meta({ description: `Optional. Blank or non-string = null. At most ${String(max)} characters (code points).` })

/**
 * Body of `POST /cikgu/rph` (BR-M13-12). All values are trimmed; lengths count Unicode code points;
 * every failing field is collected and returned together (422 VALIDATION_ERROR with `fields`, in the
 * order of `CIKGU_RPH_FIELD_ORDER`). Unknown keys are ignored.
 */
export const CikguRphCreateRequestSchema = z
  .object({
    subjectName: requiredText(100),
    level: z
      .string({ error: M.required })
      .trim()
      .min(1, { error: M.required })
      .refine((v) => (CIKGU_LEVEL_CODES as readonly string[]).includes(v), { error: M.invalid })
      .meta({ description: 'One of D1 to D6, T1 to T5.' }),
    tajuk: requiredText(200),
    durationMinutes: z
      .number({ error: M.duration })
      .int({ error: M.duration })
      .min(15, { error: M.duration })
      .max(240, { error: M.duration })
      .nullish()
      .meta({ description: 'Integer 15 to 240; missing or null = 60.' }),
    lessonDate: z
      .preprocess(
        (v) => (typeof v === 'string' ? v.trim() : ''),
        z.string().refine((v) => v === '' || isCikguDateKey(v), { error: M.date }),
      )
      .optional()
      .meta({ description: 'YYYY-MM-DD and a real date. Empty, blank, non-string or missing = today (Malaysia).' }),
    pengajaranKeperluan: optionalText(500),
    className: optionalText(100),
    timeSlot: optionalText(100),
    tema: optionalText(100),
  })
  .meta({ id: 'CikguRphCreateRequest' })
export type CikguRphCreateRequest = z.input<typeof CikguRphCreateRequestSchema>

/** First message per field of a failed parse, keys in `CIKGU_RPH_FIELD_ORDER` order (the 422 `fields`). */
export function cikguRphFieldErrors(input: unknown): Partial<Record<CikguRphField, string>> {
  const r = CikguRphCreateRequestSchema.safeParse(input)
  if (r.success) return {}
  const first = new Map<string, string>()
  for (const i of r.error.issues) {
    const key = String(i.path[0])
    if (!first.has(key)) first.set(key, i.message)
  }
  const out: Partial<Record<CikguRphField, string>> = {}
  for (const k of CIKGU_RPH_FIELD_ORDER) {
    const m = first.get(k)
    if (m !== undefined) out[k] = m
  }
  return out
}

/** Top-level 422 message: the first field message plus ` (and N more error(s))` (Laravel summarize). */
export function cikguSummarizeFieldErrors(fields: Partial<Record<string, string>>): string {
  const messages = Object.values(fields).filter((m): m is string => typeof m === 'string')
  const [first] = messages
  if (first === undefined) return ''
  const more = messages.length - 1
  return more === 0 ? first : `${first} (and ${String(more)} more error${more === 1 ? '' : 's'})`
}

// --- essays (FR-M13-27, 48) -------------------------------------------------------------------------

/**
 * One saved marking. `studentName` and `essayText` are child data typed by a teacher (PDPA): owner
 * only, never logged, `Cache-Control: no-store`.
 */
export const CikguEssayMarkingSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    rubricKey: CikguRubricKeySchema,
    subjectName: z.string().nullable(),
    level: z.string().nullable().meta({ description: 'Free text from the hand-off message (not restricted to the level codes).' }),
    studentName: z.string().nullable(),
    essayTitle: z.string().nullable(),
    essayText: z.string(),
    marks: z.number().int().min(0),
    maxMarks: z.number().int().min(1),
    comment: z.string(),
    threadId: IdSchema,
    createdAt: TimestampSchema,
  })
  .meta({ id: 'CikguEssayMarking' })
export type CikguEssayMarking = z.infer<typeof CikguEssayMarkingSchema>

export const CikguEssayListItemSchema = z
  .object({
    id: IdSchema,
    studentName: z.string().nullable(),
    subjectName: z.string().nullable(),
    rubricKey: CikguRubricKeySchema,
    essayTitle: z.string().nullable(),
    marks: z.number().int().min(0),
    maxMarks: z.number().int().min(1),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'CikguEssayListItem' })
export type CikguEssayListItem = z.infer<typeof CikguEssayListItemSchema>

// --- PBD tags (BR-M13-13 to 17) --------------------------------------------------------------------

export const CikguPbdQueueItemSchema = z
  .object({
    id: IdSchema,
    studentId: IdSchema,
    studentName: z.string(),
    classroomId: IdSchema,
    sp: z.string(),
    skor: z.number().min(0).max(100).meta({ description: 'One decimal.' }),
    tp: z.number().int().min(1).max(6),
  })
  .meta({ id: 'CikguPbdQueueItem' })
export type CikguPbdQueueItem = z.infer<typeof CikguPbdQueueItemSchema>

/**
 * Body of `POST /cikgu/pbd/rollup`. `classroomId` is a digit string or an integer; anything else (also
 * null), a class that is not the caller's, or a class without a subject answers 200 `{0, 0, 0}` and
 * changes nothing, so the server never answers 422 here.
 */
export const CikguRollupRequestSchema = z
  .object({
    classroomId: z
      .union([IdSchema, z.number().int().nonnegative()])
      .nullish()
      .meta({ description: 'Class id (decimal string; an integer is also accepted). Anything else = zero result.' }),
  })
  .meta({ id: 'CikguRollupRequest' })
export type CikguRollupRequest = z.input<typeof CikguRollupRequestSchema>

export const CikguRollupResultSchema = z
  .object({
    created: z.number().int().min(0),
    updated: z.number().int().min(0),
    skipped: z.number().int().min(0),
  })
  .meta({ id: 'CikguRollupResult' })
export type CikguRollupResult = z.infer<typeof CikguRollupResultSchema>

/**
 * Body of `POST /cikgu/pbd/bulk-approve`. Items that are digit strings (trimmed) or integers are kept,
 * others dropped; duplicates count once; a foreign or non-pending id is ignored silently; not an array
 * or empty = `{approved: 0}`. More than 100 items is 422 VALIDATION_ERROR.
 */
export const CikguBulkApproveRequestSchema = z
  .object({
    ids: z
      .array(z.union([IdSchema, z.number().int().nonnegative()]))
      .max(CIKGU_BULK_IDS_MAX, { error: CIKGU_BULK_IDS_TOO_MANY })
      .nullish()
      .meta({
        description: `Tag ids (decimal strings; integers also accepted). At most ${String(CIKGU_BULK_IDS_MAX)} items: more = 422 "${CIKGU_BULK_IDS_TOO_MANY}" on fields.ids (cap added by the security review; the mock has none).`,
      }),
  })
  .meta({ id: 'CikguBulkApproveRequest' })
export type CikguBulkApproveRequest = z.input<typeof CikguBulkApproveRequestSchema>

export const CikguBulkApproveResultSchema = z
  .object({ approved: z.number().int().min(0) })
  .meta({ id: 'CikguBulkApproveResult' })
export type CikguBulkApproveResult = z.infer<typeof CikguBulkApproveResultSchema>
