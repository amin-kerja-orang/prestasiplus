import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M10 part A wire contract (BE-17, contract-only): classes, teacher roster, dashboard counters,
 * chapter/topic helpers, contributions, the Murid "Kelas Saya" pair. Source: the M10 mock handlers
 * (`classes`, `students`, `dashboard`, `lookups`, `student-side`, `extras`, `questions`) and
 * `src/modules/m10-teacher-class/api/types.ts`, realigned per `v2-data-migration.md` 4.8 and
 * `v2-data-model.md` (classrooms, enrolments): ids are opaque strings, timestamps are `+08:00`,
 * `legacy_*` never appears. Missions, remedial, question sets, DSKP picks, question papers, audio
 * KBAT templates (BE-18), analytics (BE-20) and the Command Center (BE-22) are out of scope.
 */

/** Exact BM copy of the mock (`MSG` in `handlers/common.ts`, UNVERIFIED COPY OQ-M10-16). */
export const CLASS_MESSAGES = {
  className: 'Sila isi nama kumpulan.',
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tahap pendidikan.',
  school: 'Sekolah tidak sah.',
  classroom: 'Kelas tidak sah.',
  classCode: 'Sila masukkan kod kelas.',
  invalid: 'Medan ini tidak sah.',
  joinNotFound: 'Kod kelas tidak sah.',
  joinAlready: 'Anda sudah menyertai kelas ini.',
  studentNotFound: 'Pelajar tidak dijumpai.',
  studentOtherSchool: 'Pelajar bukan daripada sekolah anda.',
  classNotOwn: 'Kelas ini bukan milik anda.',
  alreadyInClass: 'Pelajar sudah berada dalam kelas ini.',
  notInClass: 'Pelajar tiada dalam kelas ini.',
  chapterName: 'Nama bab diperlukan.',
  chapterNumber: 'Nombor bab mesti antara 1 dan 99.',
  chapterParent: 'Subjek atau tahap tidak sah.',
  topicName: 'Nama topik diperlukan.',
  topicParent: 'Bab tidak sah.',
} as const
export const classJoinedText = (name: string): string => `Berjaya menyertai kelas ${name}.`

/** Generic texts of the mock guards (401, 403, 404 on a malformed or unknown route). */
export const CLASS_GUARD_MESSAGES = {
  unauthenticated: 'Unauthenticated.',
  forbidden: 'This action is unauthorized.',
  notFound: 'Not Found.',
} as const

/** Required trimmed text: blank or missing gives `message`; over `max` gives `maxMessage`. */
const text = (message: string, max?: number, maxMessage: string = CLASS_MESSAGES.invalid) => {
  const base = z.string({ error: message }).trim().min(1, message)
  return max === undefined ? base : base.max(max, maxMessage)
}
/** Opaque id in a request body, with the field's own BM message when missing. */
const refId = (message: string) => z.string({ error: message }).min(1, message)

// --- Shared pieces -----------------------------------------------------------------------------

/** The 11 level slugs (BR-M10-03); the slug is derived from the M03 level (`levelId`). */
export const CLASS_EDUCATION_LEVELS = [
  'tahun-1',
  'tahun-2',
  'tahun-3',
  'tahun-4',
  'tahun-5',
  'tahun-6',
  'tingkatan-1',
  'tingkatan-2',
  'tingkatan-3',
  'tingkatan-4',
  'tingkatan-5',
] as const
export const ClassEducationLevelSlugSchema = z
  .enum(CLASS_EDUCATION_LEVELS, { error: CLASS_MESSAGES.level })
  .meta({ id: 'ClassEducationLevelSlug' })

/** `classroom` = teacher class (has `teacherId`); `school_class` = school-managed class (v2-data-migration 4.8). */
export const ClassroomKindSchema = z.enum(['classroom', 'school_class']).meta({ id: 'ClassroomKind' })
export const ClassEnrolmentStatusSchema = z.enum(['active', 'removed']).meta({ id: 'ClassEnrolmentStatus' })
export const ClassEnrolmentSourceSchema = z
  .enum(['code', 'teacher', 'school_admin', 'complimentary'])
  .meta({ id: 'ClassEnrolmentSource' })

// --- Classes (S4, S5) --------------------------------------------------------------------------

/** `GuruClass`: one class of the signed-in teacher. `studentCount` = active enrolments. */
export const TeacherClassSchema = z
  .object({
    id: IdSchema,
    kind: ClassroomKindSchema,
    teacherId: IdSchema.nullable(),
    schoolId: IdSchema.nullable(),
    name: z.string().min(1),
    subjectId: IdSchema.nullable(),
    subjectName: z.string().nullable().meta({ description: 'null = "Tiada Subjek".' }),
    educationLevel: ClassEducationLevelSlugSchema,
    levelId: IdSchema,
    levelLabel: z.string().min(1).meta({ description: '"Tahun n" or "Ting. n".' }),
    academicYear: z.number().int(),
    description: z.string().nullable(),
    joinCode: z.string().min(1),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    studentCount: z.number().int().min(0),
  })
  .meta({ id: 'TeacherClass' })
export type TeacherClass = z.infer<typeof TeacherClassSchema>

/** `POST /guru/classes` body. Owner is always the caller; `schoolId` is optional (DV-M10-22). */
export const ClassCreateRequestSchema = z
  .object({
    name: text(CLASS_MESSAGES.className, 255),
    subjectId: refId(CLASS_MESSAGES.subject),
    educationLevel: ClassEducationLevelSlugSchema,
    schoolId: z.string({ error: CLASS_MESSAGES.school }).nullish().meta({ description: 'Optional; null or empty means no school. An unknown school gives fields.schoolId.' }),
    description: z.string({ error: CLASS_MESSAGES.invalid }).trim().max(2000, CLASS_MESSAGES.invalid).nullish(),
  })
  .meta({ id: 'ClassCreateRequest' })
export type ClassCreateRequest = z.infer<typeof ClassCreateRequestSchema>

/** Bare body of `GET /guru/classes/:id/qr-data`. The `joinUrl` host comes from configuration. */
export const ClassQrDataSchema = z
  .object({ name: z.string().min(1), school: z.string().nullable(), joinUrl: z.url() })
  .meta({ id: 'ClassQrData' })
export type ClassQrData = z.infer<typeof ClassQrDataSchema>

// --- Roster (S6) -------------------------------------------------------------------------------

export const TEACHER_STUDENT_TABS = ['mine', 'school'] as const
export const TEACHER_SCHOOL_TAB_LIMIT = 200

export const TeacherStudentsQuerySchema = z
  .object({
    tab: z.string().optional().meta({ description: 'mine or school; any other value falls back to "mine" (no 422).' }),
    search: z.string().optional().meta({ description: 'Case-insensitive name filter.' }),
  })
  .meta({ id: 'TeacherStudentsQuery' })

export const TeacherStudentSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    levelName: z.string().nullable().meta({ description: 'M03 level name of the pupil grade.' }),
    classNames: z.array(z.string()).meta({ description: 'The own active classes the pupil is in.' }),
  })
  .meta({ id: 'TeacherStudent' })

/** Not the standard list meta: no page fields (mock `{count, schoolSet}`). */
export const TeacherStudentsMetaSchema = z
  .object({
    count: z.number().int().min(0).meta({ description: 'Matches before the 200-row cap of the school tab.' }),
    schoolSet: z.boolean().meta({ description: 'Whether the teacher profile has a school (BR-M10-30).' }),
  })
  .meta({ id: 'TeacherStudentsMeta' })

export const ClassStudentAddRequestSchema = z
  .object({ classroomId: refId(CLASS_MESSAGES.classroom) })
  .meta({ id: 'ClassStudentAddRequest' })
export const ClassStudentRemoveQuerySchema = z
  .object({ classroomId: refId(CLASS_MESSAGES.classroom) })
  .meta({ id: 'ClassStudentRemoveQuery' })

/** `ClassroomStudent`: the enrolment row returned by `PUT /guru/students/:id` (`source` = "teacher"). */
export const ClassEnrolmentSchema = z
  .object({
    classroomKind: ClassroomKindSchema,
    classroomId: IdSchema,
    studentId: IdSchema,
    status: ClassEnrolmentStatusSchema,
    source: ClassEnrolmentSourceSchema,
    joinedAt: TimestampSchema,
  })
  .meta({ id: 'ClassEnrolment' })
export const ClassStudentRemovedSchema = z.object({ removed: z.literal(1) }).meta({ id: 'ClassStudentRemoved' })

// --- Dashboard (S1) ----------------------------------------------------------------------------

const alwaysEmpty = (what: string) => z.array(z.unknown()).meta({ description: `Always empty (${what}).` })

export const TeacherDashboardSchema = z
  .object({
    checklist: z.object({ hasClass: z.boolean(), hasStudents: z.boolean(), hasMission: z.boolean() }),
    stats: z.object({
      activeClasses: z.number().int().min(0),
      totalClasses: z.number().int().min(0),
      students: z.number().int().min(0),
      questions: z.number().int().min(0),
      questionsApproved: z.number().int().min(0),
      assignments: z.literal(0),
    }),
    today: z.object({
      students: alwaysEmpty('L-M10-01'),
      topics: alwaysEmpty('L-M10-01'),
      actions: alwaysEmpty('L-M10-01'),
    }),
    peerTutor: alwaysEmpty('L-M10-01'),
    classes: z.array(z.object({ id: IdSchema, name: z.string().min(1), studentCount: z.number().int().min(0) })),
    submissions: alwaysEmpty('OQ-M10-11'),
  })
  .meta({ id: 'TeacherDashboard' })
export type TeacherDashboard = z.infer<typeof TeacherDashboardSchema>

// --- Chapters and topics (M03 data, BE-08 owns) ------------------------------------------------

export const TeacherChaptersQuerySchema = z
  .object({ subjectId: z.string().optional(), educationLevelId: z.string().optional() })
  .meta({ id: 'TeacherChaptersQuery', description: 'Either one missing (or unknown) gives an empty array, never an error.' })
export const TeacherTopicsQuerySchema = z
  .object({ chapterId: z.string().optional() })
  .meta({ id: 'TeacherTopicsQuery', description: 'Missing or unknown chapter gives an empty array.' })

export const TeacherChapterOptionSchema = z
  .object({ id: IdSchema, chapterNumber: z.number().int().nullable(), name: z.string() })
  .meta({ id: 'TeacherChapterOption' })
export const TeacherTopicOptionSchema = z
  .object({ id: IdSchema, topicNumber: z.string().nullable(), name: z.string() })
  .meta({ id: 'TeacherTopicOption' })

export const TeacherChapterCreateRequestSchema = z
  .object({
    name: text(CLASS_MESSAGES.chapterName, 255, CLASS_MESSAGES.chapterName),
    chapterNumber: z.coerce
      .number({ error: CLASS_MESSAGES.chapterNumber })
      .int(CLASS_MESSAGES.chapterNumber)
      .min(1, CLASS_MESSAGES.chapterNumber)
      .max(99, CLASS_MESSAGES.chapterNumber),
    subjectId: refId(CLASS_MESSAGES.chapterParent),
    educationLevelId: refId(CLASS_MESSAGES.chapterParent),
  })
  .meta({ id: 'TeacherChapterCreateRequest' })
export const TeacherTopicCreateRequestSchema = z
  .object({
    name: text(CLASS_MESSAGES.topicName, 255, CLASS_MESSAGES.topicName),
    chapterId: refId(CLASS_MESSAGES.topicParent),
  })
  .meta({ id: 'TeacherTopicCreateRequest' })

// --- Contributions and gallery (S21) -----------------------------------------------------------

export const TeacherContributionsSchema = z
  .object({
    stats: z.object({
      total: z.number().int().min(0),
      approved: z.number().int().min(0),
      pending: z.number().int().min(0),
      used: z.number().int().min(0),
    }),
    tiers: z.array(
      z.object({
        name: z.string(),
        threshold: z.number().int().min(1),
        icon: z.string().meta({ description: 'Font Awesome class resolved by the client (BR-05).' }),
        reached: z.boolean(),
      }),
    ),
    nextTier: z.object({ name: z.string(), threshold: z.number().int() }).nullable(),
    breakdown: z.array(z.object({ label: z.string(), count: z.number().int().min(0) })),
  })
  .meta({ id: 'TeacherContributions' })
export type TeacherContributions = z.infer<typeof TeacherContributionsSchema>

export const TeacherGalleryQuerySchema = z
  .object({ folder: z.string().optional() })
  .meta({ id: 'TeacherGalleryQuery' })
/** Bare body: `{folders: []}` without `folder`, `{images: []}` with it (empty in the prototype, D22). */
export const TeacherGallerySchema = z
  .union([z.object({ folders: z.array(z.unknown()) }), z.object({ images: z.array(z.unknown()) })])
  .meta({ id: 'TeacherGallery' })

// --- Kelas Saya (S33) --------------------------------------------------------------------------

export const ClassJoinedClassSchema = z
  .object({
    id: IdSchema,
    name: z.string().min(1),
    subjectName: z.string().nullable(),
    teacherName: z.string().nullable(),
    levelLabel: z.string().min(1),
  })
  .meta({ id: 'ClassJoinedClass' })

/** Trimmed, compared case-insensitively with the stored code. */
export const ClassJoinRequestSchema = z
  .object({ classCode: text(CLASS_MESSAGES.classCode) })
  .meta({ id: 'ClassJoinRequest' })
export const ClassJoinResultSchema = z.object({ classroomId: IdSchema }).meta({ id: 'ClassJoinResult' })
export const ClassJoinResponseSchema = z
  .object({ data: ClassJoinResultSchema, message: z.string().min(1) })
  .meta({ id: 'ClassJoinResponse', description: '201; `message` is "Berjaya menyertai kelas {name}."' })
