import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import {
  PKSK_BAHAGIAN,
  PKSK_LEVELS,
  PKSK_QUESTION_STATUSES,
  PkskBahagianSchema,
  PkskDomainRefSchema,
  PkskLevelSchema,
  PkskPackageLevelSchema,
  PkskQuestionStatusSchema,
} from './shared'

/**
 * M07 PKSK, admin half (BE-42): the PKSK question bank screens (S5 to S7), the access grants
 * screen (S8) and the package list. Mock spec: `src/modules/m07-pksk/mock/handlers/{admin-questions,
 * admin-access}.ts`, catalogue M07-10 to M07-21.
 *
 * Who may call: role `admin` only (no session 401 UNAUTHORIZED "Unauthenticated.", any other role
 * 403 FORBIDDEN "This action is unauthorized."). Every write also needs the CSRF header (403
 * CSRF_INVALID) and is rate limited (D57a, 429 RATE_LIMITED).
 *
 * Wire conventions:
 * - Ids are decimal strings (UD-1, `IdSchema`); the frontend mock still sends numbers. Request ids
 *   must be digit strings here (the mock also tolerates JSON integers: a transport tolerance, not
 *   part of the schemas).
 * - Validation errors are `422 VALIDATION_ERROR` with `fields` (field name to BM message). The
 *   top-level `message` is the first field message plus " (and N more error(s))" when several
 *   fields fail (Laravel summary, as the mock). All failing fields are returned together.
 * - Each zod check below carries the mock's exact message. Use `pkskAdminFieldErrors` to turn a zod
 *   error into the mock's `fields`: one entry per top-level key, the shallowest issue wins, so
 *   `options.1.text` collapses into `options` (the count message beats an element message, as the
 *   mock checks the count first).
 * - Rules that need stored data are service rules, not schema rules, and keep the mock messages:
 *   unknown domain or a domain that does not belong to the chosen Bahagian (`pkskDomainId` "Sila
 *   pilih domain."), unknown user (`userId`), unknown package (`packageId`), a non-PKSK / unknown
 *   question id (404 on the single routes, 422 `ids` on the bulk route), update without `options`
 *   when fewer than 2 are stored for an A or B domain (`options` count message).
 * - PKSK question statuses stay `pending | approved | rejected` as in the mock (open question: D54a
 *   defines the five-state lifecycle for M04 questions only).
 */

/** Mock messages, verbatim (BM). `proposed` ones are caps added by this contract, not in the mock. */
export const PKSK_ADMIN_MESSAGES = {
  bahagian: 'Sila pilih bahagian.',
  domain: 'Sila pilih domain.',
  level: 'Sila pilih tingkatan.',
  status: 'Sila pilih status.',
  questionText: 'Sila masukkan teks soalan.',
  difficulty: 'Tahap kesukaran tidak sah.',
  optionsCount: 'Sila masukkan 2 hingga 6 pilihan jawapan.',
  optionText: 'Sila masukkan teks pilihan jawapan.',
  ids: 'Sila pilih sekurang-kurangnya satu soalan PKSK.',
  action: 'Tindakan tidak sah.',
  userNotFound: 'Pengguna tidak dijumpai.',
  package: 'Sila pilih pakej.',
  expiresAt: 'Tarikh tamat tidak sah.',
  questionNotFound: 'Soalan PKSK tidak dijumpai.',
  accessNotFound: 'Rekod akses tidak dijumpai.',
  accessNotActive: 'Akses ini tidak aktif dan tidak boleh ditarik balik.',
  // Proposed caps (BE-NFR / D57 sane maxima), not in the mock.
  questionTextMax: 'Teks soalan tidak boleh melebihi 2000 aksara.',
  explanationMax: 'Penjelasan tidak boleh melebihi 2000 aksara.',
  optionTextMax: 'Pilihan jawapan tidak boleh melebihi 500 aksara.',
  idsMax: 'Terlalu banyak soalan dipilih (maksimum 100).',
  searchMax: 'Carian tidak boleh melebihi 100 aksara.',
} as const

/** Success flash texts returned in `status` (mock `QUESTION_FLASH`, `ACCESS_FLASH`). */
export const PKSK_ADMIN_FLASH = {
  questionCreated: 'Soalan PKSK berjaya ditambah.',
  questionUpdated: 'Soalan PKSK berjaya dikemaskini.',
  accessGranted: 'Akses PKSK berjaya diberi.',
  accessRevoked: 'Akses PKSK telah ditarik balik.',
  bulkApproved: (n: number) => `${String(n)} soalan telah diluluskan.`,
  bulkRejected: (n: number) => `${String(n)} soalan telah ditolak.`,
  bulkDeleted: (n: number) => `${String(n)} soalan telah dipadam.`,
} as const

/** Proposed caps (flagged in the BE-42 report). */
export const PKSK_ADMIN_QUESTION_TEXT_MAX = 2000
export const PKSK_ADMIN_EXPLANATION_MAX = 2000
export const PKSK_ADMIN_OPTION_TEXT_MAX = 500
export const PKSK_ADMIN_BULK_MAX = 100
export const PKSK_ADMIN_SEARCH_MAX = 100
/** Hard cap of the options array before the 2 to 6 rule (memory guard; the mock has none). */
const OPTIONS_HARD_MAX = 50
/** Fixed page size of both lists (mock `ADMIN_PAGE_SIZE`, `ACCESS_PAGE_SIZE`); `pageSize` is not read. */
export const PKSK_ADMIN_PAGE_SIZE = 20

const M = PKSK_ADMIN_MESSAGES

// ---------------------------------------------------------------------------------------------
// Field-error mapping
// ---------------------------------------------------------------------------------------------

/**
 * Maps a zod error of a request schema in this file to the mock's `fields`: one message per
 * top-level key (`options.1.text` becomes `options`), the shallowest issue winning, otherwise the
 * first. Unknown keys (strict objects) are reported under their own name.
 */
export function pkskAdminFieldErrors(error: { issues: readonly z.core.$ZodIssue[] }): Record<string, string> {
  const best = new Map<string, { depth: number; message: string }>()
  const put = (key: string, depth: number, message: string) => {
    const current = best.get(key)
    if (current === undefined || depth < current.depth) best.set(key, { depth, message })
  }
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys' && issue.path.length === 0) {
      for (const key of issue.keys) put(key, 0, issue.message)
      continue
    }
    const key = issue.path[0]
    if (typeof key === 'string') put(key, issue.path.length, issue.message)
  }
  return Object.fromEntries([...best].map(([key, value]) => [key, value.message]))
}

// ---------------------------------------------------------------------------------------------
// Building blocks
// ---------------------------------------------------------------------------------------------

/** A decimal-string id in a request body; every failure (missing, wrong type, not digits) has `message`. */
const idInput = (message: string) =>
  z
    .string({ error: message })
    .regex(/^\d{1,19}$/, { error: message })
    .pipe(IdSchema)

const trimmedText = (required: string, max: number, maxMessage: string) =>
  z.string({ error: required }).trim().min(1, { error: required }).max(max, { error: maxMessage })

const QueryPageSchema = z.coerce
  .number()
  .int()
  .min(1)
  .optional()
  .meta({ description: 'Page number, 1-based. The page size is fixed at 20 and `pageSize` is not read. An invalid value is read as 1.' })

const searchField = z
  .string()
  .max(PKSK_ADMIN_SEARCH_MAX, { error: M.searchMax })
  .optional()

/** `{ data, status }` of a mutating route: `status` is the BM flash text. */
function mutationOf<T extends z.ZodType>(data: T) {
  return z.object({
    data,
    status: z.string().min(1).meta({ description: 'BM flash text for the success message.' }),
  })
}

// ---------------------------------------------------------------------------------------------
// Questions (M07-10 to M07-16)
// ---------------------------------------------------------------------------------------------

/** M07-10 query. Filter values compare case-insensitively; an unknown value returns an empty page. */
export const PkskAdminQuestionListQuerySchema = z
  .strictObject({
    bahagian: z.string().max(20).optional().meta({ description: 'A, B or C, case-insensitive. Unknown value: empty page.' }),
    level: z.string().max(20).optional().meta({ description: 'T1 or T4, case-insensitive. Unknown value: empty page.' }),
    status: z.string().max(20).optional().meta({ description: 'pending, approved or rejected, case-insensitive. Unknown value: empty page.' }),
    search: searchField.meta({ description: 'Trimmed, case-insensitive substring of the question text.' }),
    page: QueryPageSchema,
  })
  .meta({ id: 'PkskAdminQuestionListQuery' })
export type PkskAdminQuestionListQuery = z.infer<typeof PkskAdminQuestionListQuerySchema>

/** Row of M07-10: `created_at` descending, then `id` ascending; 20 per page. */
export const PkskAdminQuestionListItemSchema = z
  .object({
    id: IdSchema,
    questionText: z.string(),
    bahagian: PkskBahagianSchema,
    domain: PkskDomainRefSchema,
    targetLevel: PkskLevelSchema,
    status: PkskQuestionStatusSchema,
  })
  .meta({ id: 'PkskAdminQuestionListItem' })
export type PkskAdminQuestionListItem = z.infer<typeof PkskAdminQuestionListItemSchema>

export const PkskAdminQuestionListResponseSchema = z
  .object({ data: z.array(PkskAdminQuestionListItemSchema).max(PKSK_ADMIN_PAGE_SIZE), meta: ListMetaSchema })
  .meta({ id: 'PkskAdminQuestionListResponse' })

/** M07-11: counts over all PKSK questions (T1 and T4 count every status). */
export const PkskAdminQuestionStatsSchema = z
  .object({
    total: z.number().int().min(0),
    approved: z.number().int().min(0),
    pending: z.number().int().min(0),
    t1: z.number().int().min(0),
    t4: z.number().int().min(0),
  })
  .meta({ id: 'PkskAdminQuestionStats' })
export type PkskAdminQuestionStats = z.infer<typeof PkskAdminQuestionStatsSchema>

/** An option of the detail: several or no option may be flagged correct (BR-M07-04). */
export const PkskAdminQuestionOptionSchema = z
  .object({ text: z.string(), isCorrect: z.boolean() })
  .meta({ id: 'PkskAdminQuestionOption' })

/** M07-13, and `data` of M07-14 and M07-15. `options` is empty for Bahagian C. */
export const PkskAdminQuestionDetailSchema = z
  .object({
    id: IdSchema,
    bahagian: PkskBahagianSchema,
    pkskDomainId: IdSchema,
    pkskTargetLevel: PkskLevelSchema,
    status: PkskQuestionStatusSchema,
    questionText: z.string(),
    difficultyLevel: z.number().int().min(1).max(5).nullable(),
    explanation: z.string().nullable(),
    options: z.array(PkskAdminQuestionOptionSchema),
  })
  .meta({ id: 'PkskAdminQuestionDetail' })
export type PkskAdminQuestionDetail = z.infer<typeof PkskAdminQuestionDetailSchema>

export const PkskAdminQuestionDetailResponseSchema = z
  .object({ data: PkskAdminQuestionDetailSchema })
  .meta({ id: 'PkskAdminQuestionDetailResponse' })

export const PkskAdminQuestionMutationResponseSchema = mutationOf(PkskAdminQuestionDetailSchema).meta({
  id: 'PkskAdminQuestionMutationResponse',
})

/** An option in a create or update body (`isCorrect` defaults to false when absent). */
export const PkskAdminOptionInputSchema = z
  .strictObject(
    {
      text: trimmedText(M.optionText, PKSK_ADMIN_OPTION_TEXT_MAX, M.optionTextMax),
      isCorrect: z.boolean().default(false),
    },
    { error: M.optionText },
  )
  .meta({ id: 'PkskAdminOptionInput' })
export type PkskAdminOptionInput = z.infer<typeof PkskAdminOptionInputSchema>

const explanationInput = z
  .string()
  .max(PKSK_ADMIN_EXPLANATION_MAX, { error: M.explanationMax })
  .nullish()
  .meta({ description: 'Plain text. Blank or null stores no explanation (create), and clears it (update, when the key is sent).' })

const difficultyInput = (required: boolean) => {
  const base = z
    .number({ error: M.difficulty })
    .int({ error: M.difficulty })
    .min(1, { error: M.difficulty })
    .max(5, { error: M.difficulty })
  return required ? base : base.nullish()
}

/**
 * M07-14 body. Bahagian A and B need 2 to 6 options; Bahagian C stores none (any well-formed
 * options sent for C are ignored). The domain must belong to `bahagian` (service rule). Saved
 * `approved` (BR-M07-03), so there is no `status` key.
 */
export const PkskAdminQuestionCreateSchema = z
  .strictObject({
    bahagian: z.enum(PKSK_BAHAGIAN, { error: M.bahagian }),
    pkskDomainId: idInput(M.domain),
    pkskTargetLevel: z.enum(PKSK_LEVELS, { error: M.level }),
    questionText: trimmedText(M.questionText, PKSK_ADMIN_QUESTION_TEXT_MAX, M.questionTextMax),
    difficultyLevel: difficultyInput(true).meta({ description: 'Required, integer 1 to 5.' }),
    explanation: explanationInput,
    options: z
      .array(PkskAdminOptionInputSchema, { error: M.optionsCount })
      .max(OPTIONS_HARD_MAX, { error: M.optionsCount })
      .optional()
      .meta({ description: 'Bahagian A and B: required, 2 to 6 options with non-empty text. Bahagian C: ignored.' }),
  })
  .refine(
    (value) => {
      // `value` can be partial or not an object here (the refinement runs even when other fields failed).
      const input = (typeof value === 'object' && value !== null ? value : {}) as {
        bahagian?: unknown
        options?: unknown
      }
      if (input.bahagian === 'C') return true
      const options = input.options
      return Array.isArray(options) && options.length >= 2 && options.length <= 6
    },
    { path: ['options'], error: M.optionsCount, when: () => true },
  )
  .meta({ id: 'PkskAdminQuestionCreate' })
export type PkskAdminQuestionCreate = z.infer<typeof PkskAdminQuestionCreateSchema>

/**
 * M07-15 body. `status` is required (any status may follow any other, BR-M07-02). An absent or null
 * `difficultyLevel` keeps the stored value. Absent `options` keep the stored options when at least 2
 * exist and the domain is A or B; otherwise `options` is required (service rule, `fields.options`
 * count message). When sent, options are validated as 2 to 6 (ignored by the service when the
 * domain is Bahagian C; a count outside 2 to 6 is rejected here even for C, stricter than the mock).
 */
export const PkskAdminQuestionUpdateSchema = z
  .strictObject({
    pkskDomainId: idInput(M.domain),
    pkskTargetLevel: z.enum(PKSK_LEVELS, { error: M.level }),
    status: z.enum(PKSK_QUESTION_STATUSES, { error: M.status }),
    questionText: trimmedText(M.questionText, PKSK_ADMIN_QUESTION_TEXT_MAX, M.questionTextMax),
    difficultyLevel: difficultyInput(false).meta({ description: 'Optional, integer 1 to 5; absent or null keeps the stored value.' }),
    explanation: explanationInput,
    options: z
      .array(PkskAdminOptionInputSchema, { error: M.optionsCount })
      .min(2, { error: M.optionsCount })
      .max(6, { error: M.optionsCount })
      .optional(),
  })
  .meta({ id: 'PkskAdminQuestionUpdate' })
export type PkskAdminQuestionUpdate = z.infer<typeof PkskAdminQuestionUpdateSchema>

/** M07-12 action. */
export const PKSK_ADMIN_BULK_ACTIONS = ['approve', 'reject', 'delete'] as const
export const PkskAdminBulkActionSchema = z
  .enum(PKSK_ADMIN_BULK_ACTIONS, { error: M.action })
  .meta({ id: 'PkskAdminBulkAction' })
export type PkskAdminBulkAction = z.infer<typeof PkskAdminBulkActionSchema>

/**
 * M07-12 body. Every id must be a PKSK question, otherwise nothing changes and `fields.ids` is
 * returned (service rule). Duplicates count once. `approve` sets approved, `reject` sets rejected.
 */
export const PkskAdminBulkRequestSchema = z
  .strictObject({
    action: PkskAdminBulkActionSchema,
    ids: z
      .array(idInput(M.ids), { error: M.ids })
      .min(1, { error: M.ids })
      .max(PKSK_ADMIN_BULK_MAX, { error: M.idsMax }),
  })
  .meta({ id: 'PkskAdminBulkRequest' })
export type PkskAdminBulkRequest = z.infer<typeof PkskAdminBulkRequestSchema>

export const PkskAdminBulkResultSchema = z
  .object({ affected: z.number().int().min(0) })
  .meta({ id: 'PkskAdminBulkResult' })

export const PkskAdminBulkResponseSchema = mutationOf(PkskAdminBulkResultSchema).meta({
  id: 'PkskAdminBulkResponse',
})

// ---------------------------------------------------------------------------------------------
// Access grants (M07-17 to M07-20) and packages (M07-21)
// ---------------------------------------------------------------------------------------------

export const PKSK_ADMIN_ACCESS_STATUSES = ['active', 'revoked'] as const
export const PkskAdminAccessStatusSchema = z
  .enum(PKSK_ADMIN_ACCESS_STATUSES)
  .meta({ id: 'PkskAdminAccessStatus', description: 'Stored status of a grant.' })

export const PKSK_ADMIN_ACCESS_DISPLAY_STATUSES = ['active', 'expired', 'revoked'] as const
export const PkskAdminAccessDisplayStatusSchema = z.enum(PKSK_ADMIN_ACCESS_DISPLAY_STATUSES).meta({
  id: 'PkskAdminAccessDisplayStatus',
  description: 'Computed: revoked, else expired when expiresAt is before today (Malaysia date), else active.',
})

/** M07-17 query. */
export const PkskAdminAccessListQuerySchema = z
  .strictObject({
    search: searchField.meta({ description: 'Trimmed, case-insensitive substring of the user name or e-mail.' }),
    page: QueryPageSchema,
  })
  .meta({ id: 'PkskAdminAccessListQuery' })
export type PkskAdminAccessListQuery = z.infer<typeof PkskAdminAccessListQuerySchema>

/** A grant as listed, returned by grant and revoke. Personal data of paying users: never cached. */
export const PkskAdminAccessItemSchema = z
  .object({
    id: IdSchema,
    user: z.object({
      id: IdSchema,
      name: z.string(),
      email: z.string().nullable().meta({
        description:
          'Nullable in v2 (matches BE-05: accounts may have no e-mail; LEAD 2026-10-19). The mock sends a string (empty when the user is gone).',
      }),
    }),
    package: z.object({ id: IdSchema, name: z.string(), level: PkskPackageLevelSchema }),
    grantedBy: z.object({ id: IdSchema, name: z.string() }).nullable(),
    grantedAt: TimestampSchema,
    expiresAt: DateOnlySchema.nullable().meta({ description: 'Valid through the end of that day (Malaysia).' }),
    status: PkskAdminAccessStatusSchema,
    displayStatus: PkskAdminAccessDisplayStatusSchema,
  })
  .meta({ id: 'PkskAdminAccessItem' })
export type PkskAdminAccessItem = z.infer<typeof PkskAdminAccessItemSchema>

/** `granted_at` descending, then `id` descending; 20 per page. */
export const PkskAdminAccessListResponseSchema = z
  .object({ data: z.array(PkskAdminAccessItemSchema).max(PKSK_ADMIN_PAGE_SIZE), meta: ListMetaSchema })
  .meta({ id: 'PkskAdminAccessListResponse' })

/** M07-18: active rows only; a Kombo counts in both t1 and t4; subscription and admin role are not counted. */
export const PkskAdminAccessStatsSchema = z
  .object({
    activeTotal: z.number().int().min(0),
    t1: z.number().int().min(0),
    t4: z.number().int().min(0),
  })
  .meta({ id: 'PkskAdminAccessStats' })
export type PkskAdminAccessStats = z.infer<typeof PkskAdminAccessStatsSchema>

/**
 * M07-19 body. `userId` must be an existing user and `packageId` an existing package (service
 * rules, same messages). `expiresAt` is optional: a real calendar date, no bounds (a past date
 * gives an already-expired row). Duplicates are allowed (BR-M07-14). The mock also reads a blank
 * string as no expiry; the canonical form is an absent key or null.
 */
export const PkskAdminAccessGrantSchema = z
  .strictObject({
    userId: idInput(M.userNotFound),
    packageId: idInput(M.package),
    expiresAt: z.iso.date({ error: M.expiresAt }).nullish(),
  })
  .meta({ id: 'PkskAdminAccessGrant' })
export type PkskAdminAccessGrant = z.infer<typeof PkskAdminAccessGrantSchema>

export const PkskAdminAccessMutationResponseSchema = mutationOf(PkskAdminAccessItemSchema).meta({
  id: 'PkskAdminAccessMutationResponse',
})

/** M07-21: one of the 3 fixed packages (reference data). */
export const PkskPackageSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1).max(100),
    level: PkskPackageLevelSchema,
  })
  .meta({ id: 'PkskPackage' })
export type PkskPackage = z.infer<typeof PkskPackageSchema>

/** `data` is a bare array of the 3 packages by id. */
export const PkskPackageListResponseSchema = z
  .object({ data: z.array(PkskPackageSchema) })
  .meta({ id: 'PkskPackageListResponse' })

export const PkskAdminAccessStatsResponseSchema = z.object({ data: PkskAdminAccessStatsSchema })
export const PkskAdminQuestionStatsResponseSchema = z.object({ data: PkskAdminQuestionStatsSchema })
