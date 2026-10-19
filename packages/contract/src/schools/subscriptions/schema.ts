import { z } from '../../zod'
import { ListMetaSchema } from '../../common/envelope'
import { ErrorPayloadSchema } from '../../common/error'
import { IdSchema } from '../../common/ids'
import { DateOnlySchema, TimestampSchema } from '../../common/time'
import { dateField, digitInt, enumField, optionalText, refusalOf, requiredMessage, requiredText } from './validation'

/**
 * M02 school subscriptions, packages, user packages, complimentary students, the DELIMa student
 * import and the school quota (BE-25, contract-only). Source: the M02 mock handlers
 * (`subscriptions.ts`, `users-packages.ts`, `comp-students.ts`, `imports.ts`) and `quota.ts`, with
 * `api/*`. Ids are opaque strings, timestamps are `+08:00`, money is a decimal string ("30.00").
 * `legacy_*` columns and a clear IC never appear. Fields are named like the mock (camelCase).
 * Ids are opaque, never sequential on the wire (BE-NFR-25). Shape-error copy is the mock English Laravel template
 * (deviation to list: mixed BM and English); BM copy is kept for domain refusals. All routes are central-admin only
 * except the parent-invite routes; D57(a): every write route documents 429 RATE_LIMITED with Retry-After.
 */

/** `{ data, status }`: the mock `raw` body of a mutation (`status` is the BM flash text). */
export function subscriptionStatusEnvelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string().min(1).meta({ description: 'BM flash text for display.' }) })
}

/** Limits and fixed sizes read from the mock constants. */
export const SUBSCRIPTION_QUOTA_MIN = 1
export const SUBSCRIPTION_QUOTA_MAX = 2000
export const SUBSCRIPTION_EXTEND_DAYS_MIN = 1
export const SUBSCRIPTION_EXTEND_DAYS_MAX = 365
export const SUBSCRIPTION_PER_PAGE_OPTIONS = [25, 50, 100, 200] as const
export const SUBSCRIPTION_DEFAULT_PER_PAGE = 50
export const COMP_STUDENTS_PAGE_SIZE = 50
export const COMP_USERNAME_DOMAIN = '@prestasiplus.my'
export const STUDENT_IMPORT_NAME_MAX = 255
/** Added in v2 (security review): the mock has no limit. Over either limit the import is refused with 413 PAYLOAD_TOO_LARGE. */
export const STUDENT_IMPORT_MAX_ROWS = 1000
export const STUDENT_IMPORT_MAX_BYTES = 1_000_000
export const COMP_BULK_MAX_IDS = 200
export const SEARCH_MAX = 100
export const PAYMENT_REFERENCE_MAX = 255
export const FREE_TEXT_MAX = 1000
export const STUDENT_IMPORT_IC_MAX = 14
export const COMP_IC_MIN_DIGITS = 6

/** Exact BM copy of the mock (UNVERIFIED COPY in the SRS, kept as the contract). */
export const SUBSCRIPTION_MESSAGES = {
  created: 'Langganan berjaya dicipta.',
  quotaUpdated: 'Kuota berjaya dikemaskini.',
  extended: 'Tempoh langganan berjaya dilanjutkan.',
  upgraded: 'Langganan berjaya dinaik taraf.',
  cancelled: 'Langganan berjaya dibatalkan.',
  notBasic: 'Hanya langganan Pemantauan boleh dinaik taraf.',
  alreadyCancelled: 'Langganan ini sudah dibatalkan.',
} as const
export const SCHOOL_PACKAGE_MESSAGES = {
  assigned: 'Pakej berjaya ditetapkan.',
  notSchoolAdmin: 'Pengguna ini bukan admin sekolah.',
} as const
export const COMP_STUDENT_MESSAGES = {
  actionDone: 'Tindakan berjaya dilaksanakan.',
  badLine: 'Format baris tidak sah. Gunakan NAMA, NOKP.',
  shortIc: 'No. KP mesti sekurang-kurangnya 6 digit.',
} as const
export const compStudentsCreatedText = (n: number): string => `${String(n)} pelajar komplimen berjaya didaftarkan.`
export const STUDENT_IMPORT_MESSAGES = {
  noData: 'Tiada data untuk diimport.',
  noSubscription: 'Sekolah ini tiada langganan aktif. Import pelajar tidak dibenarkan.',
  quotaShort: 'Kuota tidak mencukupi.',
  noName: 'Nama diperlukan.',
  nameLong: 'Nama tidak boleh melebihi 255 aksara.',
  badDelimaEmail: 'Emel DELIMa tidak sah.',
  noDelimaPassword: 'Kata laluan DELIMa diperlukan.',
  icLong: 'Nombor IC tidak boleh melebihi 14 aksara.',
  tooLarge: 'Fail import melebihi had yang dibenarkan.',
} as const
export const studentsImportedText = (r: { created: number; skipped: number }): string =>
  `Import selesai: ${String(r.created)} pelajar didaftarkan, ${String(r.skipped)} dilangkau.`

const count = () => z.number().int().min(0)
const decimal = (what: string) =>
  z.string().regex(/^\d+\.\d{2}$/, `${what} must be a decimal string with 2 places`)

/** Minimal school projection embedded in responses (overlaps BE-05 `SchoolSummary`; reconcile). */
export const SubscriptionSchoolSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    code: z.string(),
    type: z.string().min(1),
    state: z.string().min(1),
    district: z.string().nullable(),
    city: z.string().nullable(),
  })
  .meta({ id: 'SubscriptionSchool' })

export const SUBSCRIPTION_STATUSES = ['active', 'grace', 'expired', 'cancelled'] as const
export const SubscriptionStatusSchema = z.enum(SUBSCRIPTION_STATUSES).meta({ id: 'SubscriptionStatus' })
export const SUBSCRIPTION_TIERS = ['basic', 'full'] as const
export const SubscriptionTierSchema = z
  .enum(SUBSCRIPTION_TIERS)
  .meta({ id: 'SubscriptionTier', description: '`basic` = Pemantauan (500 questions/month), `full` = Penuh.' })
export const SCHOOL_FORM_LEVELS = ['t4', 't5', 'd1_d6', 't1_t3'] as const
export const SchoolPackageFormLevelSchema = z.enum(SCHOOL_FORM_LEVELS).meta({ id: 'SchoolPackageFormLevel' })

export const SchoolPackageSchema = z
  .object({
    id: IdSchema,
    code: z.enum(['T4', 'T5', 'D1_D6', 'T1_T3']),
    name: z.string().min(1),
    slug: z.string().min(1),
    educationLevel: z.enum(['spm', 'primary', 'lower_secondary']),
    formLevel: SchoolPackageFormLevelSchema,
    priceAnnual: decimal('priceAnnual'),
    maxRenewals: count().meta({ description: 'Term years = maxRenewals + 1.' }),
    isActive: z.boolean(),
  })
  .meta({ id: 'SchoolPackage' })

export const SubscriptionListQuerySchema = z
  .object({
    search: z.string().max(SEARCH_MAX).optional().meta({ description: 'Substring of school name or code (at most 100 characters).' }),
    status: z.string().optional().meta({ description: 'Exact status; an unknown value matches nothing.' }),
    formLevel: z.string().optional().meta({ description: 'Exact form level; an unknown value matches nothing.' }),
  })
  .meta({ id: 'SubscriptionListQuery' })

export const SubscriptionListItemSchema = z
  .object({
    id: IdSchema,
    school: z.object({ id: IdSchema, name: z.string().min(1), code: z.string() }),
    formLevel: SchoolPackageFormLevelSchema,
    packageTier: SubscriptionTierSchema,
    used: count().meta({ description: 'Students of the school, active and inactive.' }),
    studentQuota: z.number().int().min(1),
    status: SubscriptionStatusSchema,
    startsAt: TimestampSchema,
    endsAt: TimestampSchema,
  })
  .meta({ id: 'SubscriptionListItem' })

/** Not paginated, newest first (id desc); `counts` are over all rows, `totalQuota` = active rows only. */
export const SubscriptionListMetaSchema = ListMetaSchema.extend({
  counts: z.object({ active: count(), grace: count(), expired: count(), totalQuota: count() }),
}).meta({ id: 'SubscriptionListMeta' })

/** The subscription with its derived fields; also the data of every mutation. */
export const SubscriptionDetailSchema = z
  .object({
    id: IdSchema,
    schoolId: IdSchema,
    schoolPackageId: IdSchema,
    packageTier: SubscriptionTierSchema,
    studentQuota: z.number().int().min(1),
    used: count(),
    status: SubscriptionStatusSchema,
    startsAt: TimestampSchema,
    endsAt: TimestampSchema,
    questionLimit: z.number().int().min(1).nullable().meta({ description: '500 for basic; null = unlimited.' }),
    paymentReference: z.string().nullable(),
    paymentNotes: z.string().nullable(),
    notes: z.string().nullable().meta({ description: 'History lines, one per entry, newline-joined.' }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
    formLevel: SchoolPackageFormLevelSchema,
    remaining: count().meta({ description: 'max(0, studentQuota - used).' }),
    usedPercent: z.number().int().min(0).max(100),
    school: SubscriptionSchoolSchema,
    package: SchoolPackageSchema,
  })
  .meta({ id: 'SubscriptionDetail' })

const quotaField = () => digitInt('studentQuota', { min: SUBSCRIPTION_QUOTA_MIN, max: SUBSCRIPTION_QUOTA_MAX })
/** A required id in a request body (string; the mock also accepts a digit number). */
const idField = (field: string) => z.string({ error: () => requiredMessage(field) }).min(1, requiredMessage(field)).max(64)

export const SubscriptionCreateRequestSchema = z
  .object({
    schoolId: idField('schoolId').meta({ description: 'Must be an ACTIVE school (422 fields.schoolId "The selected school id is invalid."). Central admin only: schoolId is legitimate in the body only because the caller is admin.' }),
    packageTier: enumField('packageTier', SUBSCRIPTION_TIERS),
    schoolPackageId: idField('schoolPackageId'),
    studentQuota: quotaField(),
    paymentReference: optionalText('paymentReference', 255),
    paymentNotes: optionalText('paymentNotes'),
  })
  .meta({ id: 'SubscriptionCreateRequest' })

export const SubscriptionQuotaRequestSchema = z
  .object({ studentQuota: quotaField(), notes: optionalText('notes').meta({ description: 'Reason; appended to the history only when given.' }) })
  .meta({ id: 'SubscriptionQuotaRequest' })

export const SubscriptionExtendRequestSchema = z
  .object({
    days: digitInt('days', { min: SUBSCRIPTION_EXTEND_DAYS_MIN, max: SUBSCRIPTION_EXTEND_DAYS_MAX }),
    reason: optionalText('reason'),
  })
  .meta({ id: 'SubscriptionExtendRequest' })

export const SubscriptionUpgradeRequestSchema = z
  .object({ paymentReference: optionalText('paymentReference', 255), paymentNotes: optionalText('paymentNotes') })
  .meta({ id: 'SubscriptionUpgradeRequest' })

export const SubscriptionStudentsQuerySchema = z
  .object({
    perPage: z.string().optional().meta({ description: '25, 50, 100 or 200. Never rejected: anything else (unknown or not a number) answers 50.' }),
    page: z.string().optional().meta({ description: 'Never rejected: a missing, zero, negative or non-numeric value is page 1.' }),
  })
  .meta({ id: 'SubscriptionStudentsQuery' })

export const SubscriptionStudentSchema = z
  .object({ id: IdSchema, name: z.string().min(1), idDelima: z.string().nullable(), classLevel: z.string().nullable() })
  .meta({ id: 'SubscriptionStudent' })

export const SubscriptionRenewalInvoiceSchema = z
  .object({
    ref: z.string().regex(/^INV-.+-\d{8}$/).meta({ description: 'INV-{subscription id}-{yyyymmdd of today}.' }),
    date: TimestampSchema,
    school: SubscriptionSchoolSchema,
    packageName: z.string().min(1),
    currentPeriod: z.object({ start: TimestampSchema, end: TimestampSchema }),
    renewalPeriod: z.object({ start: TimestampSchema, end: TimestampSchema }).meta({ description: 'endsAt to endsAt + 12 months.' }),
    studentCount: count(),
    pricePerStudent: decimal('pricePerStudent'),
    total: decimal('total').meta({ description: 'Enrolled students x price (not the quota), computed in integer cents.' }),
  })
  .meta({
    id: 'SubscriptionRenewalInvoice',
    description: 'v2: no student roster and no idDelima (minors personal data); the roster is the paginated /students endpoint. Cache-Control: no-store.',
  })

/** GET /admin/schools/{id}/quota. `hasSubscription: false` carries no other field. */
export const QuotaSchema = z
  .discriminatedUnion('hasSubscription', [
    z.object({ hasSubscription: z.literal(false) }),
    z.object({
      hasSubscription: z.literal(true),
      quota: z.number().int().min(1),
      used: count().meta({ description: 'Students of the school, active and inactive.' }),
      remaining: count().meta({ description: 'max(0, quota - used).' }),
    }),
  ])
  .meta({ id: 'SchoolQuota' })

/** User packages (S16): the two SPM cards a school admin can be given. */
export const SCHOOL_ADMIN_FORM_LEVELS = ['t4', 't5'] as const
export const SchoolPackageAdminFormLevelSchema = z.enum(SCHOOL_ADMIN_FORM_LEVELS).meta({ id: 'SchoolPackageAdminFormLevel' })

export const SchoolPackageCardSchema = z
  .object({
    formLevel: SchoolPackageAdminFormLevelSchema,
    packageId: IdSchema.meta({ description: 'The t4 / t5 school package id (mock 1 and 2).' }),
    code: z.enum(['T4', 'T5']),
    name: z.string().min(1),
    priceLabel: z.string().min(1).meta({ example: 'RM 30/pelajar · 2 tahun' }),
    years: z.number().int().min(1),
    assigned: z.object({ studentQuota: z.number().int().min(1), assignedAt: TimestampSchema }).nullable(),
  })
  .meta({ id: 'SchoolPackageCard' })

export const SchoolPackageUserViewSchema = z
  .object({
    user: z.object({ id: IdSchema, name: z.string().min(1) }),
    school: SubscriptionSchoolSchema.nullable(),
    packages: z.array(SchoolPackageCardSchema),
    existingT5Count: count().meta({ description: 'Students of the school with grade 11.' }),
  })
  .meta({ id: 'SchoolPackageUserView' })

export const SchoolPackageAssignRequestSchema = z
  .object({
    formLevel: enumField('formLevel', SCHOOL_ADMIN_FORM_LEVELS),
    packageId: idField('packageId'),
    studentQuota: quotaField(),
  })
  .meta({ id: 'SchoolPackageAssignRequest', description: 'packageId must pair with formLevel (t4 first package, t5 second).' })

export const SchoolPackageAssignmentSchema = z
  .object({
    id: IdSchema,
    userId: IdSchema,
    formLevel: SchoolPackageAdminFormLevelSchema,
    packageId: IdSchema,
    studentQuota: z.number().int().min(1),
    assignedAt: TimestampSchema,
  })
  .meta({ id: 'SchoolPackageAssignment' })

/** Complimentary students. `icMasked` replaces the mock `icNumber` (only the masked form leaves the API). */
export const CompIcMaskedSchema = z
  .string()
  .regex(/^xxxxxx-xx-xx\d{2}$/, 'IC must be the masked form xxxxxx-xx-xxNN')
  .meta({ id: 'CompIcMasked', example: 'xxxxxx-xx-xx34' })

export const CompStudentListQuerySchema = z
  .object({ page: z.string().optional() })
  .meta({ id: 'CompStudentListQuery', description: 'Page size is fixed at 50. `page` is never rejected: a missing, zero, negative or non-numeric value is page 1.' })

export const CompStudentListItemSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    username: z.string().min(1).meta({ description: 'Opaque login e-mail generated by the server (v2: not derived from the IC; the mock used "{last 6 IC digits}@prestasiplus.my"). Clients must not parse it.' }),
    icMasked: CompIcMaskedSchema.nullable(),
    schoolName: z.string().nullable(),
    classLabel: z.string().meta({ description: 'First active class name; "" when none.' }),
    teacherName: z.string().meta({ description: '"" when none.' }),
    isActive: z.boolean(),
    coinsEnabled: z.boolean(),
    packageExpiresAt: DateOnlySchema,
  })
  .meta({ id: 'CompStudentListItem' })

export const CompStudentListMetaSchema = ListMetaSchema.extend({
  counts: z.object({ coinsOff: count(), total: count() }),
}).meta({ id: 'CompStudentListMeta' })

export const CompStudentClassSchema = z
  .object({
    name: z.string().min(1),
    classCode: z.string().min(1),
    subjectName: z.string().nullable(),
    teacherName: z.string(),
    status: z.enum(['active', 'removed']),
  })
  .meta({ id: 'CompStudentClass' })

export const CompStudentDetailSchema = z
  .object({
    userId: IdSchema,
    username: z.string().min(1),
    name: z.string().min(1),
    icMasked: CompIcMaskedSchema.nullable(),
    classLevel: z.string().nullable(),
    isActive: z.boolean(),
    coinsEnabled: z.boolean(),
    packageExpiresAt: DateOnlySchema,
    originalSchoolName: z.string().nullable(),
    classLabel: z.string(),
    teacherName: z.string(),
    syilingBalance: count().meta({ description: 'Read-only here (wallet owner).' }),
    coinBalance: count(),
    classes: z.array(CompStudentClassSchema),
  })
  .meta({ id: 'CompStudentDetail' })

export const CompStudentRegisterRequestSchema = z
  .object({
    classroomId: idField('classroomId').meta({ description: 'Must be an active classroom (422 "The selected classroom id is invalid.").' }),
    packageExpiresAt: dateField('packageExpiresAt'),
    students: requiredText('students').meta({ description: 'One "NAMA, NOKP" per line; the IC follows the last comma, non-digits stripped.' }),
  })
  .meta({ id: 'CompStudentRegisterRequest' })

export const StudentImportRowErrorSchema = z
  .object({ line: z.number().int().min(1).meta({ description: '1-based line of the file or paste.' }), message: z.string().min(1) })
  .meta({ id: 'StudentImportRowError' })

/** `errors` lists the failed lines only. Also the result of the complimentary register. */
export const StudentImportResultSchema = z
  .object({ created: count(), skipped: count(), failed: count(), errors: z.array(StudentImportRowErrorSchema) })
  .meta({ id: 'StudentImportResult' })

export const COMP_BULK_ACTIONS = ['coins_off', 'coins_on', 'deactivate', 'activate'] as const
export const CompBulkActionSchema = z.enum(COMP_BULK_ACTIONS).meta({ id: 'CompBulkAction' })
export const CompBulkActionRequestSchema = z
  .object({
    action: enumField('action', COMP_BULK_ACTIONS),
    ids: z.array(IdSchema, { error: () => requiredMessage('ids') }).min(1, requiredMessage('ids')).max(COMP_BULK_MAX_IDS),
  })
  .meta({ id: 'CompBulkActionRequest', description: 'Ids that are not complimentary students are ignored.' })
export const CompBulkActionResultSchema = z.object({ updated: count() }).meta({ id: 'CompBulkActionResult' })
export const CompToggleCoinsResultSchema = z.object({ coinsEnabled: z.boolean() }).meta({ id: 'CompToggleCoinsResult' })
export const CompToggleActiveResultSchema = z.object({ isActive: z.boolean() }).meta({ id: 'CompToggleActiveResult' })

/** POST /admin/students/import (S5). Overlaps the BE-05 `ClassLevel`; kept local. */
export const STUDENT_IMPORT_CLASS_LEVELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5'] as const
export const StudentImportClassLevelSchema = z.enum(STUDENT_IMPORT_CLASS_LEVELS).meta({ id: 'StudentImportClassLevel' })
export const STUDENT_IMPORT_MODES = ['csv', 'paste'] as const
export const StudentImportModeSchema = z.enum(STUDENT_IMPORT_MODES).meta({ id: 'StudentImportMode' })

/**
 * JSON form. CSV rows are `name, email, password, ic?`; paste blocks are separated by blank lines
 * (name, DELIMa e-mail, password, optional IC). The mock sets no file-size or row-count limit.
 * Zero data rows is 422 "Tiada data untuk diimport." on `fields.csvFile` or `fields.pasteContent`.
 */
export const StudentImportRequestSchema = z
  .object({
    schoolId: idField('schoolId'),
    classLevel: enumField('classLevel', STUDENT_IMPORT_CLASS_LEVELS),
    importMode: enumField('importMode', STUDENT_IMPORT_MODES),
    csvFile: z.string().max(STUDENT_IMPORT_MAX_BYTES).nullish().meta({ description: 'CSV text, used when importMode is csv (at most 1 MB and 1000 rows).' }),
    pasteContent: z.string().max(STUDENT_IMPORT_MAX_BYTES).nullish().meta({ description: 'Used when importMode is paste (same limits).' }),
  })
  .meta({ id: 'StudentImportRequest' })

/** The same request as multipart/form-data: every value is text and `csvFile` is the uploaded file. */
export const StudentImportMultipartSchema = z
  .object({
    schoolId: idField('schoolId'),
    classLevel: enumField('classLevel', STUDENT_IMPORT_CLASS_LEVELS),
    importMode: enumField('importMode', STUDENT_IMPORT_MODES),
    csvFile: z.string().meta({ format: 'binary' }).nullish(),
    pasteContent: z.string().max(STUDENT_IMPORT_MAX_BYTES).nullish(),
  })
  .meta({ id: 'StudentImportMultipartRequest' })

/**
 * 422s the mock raises from server state, each on the field the mock uses with the exact BM copy.
 * (Shape errors above use the mock English templates through `validation.ts`.)
 */
export const SubscriptionUpgradeRefusalSchema = refusalOf('packageTier', SUBSCRIPTION_MESSAGES.notBasic).meta({ id: 'SubscriptionUpgradeRefusal' })
export const SubscriptionCancelRefusalSchema = refusalOf('status', SUBSCRIPTION_MESSAGES.alreadyCancelled).meta({ id: 'SubscriptionCancelRefusal' })
export const SchoolPackageNotAdminRefusalSchema = refusalOf('id', SCHOOL_PACKAGE_MESSAGES.notSchoolAdmin).meta({ id: 'SchoolPackageNotAdminRefusal' })
export const StudentImportNoSubscriptionRefusalSchema = refusalOf('schoolId', STUDENT_IMPORT_MESSAGES.noSubscription).meta({ id: 'StudentImportNoSubscriptionRefusal' })
export const StudentImportQuotaShortRefusalSchema = refusalOf('schoolId', STUDENT_IMPORT_MESSAGES.quotaShort).meta({ id: 'StudentImportQuotaShortRefusal' })
export const StudentImportNoDataRefusalSchema = z
  .union([refusalOf('csvFile', STUDENT_IMPORT_MESSAGES.noData), refusalOf('pasteContent', STUDENT_IMPORT_MESSAGES.noData)])
  .meta({ id: 'StudentImportNoDataRefusal', description: 'On fields.csvFile (csv mode) or fields.pasteContent (paste mode).' })

/** 413 of the student import: more than STUDENT_IMPORT_MAX_ROWS rows or STUDENT_IMPORT_MAX_BYTES bytes. */
export const StudentImportTooLargeSchema = z
  .object({
    error: ErrorPayloadSchema.extend({
      code: z.literal('PAYLOAD_TOO_LARGE'),
      message: z.literal(STUDENT_IMPORT_MESSAGES.tooLarge),
    }),
  })
  .meta({ id: 'StudentImportTooLarge' })
