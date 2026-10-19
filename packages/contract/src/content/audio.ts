import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { ListMetaSchema } from '../common/envelope'
import {
  ContentLevelRefSchema,
  ContentSubjectRefSchema,
  counter,
  optionalText,
  pageQuery,
  requiredText,
  uploadFile,
} from './common'

/**
 * M09 Audio KBAT: student play (#24-#26, D53(a)) and admin management (#21-#23). Mock:
 * `handlers/audio.ts`, `handlers/admin-audio.ts`. A set always has 4 sections and 30 questions
 * (BR-M09-15). Only `approved` sets are visible to students (anything else is 404).
 */

export const AUDIO_SET_STATUSES = ['draft', 'pending_review', 'approved', 'archived'] as const
export const AudioKbatStatusSchema = z.enum(AUDIO_SET_STATUSES).meta({ id: 'AudioKbatStatus' })
export type AudioKbatStatus = z.infer<typeof AudioKbatStatusSchema>

export const AUDIO_STATUS_LABELS = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  archived: 'Archived',
} as const satisfies Record<AudioKbatStatus, string>

/** The create form has no "Archived" option (BR-M09-15); default is `approved`. */
export const AUDIO_CREATE_STATUSES = ['approved', 'pending_review', 'draft'] as const

export const AUDIO_CHOICES = ['A', 'B', 'C', 'D'] as const
export const AudioChoiceSchema = z.enum(AUDIO_CHOICES).meta({ id: 'AudioKbatChoice' })

export const AUDIO_SECTION_COUNT = 4
export const AUDIO_QUESTION_COUNT = 30
/** First and last question number of each section (1-based, inclusive). */
export const AUDIO_SECTION_RANGES = [
  [1, 8],
  [9, 16],
  [17, 24],
  [25, 30],
] as const

export const AUDIO_ADMIN_PAGE_SIZE = 20
export const AUDIO_ADMIN_MAX_PAGE_SIZE = 100
export const AUDIO_MAX_BYTES = 20 * 1024 * 1024

// ---------------------------------------------------------------------------------------------
// Student play
// ---------------------------------------------------------------------------------------------

/** Item of `GET /audio-kbat-sets` (#24): approved sets only. */
export const AudioKbatSetListItemSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    educationLevel: ContentLevelRefSchema,
    subject: ContentSubjectRefSchema,
  })
  .meta({ id: 'AudioKbatSetListItem' })

export const AudioKbatSetListQuerySchema = z
  .object({
    educationLevelId: IdSchema.optional(),
    subjectId: IdSchema.optional(),
  })
  .meta({ id: 'AudioKbatSetListQuery' })

/**
 * A question as served to a student: never the correct answer, the explanation, the KBAT level or
 * the DSKP link. Strict on purpose, so a leaked field fails parsing.
 */
export const AudioKbatPlayQuestionSchema = z
  .strictObject({
    no: z.number().int().min(1).max(AUDIO_QUESTION_COUNT),
    questionText: z.string(),
    options: z.strictObject({ A: z.string(), B: z.string(), C: z.string(), D: z.string() }),
    marks: z.number().int().min(1).max(20),
  })
  .meta({ id: 'AudioKbatPlayQuestion' })

export const AudioKbatPlaySectionSchema = z
  .strictObject({
    no: z.number().int().min(1).max(AUDIO_SECTION_COUNT),
    title: z.string(),
    audioUrl: z.string().nullable().meta({
      description: 'Authenticated URL served through BE-04 FileStorage (not a public path); null when the section has no audio.',
    }),
    questions: z.array(AudioKbatPlayQuestionSchema),
  })
  .meta({ id: 'AudioKbatPlaySection' })

/** `data` of `GET /audio-kbat-sets/{id}` (#25): 4 sections. */
export const AudioKbatPlaySetSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    instructions: z.string().nullable(),
    sections: z.array(AudioKbatPlaySectionSchema).length(AUDIO_SECTION_COUNT),
  })
  .meta({ id: 'AudioKbatPlaySet' })
export type AudioKbatPlaySet = z.infer<typeof AudioKbatPlaySetSchema>

export const AudioKbatAnswerSchema = z
  .strictObject({
    no: z.number().int().min(1).max(AUDIO_QUESTION_COUNT),
    choice: AudioChoiceSchema,
  })
  .meta({ id: 'AudioKbatAnswer' })

/**
 * Body of `POST /audio-kbat-sets/{id}/attempts` (#26). `answers` is required; a non-array, a `no`
 * outside 1..30, a duplicate `no` or a `choice` outside A..D is 422 `fields.answers`
 * "Medan ini tidak sah.". The user always comes from the session.
 */
export const AudioKbatAttemptRequestSchema = z
  .object({
    answers: z.array(AudioKbatAnswerSchema).refine((a) => new Set(a.map((x) => x.no)).size === a.length, {
      error: 'Medan ini tidak sah.',
    }),
  })
  .meta({ id: 'AudioKbatAttemptRequest' })

/** `data` of the attempt (#26, 201): sum of the marks of correct answers / sum of all marks. */
export const AudioKbatAttemptResultSchema = z
  .strictObject({ score: counter(), totalMarks: counter() })
  .meta({ id: 'AudioKbatAttemptResult' })

// ---------------------------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------------------------

/** Row of the admin list (#21). */
export const AdminAudioKbatSetItemSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    educationLevel: ContentLevelRefSchema,
    subject: ContentSubjectRefSchema,
    status: AudioKbatStatusSchema,
    statusLabel: z.string(),
    questionCount: counter(),
  })
  .meta({ id: 'AdminAudioKbatSetItem' })

/** `meta.stats` of the admin list: counted over every set, never the filtered ones. */
export const AdminAudioKbatStatsSchema = z
  .strictObject({
    sets: counter(),
    approved: counter(),
    draftPending: counter().meta({ description: 'draft + pending_review.' }),
    questions: counter(),
  })
  .meta({ id: 'AdminAudioKbatStats' })

export const AdminAudioKbatListMetaSchema = ListMetaSchema.extend({ stats: AdminAudioKbatStatsSchema }).meta({
  id: 'AdminAudioKbatListMeta',
})

export const AdminAudioKbatListResponseSchema = z
  .object({ data: z.array(AdminAudioKbatSetItemSchema), meta: AdminAudioKbatListMetaSchema })
  .meta({ id: 'AdminAudioKbatListResponse' })

export const AdminAudioKbatListQuerySchema = z
  .object({
    educationLevelId: IdSchema.optional(),
    subjectId: IdSchema.optional(),
    status: z.string().optional().meta({ description: 'draft, pending_review, approved or archived; an unknown value is ignored.' }),
    search: z.string().optional(),
    page: pageQuery(),
    pageSize: z.coerce.number().int().min(1).max(AUDIO_ADMIN_MAX_PAGE_SIZE).optional().meta({
      description: `Default ${AUDIO_ADMIN_PAGE_SIZE}, clamped to ${AUDIO_ADMIN_MAX_PAGE_SIZE}.`,
    }),
  })
  .meta({ id: 'AdminAudioKbatListQuery' })

export const AUDIO_TEMPLATE_FORMATS = ['xlsx', 'docx'] as const
export const AdminAudioKbatTemplateQuerySchema = z
  .object({
    format: z.enum(AUDIO_TEMPLATE_FORMATS).optional().meta({ description: 'Default xlsx. Anything else is 422 fields.format "Medan ini tidak sah.".' }),
  })
  .meta({ id: 'AdminAudioKbatTemplateQuery' })

/** Content types of the template download (`template-audio-kbat.xlsx` / `.docx`). */
export const AUDIO_TEMPLATE_CONTENT_TYPES = {
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
} as const

const sectionAudio = uploadFile({
  maxBytes: AUDIO_MAX_BYTES,
  mimes: ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/m4a', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'video/mp4'],
  extensions: ['mp3', 'm4a', 'wav', 'ogg', 'aac', 'mp4'],
  description: 'mp3, m4a, wav, ogg, aac or mp4; declared type audio/* or video/mp4; at most 20 MB. Stored through BE-04.',
})

/** One of the 4 sections of a create body (`sections[n][title|audio|transcript]`, n = 1..4). */
export const AdminAudioKbatSectionInputSchema = z
  .object({
    title: optionalText(255).meta({ description: 'Default "Audio n" when blank.' }),
    audio: sectionAudio.optional(),
    transcript: z.string().nullable().optional(),
  })
  .meta({ id: 'AdminAudioKbatSectionInput' })

/** One of the 30 questions of a create body (`questions[n][...]`, n = 1..30). */
export const AdminAudioKbatQuestionInputSchema = z
  .object({
    questionText: requiredText(2000),
    optionA: requiredText(500),
    optionB: requiredText(500),
    optionC: requiredText(500),
    optionD: requiredText(500),
    correctAnswer: AudioChoiceSchema,
    marks: z.coerce.number().int().min(1).max(20).optional().meta({ description: 'Default 1.' }),
    kbatLevel: z.coerce.number().int().min(1).max(5).optional().meta({ description: 'Default 3.' }),
    dskpSpId: IdSchema.optional().meta({ description: 'DSKP standard-of-performance id (curriculum, BE-08).' }),
    explanation: optionalText(2000),
  })
  .meta({ id: 'AdminAudioKbatQuestionInput' })

/**
 * Create body (#23), `multipart/form-data` (section audio files are stored through BE-04). On the
 * wire the nested parts are flattened as `sections[n][title|audio|transcript]` and
 * `questions[n][questionText|optionA..optionD|correctAnswer|marks|kbatLevel|dskpSpId|explanation]`
 * with n starting at 1; this schema is the logical structure (arrays of exactly 4 and 30). A
 * validation failure uses dotted keys under `fields`, e.g. `sections.2.audio`, `questions.5.optionA`.
 */
export const AdminAudioKbatCreateRequestSchema = z
  .object({
    title: requiredText(255),
    educationLevelId: IdSchema,
    subjectId: IdSchema,
    status: z.enum(AUDIO_CREATE_STATUSES).optional().meta({ description: 'Default approved.' }),
    sourceLabel: optionalText(255),
    instructions: optionalText(5000),
    sections: z.array(AdminAudioKbatSectionInputSchema).length(AUDIO_SECTION_COUNT),
    questions: z.array(AdminAudioKbatQuestionInputSchema).length(AUDIO_QUESTION_COUNT),
  })
  .meta({ id: 'AdminAudioKbatCreateRequest' })

/** Section as stored, in the create response. */
export const AdminAudioKbatSectionSchema = z
  .strictObject({
    no: z.number().int().min(1).max(AUDIO_SECTION_COUNT),
    title: z.string(),
    audioFileName: z.string().nullable(),
    transcript: z.string().nullable(),
    questionFrom: z.number().int().min(1),
    questionTo: z.number().int().min(1),
  })
  .meta({ id: 'AdminAudioKbatSection' })

/** `data` of the create (#23, 201). */
export const AdminAudioKbatCreatedSchema = z
  .strictObject({
    id: IdSchema,
    title: z.string(),
    educationLevel: ContentLevelRefSchema,
    subject: ContentSubjectRefSchema,
    status: AudioKbatStatusSchema,
    statusLabel: z.string(),
    questionCount: counter(),
    sourceLabel: z.string().nullable(),
    instructions: z.string().nullable(),
    sections: z.array(AdminAudioKbatSectionSchema).length(AUDIO_SECTION_COUNT),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'AdminAudioKbatCreated' })
