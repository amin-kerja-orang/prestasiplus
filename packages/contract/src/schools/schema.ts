import { z } from '../zod'
import { ListMetaSchema } from '../common/envelope'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M02 schools wire contract (BE-05, contract-only). Source: the M02 mock handlers
 * (`schools-admin.ts`, `schools-public.ts`, `imports.ts`) and `src/modules/m02-users-schools/api/*`.
 * Ids are opaque strings; timestamps are `+08:00`; `legacy_*` columns never appear here.
 */

/** `{ data, status }`: the body of a mutation (the mock `raw` response; `status` is the flash text). */
export function statusEnvelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string().min(1).meta({ description: 'BM flash text for display.' }) })
}

/**
 * Validation copy of the mock (Laravel defaults, English, with the attribute in words). The schemas
 * below produce exactly these messages per field; `fields[name]` of a 422 carries them.
 */
export const V = {
  required: (a: string) => `The ${a} field is required.`,
  requiredWhen: (a: string, when: string) => `The ${a} field is required when ${when}.`,
  invalid: (a: string) => `The selected ${a} is invalid.`,
  email: (a: string) => `The ${a} field must be a valid email address.`,
  string: (a: string) => `The ${a} field must be a string.`,
  boolean: (a: string) => `The ${a} field must be true or false.`,
  max: (a: string, n: number) => `The ${a} field must not be greater than ${String(n)} characters.`,
  min: (a: string, n: number) => `The ${a} field must be at least ${String(n)} characters.`,
  confirmed: (a: string) => `The ${a} field confirmation does not match.`,
  taken: (a: string) => `The ${a} has already been taken.`,
} as const

const blank = (input: unknown) => input === undefined || input === null || input === ''

/** Required trimmed text (a blank string counts as missing, as the mock turns it into null). */
export const mockRequiredText = (attr: string, max: number) =>
  z
    .string({ error: (i) => (blank(i.input) ? V.required(attr) : V.string(attr)) })
    .trim()
    .min(1, { error: V.required(attr) })
    .max(max, { error: V.max(attr, max) })

/** Optional trimmed text; blank means null. */
export const mockOptionalText = (attr: string, max: number) =>
  z.string({ error: V.string(attr) }).trim().max(max, { error: V.max(attr, max) }).nullish()

/** Enum with the mock required / invalid copy. */
export const enumField = <T extends readonly [string, ...string[]]>(values: T, attr: string) =>
  z.enum(values, { error: (i) => (blank(i.input) ? V.required(attr) : V.invalid(attr)) })

/** Fixed page sizes of the mock lists (the client sends `page` only). */
export const SCHOOLS_PAGE_SIZE = 30
export const EXISTING_STUDENTS_LIMIT = 200
export const SCHOOL_SEARCH_DEFAULT_LIMIT = 20

/** Exact flash texts of the mock (UNVERIFIED COPY in the SRS, kept as the contract). */
export const SCHOOL_MESSAGES = {
  saved: 'Sekolah berjaya disimpan.',
  toggled: 'Status sekolah berjaya dikemaskini.',
} as const

export const SCHOOL_TYPES = ['SK', 'SMK', 'SJK(C)', 'SJK(T)', 'MRSM', 'SBP'] as const
export const SchoolTypeSchema = z.enum(SCHOOL_TYPES).meta({ id: 'SchoolType' })
export type SchoolType = z.infer<typeof SchoolTypeSchema>

/** Projection used by the public pickers and embedded in user detail. `code` is `''` when none. */
export const SchoolSummarySchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    code: z.string(),
    type: SchoolTypeSchema,
    state: z.string().min(1),
    district: z.string().nullable(),
    city: z.string().nullable(),
  })
  .meta({ id: 'SchoolSummary' })
export type SchoolSummary = z.infer<typeof SchoolSummarySchema>

/** Admin school record: the summary plus status, join code and derived counts. */
export const AdminSchoolSchema = SchoolSummarySchema.extend({
  joinCode: z.string().nullable().meta({ description: 'Join code students use; response only, admin responses only, never on the public picker.' }),
  isActive: z.boolean(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
  studentCount: z.number().int().min(0),
  teacherCount: z.number().int().min(0),
}).meta({ id: 'AdminSchool' })
export type AdminSchool = z.infer<typeof AdminSchoolSchema>

export const SchoolOptionSchema = z.object({ id: IdSchema, name: z.string().min(1) }).meta({ id: 'SchoolOption' })
export type SchoolOption = z.infer<typeof SchoolOptionSchema>

/** `meta` of the school list: `counts` over all schools (filters ignored) and the distinct types. */
export const SchoolListMetaSchema = ListMetaSchema.extend({
  counts: z.object({
    total: z.number().int().min(0),
    active: z.number().int().min(0),
    inactive: z.number().int().min(0),
  }),
  types: z.array(z.string()),
}).meta({ id: 'SchoolListMeta' })

export const SchoolListQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Substring of name or code.' }),
    state: z.string().optional().meta({ description: 'Exact full state name.' }),
    type: z.string().optional().meta({ description: 'Exact school type; an unknown value matches nothing.' }),
    page: z.string().optional().meta({ description: 'Page number; a missing, non-numeric or < 1 value is treated as 1 (not an error).' }),
  })
  .meta({ id: 'SchoolListQuery' })

/** Body of POST/PUT /admin/schools. Strings are trimmed by the server; `district`/`city` may be empty. `joinCode` is never accepted. */
export const SchoolInputSchema = z
  .object({
    name: mockRequiredText('name', 255),
    code: mockRequiredText('code', 20).meta({ description: 'Unique, case-insensitive (server: 422 "The code has already been taken.").' }),
    type: enumField(SCHOOL_TYPES, 'type'),
    state: mockRequiredText('state', 255).meta({ description: 'A known state name (server: 422 "The selected state is invalid.").' }),
    district: mockOptionalText('district', 255),
    city: mockOptionalText('city', 255),
    isActive: z
      .union([z.boolean(), z.literal(0), z.literal(1), z.literal('0'), z.literal('1')], { error: V.boolean('is active') })
      .optional()
      .meta({ description: 'true/false/1/0/"1"/"0". Default true on create; absent keeps the stored value on update.' }),
  })
  .meta({ id: 'SchoolInput' })
export type SchoolInput = z.infer<typeof SchoolInputSchema>

export const SchoolToggleResultSchema = z.object({ isActive: z.boolean() }).meta({ id: 'SchoolToggleResult' })

/** GET /schools?all=1 (admin). Anything but `1` is 422 `fields.all`. */
export const SchoolOptionsQuerySchema = z.object({ all: z.literal('1', { error: V.required('all') }) }).meta({ id: 'SchoolOptionsQuery' })

/** GET /schools/search (public, active schools only, not paginated). */
export const SchoolSearchQuerySchema = z
  .object({
    q: z.string().optional().meta({ description: 'Substring of name or code.' }),
    state: z.string().optional().meta({ description: 'Exact full state name; blank ignored.' }),
    limit: z.string().optional().meta({ description: 'Positive integer, default 20, no maximum; an invalid value is ignored (default used).' }),
    id: z.string().optional().meta({ description: 'One school by id; other filters ignored.' }),
  })
  .meta({ id: 'SchoolSearchQuery' })

export const JpnSchema = z
  .object({ id: IdSchema, code: z.string().min(1), name: z.string().min(1) })
  .meta({ id: 'Jpn' })
export type Jpn = z.infer<typeof JpnSchema>

export const PpdSchema = z
  .object({
    id: IdSchema,
    jpnId: IdSchema,
    code: z.string().min(1).meta({ description: 'Stored exactly as the school `district` value, e.g. "PPD GOMBAK".' }),
    name: z.string().min(1),
  })
  .meta({ id: 'Ppd' })
export type Ppd = z.infer<typeof PpdSchema>

export const SCHOOL_CLASS_LEVELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5'] as const
export const ClassLevelSchema = z.enum(SCHOOL_CLASS_LEVELS).meta({ id: 'ClassLevel' })

/** GET /admin/schools/:id/students (at most 200, name A to Z, not paginated). */
export const ExistingStudentsQuerySchema = z
  .object({
    search: z.string().optional().meta({ description: 'Substring of name, e-mail or DELIMa id.' }),
    classLevel: z.string().optional().meta({ description: 'Exact D1..D6 / T1..T5.' }),
  })
  .meta({ id: 'ExistingStudentsQuery' })

export const ExistingStudentSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    email: z.string().nullable(),
    idDelima: z.string().nullable(),
    classLevel: ClassLevelSchema.nullable(),
    isActive: z.boolean(),
  })
  .meta({ id: 'ExistingStudent' })
export type ExistingStudent = z.infer<typeof ExistingStudentSchema>
