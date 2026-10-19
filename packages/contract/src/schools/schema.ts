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
    page: z.coerce.number().int().min(1).default(1),
  })
  .meta({ id: 'SchoolListQuery' })

/** Body of POST/PUT /admin/schools. Strings are trimmed by the server; `district`/`city` may be empty. `joinCode` is never accepted. */
export const SchoolInputSchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    code: z.string().trim().min(1).max(20),
    type: SchoolTypeSchema,
    state: z.string().trim().min(1).max(255),
    district: z.string().trim().max(255).nullish(),
    city: z.string().trim().max(255).nullish(),
    isActive: z.boolean().optional().meta({ description: 'Default true on create; absent keeps the stored value on update.' }),
  })
  .meta({ id: 'SchoolInput' })
export type SchoolInput = z.infer<typeof SchoolInputSchema>

export const SchoolToggleResultSchema = z.object({ isActive: z.boolean() }).meta({ id: 'SchoolToggleResult' })

/** GET /schools?all=1 (admin). Anything but `1` is 422 `fields.all`. */
export const SchoolOptionsQuerySchema = z.object({ all: z.literal('1') }).meta({ id: 'SchoolOptionsQuery' })

/** GET /schools/search (public, active schools only, not paginated). */
export const SchoolSearchQuerySchema = z
  .object({
    q: z.string().optional().meta({ description: 'Substring of name or code.' }),
    state: z.string().optional().meta({ description: 'Exact full state name; blank ignored.' }),
    limit: z.coerce.number().int().min(1).optional().meta({ description: 'Default 20, no maximum.' }),
    id: z.string().min(1).optional().meta({ description: 'One school by id; other filters ignored.' }),
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
