import { z } from '../zod'
import { boolField, enumField, hexColorField, idField, idListField, intField, textField } from './fields'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'

/**
 * M03 curriculum wire contract (BE-08, contract-only). Source of truth for the shapes: the M03 mock
 * handlers and `src/modules/m03-curriculum/api/*`, realigned by `v2-data-migration.md` 4.2 and
 * `v2-data-model.md` 3.3: ids are opaque strings, timestamps are `+08:00`, chapters gain `strand` and
 * `dskpCode`, the mock-only `createdSeq` is not on the wire, `legacy_*` never appears.
 */

// --- Shared pieces -----------------------------------------------------------------------------

/** `{ id, name }` reference used inside tree and detail responses. */
export const CurriculumRefSchema = z
  .object({ id: IdSchema, name: z.string() })
  .meta({ id: 'CurriculumRef' })

export const CurriculumStageSchema = z
  .enum(['primary', 'lower_secondary', 'upper_secondary'])
  .meta({ id: 'CurriculumStage' })

/** `{ data, status }`: mutation responses carry the BM success flash in `status`. */
export function curriculumStatusEnvelopeOf<T extends z.ZodType>(data: T) {
  return z.object({ data, status: z.string().min(1) })
}

// --- Exact BM copy (mock admin-common.ts, BR-18, SRS section 8) --------------------------------

export const CURRICULUM_NOT_FOUND_MESSAGES = {
  chapter: 'Bab tidak dijumpai.',
  topic: 'Topik tidak dijumpai.',
  subtopic: 'Subtopik tidak dijumpai.',
  subject: 'Subjek tidak dijumpai.',
  level: 'Tahap Pendidikan tidak dijumpai.',
  /** Mock constant `CHAPTER_ID_REQUIRED`; not produced by any mock route today. */
  chapterIdRequired: 'Chapter ID diperlukan.',
} as const

/**
 * 409 CONFLICT copy of a delete that still has children (BE-08 follow-up, LEAD 2026-10-20). Working
 * assumption: the live site and the mock cascade, so there is no observed copy.
 */
export const CURRICULUM_CONFLICT_MESSAGES = {
  level: 'Tahap Pendidikan ini masih mempunyai subjek, bab atau nod DSKP.',
  subject: 'Subjek ini masih mempunyai tahap, bab atau nod DSKP.',
  chapter: 'Bab ini masih mempunyai topik.',
  topic: 'Topik ini masih mempunyai subtopik.',
} as const

export const CURRICULUM_FLASH_MESSAGES = {
  chapter: { created: 'Bab berjaya ditambah.', updated: 'Bab berjaya dikemaskini.', deleted: 'Bab berjaya dipadam.' },
  topic: { created: 'Topik berjaya ditambah.', updated: 'Topik berjaya dikemaskini.', deleted: 'Topik berjaya dipadam.' },
  subtopic: {
    created: 'Subtopik berjaya ditambah.',
    updated: 'Subtopik berjaya dikemaskini.',
    deleted: 'Subtopik berjaya dipadam.',
  },
  subject: { created: 'Subjek berjaya ditambah.', updated: 'Subjek berjaya dikemaskini.', deleted: 'Subjek berjaya dipadam.' },
  level: {
    created: 'Tahap Pendidikan berjaya ditambah.',
    updated: 'Tahap Pendidikan berjaya dikemaskini.',
    deleted: 'Tahap Pendidikan berjaya dipadam.',
  },
} as const

export { CURRICULUM_VALIDATION_MESSAGES } from './fields'

// --- Education levels --------------------------------------------------------------------------

export const CurriculumEducationLevelSchema = z
  .object({
    id: IdSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    nameEn: z.string().min(1),
    stage: CurriculumStageSchema,
    curriculum: z.string().min(1),
    order: z.int().min(0),
    isActive: z.boolean(),
    grade: z.int().min(1).max(11).nullable().meta({ description: 'Link to the user grade (1 to 11); null for levels created later.' }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'CurriculumEducationLevel' })

export const CurriculumEducationLevelListItemSchema = CurriculumEducationLevelSchema.extend({
  questionCount: z.int().min(0).meta({ description: 'Active (published) questions of the level (M04).' }),
  subjectCount: z.int().min(0).meta({ description: 'Subjects linked to the level.' }),
}).meta({ id: 'CurriculumEducationLevelListItem' })

/** POST and PUT body. The code is stored upper-case and unique case-insensitively. */
export const CurriculumEducationLevelWriteSchema = z
  .object({
    name: textField('name', { max: 255, required: true }),
    nameEn: textField('nameEn', { max: 255, required: true }),
    code: textField('code', { max: 10, required: true }),
    stage: enumField('stage', ['primary', 'lower_secondary', 'upper_secondary']),
    curriculum: textField('curriculum', { max: 255, required: true }),
    order: intField('order', { min: 0 }),
  })
  .meta({ id: 'CurriculumEducationLevelWrite' })

/** `GET /education-levels` item (active levels only). */
export const CurriculumEducationLevelLookupSchema = z
  .object({
    id: IdSchema,
    code: z.string(),
    name: z.string(),
    nameEn: z.string(),
    stage: CurriculumStageSchema,
    grade: z.int().min(1).max(11).nullable(),
  })
  .meta({ id: 'CurriculumEducationLevelLookup' })

// --- Subjects ----------------------------------------------------------------------------------

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

export const CurriculumSubjectSchema = z
  .object({
    id: IdSchema,
    code: z.string().min(1),
    name: z.string().min(1),
    nameEn: z.string().min(1),
    icon: z.string().nullable().meta({ description: 'Free text: Lucide name, Font Awesome class or emoji.' }),
    color: z.string().regex(HEX_COLOR),
    isCore: z.boolean(),
    order: z.int().min(0),
    isActive: z.boolean(),
    educationLevelIds: z.array(IdSchema).meta({ description: 'Linked levels in level order.' }),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'CurriculumSubject' })

export const CurriculumSubjectListItemSchema = CurriculumSubjectSchema.extend({
  questionCount: z.int().min(0).meta({ description: 'Active (published) questions of the subject (M04).' }),
  levels: z.array(CurriculumRefSchema),
}).meta({ id: 'CurriculumSubjectListItem' })

/**
 * POST and PUT body. On POST absent fields take the defaults (`icon` "fas fa-book", `color`
 * "#4f46e5", `isCore` false, `order` 0, `educationLevelIds` []); on PUT an absent key keeps the
 * stored value. An empty `icon` is stored as null.
 */
export const CurriculumSubjectWriteSchema = z
  .object({
    name: textField('name', { max: 255, required: true }),
    nameEn: textField('nameEn', { max: 255, required: true }),
    code: textField('code', { max: 20, required: true }),
    icon: textField('icon', { max: 100 }),
    color: hexColorField('color'),
    isCore: boolField('isCore'),
    order: intField('order', { min: 0 }),
    educationLevelIds: idListField('educationLevelIds'),
  })
  .meta({ id: 'CurriculumSubjectWrite' })

/** `GET /subjects` item (active subjects only, optional `educationLevelId` filter). */
export const CurriculumSubjectLookupSchema = z
  .object({
    id: IdSchema,
    code: z.string(),
    name: z.string(),
    nameEn: z.string(),
    icon: z.string().nullable(),
    color: z.string(),
    isCore: z.boolean(),
    educationLevelIds: z.array(IdSchema),
  })
  .meta({ id: 'CurriculumSubjectLookup' })

/** PATCH body and response of `/active` toggles. */
export const CurriculumSetActiveRequestSchema = z
  .object({ isActive: boolField('isActive', { required: true }) })
  .meta({ id: 'CurriculumSetActiveRequest' })
export const CurriculumActiveStateSchema = z
  .object({ id: IdSchema, isActive: z.boolean() })
  .meta({ id: 'CurriculumActiveState' })

/** `{ deleted: 1 }` of subject, level and subtopic deletes. */
export const CurriculumDeletedOneSchema = z
  .object({ deleted: z.literal(1) })
  .meta({ id: 'CurriculumDeletedOne' })

// --- Chapters, topics, subtopics (admin tree) --------------------------------------------------

export const CurriculumChapterSchema = z
  .object({
    id: IdSchema,
    subjectId: IdSchema,
    educationLevelId: IdSchema,
    name: z.string().min(1),
    nameEn: z.string().nullable(),
    chapterNumber: z.int().min(1).nullable(),
    description: z.string().nullable(),
    strand: z.string().nullable().meta({ description: 'Unit/strand title kept from .cloud (v2 addition; read-only).' }),
    dskpCode: z.string().nullable().meta({ description: 'Printed DSKP code such as 1.1.3 (v2 addition; read-only).' }),
    inTree: z.boolean().meta({ description: 'Display flag set by rule; out-of-tree chapters are never returned.' }),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'CurriculumChapter' })

export const CurriculumTopicSchema = z
  .object({
    id: IdSchema,
    chapterId: IdSchema,
    name: z.string().min(1),
    nameEn: z.string().nullable(),
    topicNumber: z.string().nullable().meta({ description: 'Free text, ordered naturally (1 < 1.1 < 2).' }),
    description: z.string().nullable(),
    learningStandard: z.string().nullable(),
    isActive: z.boolean(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'CurriculumTopic' })

export const CurriculumSubtopicSchema = z
  .object({
    id: IdSchema,
    topicId: IdSchema,
    name: z.string().min(1),
    nameEn: z.string().nullable(),
    learningObjective: z.string().nullable(),
    createdAt: TimestampSchema,
    updatedAt: TimestampSchema,
  })
  .meta({ id: 'CurriculumSubtopic' })

export const CurriculumChapterDetailSchema = CurriculumChapterSchema.extend({
  subject: CurriculumRefSchema,
  level: CurriculumRefSchema,
}).meta({ id: 'CurriculumChapterDetail' })

export const CurriculumTopicDetailSchema = CurriculumTopicSchema.extend({
  chapter: CurriculumChapterDetailSchema,
}).meta({ id: 'CurriculumTopicDetail' })

export const CurriculumTopicNodeSchema = CurriculumTopicSchema.extend({
  subtopics: z.array(CurriculumSubtopicSchema),
}).meta({ id: 'CurriculumTopicNode' })

export const CurriculumChapterNodeSchema = CurriculumChapterSchema.extend({
  topics: z.array(CurriculumTopicNodeSchema),
}).meta({ id: 'CurriculumChapterNode' })

/** Counts include inactive records (BR-06). */
export const CurriculumTreeStatsSchema = z
  .object({ chapters: z.int().min(0), topics: z.int().min(0), subtopics: z.int().min(0) })
  .meta({ id: 'CurriculumTreeStats' })

export const CurriculumTreeSchema = z
  .object({
    subject: CurriculumRefSchema,
    level: CurriculumRefSchema,
    stats: CurriculumTreeStatsSchema,
    chapters: z.array(CurriculumChapterNodeSchema),
  })
  .meta({ id: 'CurriculumTree' })

/** Query of `GET /admin/curriculum`: both required. */
export const CurriculumTreeQuerySchema = z
  .object({ subjectId: idField('subjectId'), educationLevelId: idField('educationLevelId') })
  .meta({ id: 'CurriculumTreeQuery' })

const chapterWriteShape = {
  subjectId: idField('subjectId'),
  educationLevelId: idField('educationLevelId'),
  name: textField('name', { max: 255, required: true }),
  nameEn: textField('nameEn', { max: 255 }),
  chapterNumber: intField('chapterNumber', { min: 1 }),
  description: textField('description'),
}
export const CurriculumChapterCreateSchema = z.object(chapterWriteShape).meta({ id: 'CurriculumChapterCreate' })
/** PUT: an absent `isActive` keeps the stored value. */
export const CurriculumChapterUpdateSchema = z
  .object({ ...chapterWriteShape, isActive: boolField('isActive') })
  .meta({ id: 'CurriculumChapterUpdate' })

const topicWriteShape = {
  name: textField('name', { max: 255, required: true }),
  nameEn: textField('nameEn', { max: 255 }),
  topicNumber: textField('topicNumber', { max: 20, numberAsText: true }),
  description: textField('description'),
  learningStandard: textField('learningStandard'),
}
export const CurriculumTopicCreateSchema = z
  .object({ chapterId: idField('chapterId'), ...topicWriteShape })
  .meta({ id: 'CurriculumTopicCreate' })
/** PUT: `chapterId` is fixed after creation and ignored if sent. */
export const CurriculumTopicUpdateSchema = z
  .object({ ...topicWriteShape, isActive: boolField('isActive') })
  .meta({ id: 'CurriculumTopicUpdate' })

const subtopicWriteShape = {
  name: textField('name', { max: 255, required: true }),
  nameEn: textField('nameEn', { max: 255 }),
  learningObjective: textField('learningObjective'),
}
export const CurriculumSubtopicCreateSchema = z
  .object({ topicId: idField('topicId'), ...subtopicWriteShape })
  .meta({ id: 'CurriculumSubtopicCreate' })
export const CurriculumSubtopicUpdateSchema = z.object(subtopicWriteShape).meta({ id: 'CurriculumSubtopicUpdate' })

export const CurriculumChapterDeletedSchema = z
  .object({
    deleted: z.object({ chapters: z.literal(1), topics: z.int().min(0), subtopics: z.int().min(0) }),
  })
  .meta({ id: 'CurriculumChapterDeleted' })
export const CurriculumTopicDeletedSchema = z
  .object({ deleted: z.object({ topics: z.literal(1), subtopics: z.int().min(0) }) })
  .meta({ id: 'CurriculumTopicDeleted' })

// --- Learner reads (topic catalogue and Peta Belajar) ------------------------------------------

export const CurriculumGradeCodeSchema = z
  .enum([
    'DARJAH_1', 'DARJAH_2', 'DARJAH_3', 'DARJAH_4', 'DARJAH_5', 'DARJAH_6',
    'TINGKATAN_1', 'TINGKATAN_2', 'TINGKATAN_3', 'TINGKATAN_4', 'TINGKATAN_5',
  ])
  .meta({ id: 'CurriculumGradeCode' })

export const CurriculumLegacySubjectCodeSchema = z
  .enum([
    'MATEMATIK', 'BAHASA_MELAYU', 'BAHASA_INGGERIS', 'SAINS',
    'PENDIDIKAN_ISLAM', 'PENDIDIKAN_MORAL', 'SEJARAH', 'GEOGRAFI',
  ])
  .meta({ id: 'CurriculumLegacySubjectCode' })

export const CurriculumTopicStateSchema = z
  .enum(['mastered', 'started', 'unlocked', 'locked'])
  .meta({ id: 'CurriculumTopicState' })

/** Query of `GET /topics`: both case-insensitive, AND-combined; unknown values match nothing. */
export const CurriculumTopicsQuerySchema = z
  .object({ gradeLevel: z.string().optional(), subject: z.string().optional() })
  .meta({ id: 'CurriculumTopicsQuery' })

export const CurriculumTopicCardSchema = z
  .object({
    id: IdSchema,
    gradeLevel: CurriculumGradeCodeSchema,
    subject: CurriculumLegacySubjectCodeSchema,
    subjectLabel: z.string().meta({ description: 'Subject code with "_" replaced by a space.' }),
    name: z.string(),
    description: z.string().nullable(),
    subtopicCount: z.int().min(0),
    subtopicsPreview: z.array(z.string()).max(3),
  })
  .meta({ id: 'CurriculumTopicCard' })

export const CurriculumTopicDetailLearnerSchema = z
  .object({
    id: IdSchema,
    gradeLevel: CurriculumGradeCodeSchema,
    subject: CurriculumLegacySubjectCodeSchema,
    subjectLabel: z.string(),
    practiceCode: z.string().meta({ description: 'Admin subject practice code, for /practice/{practiceCode}.' }),
    name: z.string(),
    description: z.string().nullable(),
    icon: z.string().nullable(),
    sequence: z.int(),
    subtopics: z.array(
      z.object({
        id: IdSchema,
        name: z.string(),
        description: z.string().nullable(),
        progress: z.int().min(0).max(100),
      }),
    ),
    progress: z.object({ questionsAnswered: z.int().min(0), progress: z.int().min(0).max(100) }),
  })
  .meta({ id: 'CurriculumLearnerTopicDetail' })

/** Query of `GET /learning-map`. */
export const CurriculumLearningMapQuerySchema = z
  .object({ subject: z.string().optional(), grade: z.string().optional() })
  .meta({ id: 'CurriculumLearningMapQuery' })

export const CurriculumLearningMapSchema = z
  .object({
    subject: z.string(),
    subjectLabel: z.string(),
    grade: z.string(),
    gradeOptions: z.array(z.string()),
    subjects: z.array(z.object({ code: z.string(), label: z.string(), emoji: z.string(), color: z.string() })),
    stats: z.object({ done: z.int().min(0), total: z.int().min(0), progress: z.int().min(0).max(100) }),
    topics: z.array(
      z.object({
        id: IdSchema,
        name: z.string(),
        icon: z.string().nullable(),
        state: CurriculumTopicStateSchema,
        progress: z.int().min(0).max(100),
        sessions: z.int().min(0),
        questionsAnswered: z.int().min(0),
        practiceUrl: z.string().nullable().meta({ description: 'null when the topic is locked.' }),
      }),
    ),
  })
  .meta({ id: 'CurriculumLearningMap' })

// --- DSKP node (shared tag target; no M03 endpoint, served via BE-10/BE-18) -----------------------

export const CurriculumNodeKindSchema = z
  .enum(['grouping', 'unit', 'sk', 'sp'])
  .meta({ id: 'CurriculumNodeKind' })

/** Performance level (Tahap Penguasaan), 1 to 6. */
export const CurriculumTpSchema = z.int().min(1).max(6).meta({ id: 'CurriculumTp' })

export const CurriculumNodeSchema = z
  .object({
    id: IdSchema,
    subjectId: IdSchema,
    educationLevelId: IdSchema,
    kind: CurriculumNodeKindSchema,
    code: z.string().min(1).meta({ description: 'Stable printed code (1.0, 1.1, 1.1.3); questions tag by id, lookups by code.' }),
    title: z.string().min(1),
    titlePrinted: z.string().nullable(),
    parentId: IdSchema.nullable(),
    order: z.int().min(0),
    edition: z.string().min(1),
    isElective: z.boolean(),
  })
  .meta({ id: 'CurriculumNode' })

// --- Envelopes ---------------------------------------------------------------------------------

export type CurriculumEducationLevel = z.infer<typeof CurriculumEducationLevelSchema>
export type CurriculumSubject = z.infer<typeof CurriculumSubjectSchema>
export type CurriculumChapter = z.infer<typeof CurriculumChapterSchema>
export type CurriculumTopic = z.infer<typeof CurriculumTopicSchema>
export type CurriculumSubtopic = z.infer<typeof CurriculumSubtopicSchema>
export type CurriculumNode = z.infer<typeof CurriculumNodeSchema>
export type CurriculumLearningMap = z.infer<typeof CurriculumLearningMapSchema>
