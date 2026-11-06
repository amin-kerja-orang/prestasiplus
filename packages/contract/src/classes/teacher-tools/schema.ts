import { z } from '../../zod'
import { listEnvelopeOf } from '../../common/envelope'
import { IdSchema } from '../../common/ids'
import { TimestampSchema } from '../../common/time'
import { QUESTION_COGNITIVE_LEVELS } from '../../questions/parts'

/**
 * S6-T16 wire contract: Soalan & Rujukan (R1-GUR-44a), a teacher's personal MCQ with an optional reference link (API-GUR-24).
 * Stored as `question_versions.visibility = 'teacher_private'` (DM-42); served only through the owner's Misi Harian (API-GUR-25),
 * never to the bank, Databank, Set Soalan pickers, Studio or the review queue. Own rows only: another teacher's id is 404.
 *
 * The DSKP rule and its BM messages are the SAME as the bank form (FR-GUR-44-9, D112). They are mirrored here because the shared
 * `guruDskpFields` / `GURU_QUESTION_MESSAGES` of S6-T06 (#705) are not merged yet. After #705 merges, `PERSONAL_QUESTION_MESSAGES`
 * and `personalDskpFields` should be removed in favour of that pair (the strings below are identical).
 */

export const PERSONAL_QUESTION_MESSAGES = {
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tingkatan.',
  difficulty: 'Sila pilih kesukaran.',
  chapter: 'Sila pilih bab.',
  chapterInvalid: 'Bab tidak sah.',
  chapterMismatch: 'Bab tidak sepadan dengan subjek dan tingkatan.',
  sp: 'Sila pilih Standard Pembelajaran (SP).',
  spInvalid: 'SP tidak sah.',
  spMax: 'Satu soalan boleh mempunyai 1 hingga 3 SP sahaja.',
  tp: 'Sila pilih TP.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitive: 'Sila pilih aras pemikiran.',
  text: 'Sila isi teks soalan.',
  textLong: 'Teks soalan tidak boleh melebihi 2000 aksara.',
  options: 'Sila isi semua pilihan jawapan.',
  option: (letter: string): string => `Sila isi pilihan ${letter}.`,
  optionLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  correct: 'Sila tanda satu jawapan yang betul.',
  referenceUrl: 'Pautan mesti bermula dengan http:// atau https://.',
  referenceUrlLong: 'Pautan tidak boleh melebihi 2048 aksara.',
  /** 409 of a delete while an active Misi draws the question (ADD-21). */
  inUse: 'Soalan sedang digunakan dalam misi.',
  /** Success text of the create and the edit (the screen shows it as the toast). */
  saved: 'Soalan disimpan.',
} as const

export const PERSONAL_QUESTION_TEXT_MAX = 2000
export const PERSONAL_QUESTION_OPTION_MAX = 500
export const PERSONAL_QUESTION_URL_MAX = 2048

/** The Aras Pemikiran of the bank form (R1-B05). */
export const PERSONAL_QUESTION_COGNITIVE_LEVELS = QUESTION_COGNITIVE_LEVELS

const charLen = (t: string): number => [...t].length
const letter = (i: number): string => String.fromCharCode(65 + i)

/** The inputs of the shared conditional DSKP rule (D112). */
export interface PersonalDskpInput {
  chapterId?: string | null | undefined
  spIds?: readonly string[] | null | undefined
  tp?: number | null | undefined
  cognitiveLevel?: string | null | undefined
}

/** What the Subjek + Tingkatan has: active chapters (Bab required) and DSKP nodes (SP, TP and Aras required). */
export interface PersonalDskpFacts {
  hasChapters: boolean
  hasDskpNodes: boolean
}

/**
 * The conditional DSKP rule of 44-F1 / FR-GUR-44a-7 (D112) as one pure function: Bab is required only where the Subjek + Tingkatan has active
 * chapters; SP (at least one), TP (1 to 6) and Aras only where it has DSKP nodes. Returns the 422 `fields` map (empty when the input passes). A TP that
 * is sent but out of range is refused whether or not it is required. Same rule and messages as `guruDskpFields` of S6-T06.
 */
export function personalDskpFields(input: PersonalDskpInput, facts: PersonalDskpFacts): Record<string, string> {
  const fields: Record<string, string> = {}
  const M = PERSONAL_QUESTION_MESSAGES
  if (facts.hasChapters && (input.chapterId === undefined || input.chapterId === null || input.chapterId === '')) fields.chapterId = M.chapter
  if (facts.hasDskpNodes && (input.spIds ?? []).length === 0) fields.spIds = M.sp
  if (input.tp === undefined || input.tp === null) {
    if (facts.hasDskpNodes) fields.tp = M.tp
  } else if (!Number.isInteger(input.tp) || input.tp < 1 || input.tp > 6) fields.tp = M.tpRange
  if (facts.hasDskpNodes && (input.cognitiveLevel === undefined || input.cognitiveLevel === null || input.cognitiveLevel === '')) fields.cognitiveLevel = M.cognitive
  return fields
}

/**
 * True for an absolute http or https address: no other scheme (`javascript:` included), no whitespace or control character, and no userinfo
 * (`user:pass@host` is refused: a credential in a link is shown to every pupil).
 */
export function isHttpUrl(value: string): boolean {
  // eslint-disable-next-line no-control-regex -- the point is to refuse control characters
  if (!/^https?:\/\/\S+$/i.test(value) || /[\x00-\x1f\x7f]/.test(value)) return false
  try {
    const url = new URL(value)
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== '' && url.username === '' && url.password === ''
  } catch {
    return false
  }
}

const RequiredId = (message: string) => z.string({ error: message }).trim().min(1, message).max(64, message)

/** One answer option of the wire. */
export const PersonalQuestionOptionSchema = z.object({ text: z.string() }).meta({ id: 'PersonalQuestionOption' })

/**
 * Body of POST and PUT /guru/personal-questions (the edit form sends every field). `educationLevelId` must be an active Tingkatan 1 to 5 and the
 * DSKP fields follow `personalDskpFields`; both are service rules (they need the curriculum). 422 `fields` keys: subjectId, educationLevelId,
 * chapterId, spIds, tp, cognitiveLevel, difficulty, text, options, correctIndex, referenceUrl.
 */
export const PersonalQuestionWriteSchema = z
  .object({
    subjectId: RequiredId(PERSONAL_QUESTION_MESSAGES.subject),
    educationLevelId: RequiredId(PERSONAL_QUESTION_MESSAGES.level),
    chapterId: z.string({ error: PERSONAL_QUESTION_MESSAGES.chapterInvalid }).max(64, PERSONAL_QUESTION_MESSAGES.chapterInvalid).nullable().optional(),
    spIds: z
      .array(z.string({ error: PERSONAL_QUESTION_MESSAGES.spInvalid }).min(1, PERSONAL_QUESTION_MESSAGES.spInvalid).max(64, PERSONAL_QUESTION_MESSAGES.spInvalid), {
        error: PERSONAL_QUESTION_MESSAGES.spInvalid,
      })
      .max(3, PERSONAL_QUESTION_MESSAGES.spMax)
      .nullable()
      .optional(),
    tp: z
      .number({ error: PERSONAL_QUESTION_MESSAGES.tpRange })
      .int(PERSONAL_QUESTION_MESSAGES.tpRange)
      .min(1, PERSONAL_QUESTION_MESSAGES.tpRange)
      .max(6, PERSONAL_QUESTION_MESSAGES.tpRange)
      .nullable()
      .optional(),
    cognitiveLevel: z.enum(PERSONAL_QUESTION_COGNITIVE_LEVELS, { error: PERSONAL_QUESTION_MESSAGES.cognitive }).nullable().optional(),
    // A strict JSON integer 1..5 (no coercion), separate from `tp` and never derived from it.
    difficulty: z
      .number({ error: PERSONAL_QUESTION_MESSAGES.difficulty })
      .int(PERSONAL_QUESTION_MESSAGES.difficulty)
      .min(1, PERSONAL_QUESTION_MESSAGES.difficulty)
      .max(5, PERSONAL_QUESTION_MESSAGES.difficulty),
    text: z.string({ error: PERSONAL_QUESTION_MESSAGES.text }).trim().min(1, PERSONAL_QUESTION_MESSAGES.text).max(PERSONAL_QUESTION_TEXT_MAX, PERSONAL_QUESTION_MESSAGES.textLong),
    options: z.array(PersonalQuestionOptionSchema, { error: PERSONAL_QUESTION_MESSAGES.options }).meta({ minItems: 4, maxItems: 4 }),
    correctIndex: z
      .number({ error: PERSONAL_QUESTION_MESSAGES.correct })
      .int(PERSONAL_QUESTION_MESSAGES.correct)
      .min(0, PERSONAL_QUESTION_MESSAGES.correct)
      .max(3, PERSONAL_QUESTION_MESSAGES.correct),
    referenceUrl: z.string({ error: PERSONAL_QUESTION_MESSAGES.referenceUrl }).nullable().optional(),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if (v.options.length !== 4) bad('options', PERSONAL_QUESTION_MESSAGES.options)
    else {
      const texts = v.options.map((o) => (typeof o.text === 'string' ? o.text.trim() : ''))
      const empty = texts.findIndex((t) => t === '')
      const long = texts.findIndex((t) => charLen(t) > PERSONAL_QUESTION_OPTION_MAX)
      if (empty >= 0) bad('options', PERSONAL_QUESTION_MESSAGES.option(letter(empty)))
      else if (long >= 0) bad('options', PERSONAL_QUESTION_MESSAGES.optionLong(letter(long)))
    }
    const url = typeof v.referenceUrl === 'string' ? v.referenceUrl.trim() : ''
    if (url !== '') {
      if (!isHttpUrl(url)) bad('referenceUrl', PERSONAL_QUESTION_MESSAGES.referenceUrl)
      else if (charLen(url) > PERSONAL_QUESTION_URL_MAX) bad('referenceUrl', PERSONAL_QUESTION_MESSAGES.referenceUrlLong)
    }
  })
  .meta({ id: 'PersonalQuestionWrite' })
export type PersonalQuestionWriteInput = z.output<typeof PersonalQuestionWriteSchema>

/** A teacher's personal question (60 section 2.17.2); `GET /:id` returns the same shape as a list row. */
export const PersonalQuestionSchema = z
  .object({
    id: IdSchema,
    subjectId: IdSchema,
    subjectName: z.string(),
    educationLevelId: IdSchema.meta({ description: 'Tingkatan 1 to 5.' }),
    difficulty: z.number().int().min(1).max(5),
    text: z.string(),
    chapterId: IdSchema.nullable().meta({ description: 'Bab (D89).' }),
    spIds: z.array(IdSchema).max(3),
    tp: z.number().int().min(1).max(6).nullable(),
    cognitiveLevel: z.enum(PERSONAL_QUESTION_COGNITIVE_LEVELS).nullable(),
    options: z.array(PersonalQuestionOptionSchema).length(4),
    correctIndex: z.number().int().min(0).max(3),
    referenceUrl: z.string().nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'PersonalQuestion' })
export type PersonalQuestion = z.infer<typeof PersonalQuestionSchema>

/** Query of GET /guru/personal-questions: 20 per page; one filter "Tahap" (a Tingkatan id; query only). */
export const PersonalQuestionListQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    educationLevelId: IdSchema.optional(),
  })
  .meta({ id: 'PersonalQuestionListQuery' })

export const PersonalQuestionListResponseSchema = listEnvelopeOf(PersonalQuestionSchema).meta({ id: 'PersonalQuestionListResponse' })
export const PersonalQuestionResponseSchema = z.object({ data: PersonalQuestionSchema }).meta({ id: 'PersonalQuestionResponse' })
export const PersonalQuestionDeleteResponseSchema = z.object({ data: z.object({ deleted: z.literal(1) }) }).meta({ id: 'PersonalQuestionDeleteResponse' })
