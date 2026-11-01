/**
 * Boundary validation of the S2 / S4 form posts (SRS v1.16 §5, §7 #3 / #5; BR-M04-08).
 *
 * The body is multipart (the live form) or JSON. Multipart keys are the camelCase names of §7; the
 * lists use `options[0]`…`options[3]`, `optionImages[0]`…, `removeOptionImage[0]`… (the repeated key
 * `options[]`, and a JSON array, are accepted too). Every problem is collected, so the API answers
 * one `422` whose `fields` carry each message (the screen lists them in one alert).
 *
 * The messages of §5 are UNVERIFIED COPY (Laravel `ms` style). INFERRED (no live evidence): the server
 * also checks what the browser checks natively (all four MCQ options, `correctAnswer` 0–3), the
 * `language` and `pointsValue` values, that `dskpSpId` names a known SP, and the copy of those checks.
 *
 * Create needs `questionType`; edit keeps the saved type. Edit is a patch for the optional fields (an
 * absent one is unchanged, `''` clears it) and requires the same fields as create.
 */

import { curriculum } from '@/modules/m03-curriculum/mock'

import type { DskpStore } from './dskp-source'
import { isCognitive } from '../../lib/studio/dskp-tags'
import { storeUpload, uploadedFile } from './workflow-common'
import type { QuestionInput } from '../repository/questions'
import { visibleLevelIds } from '../repository/visible-levels'
import type { Language, Question, QuestionType } from '../repository/types'

export const QUESTION_TYPES: readonly QuestionType[] = [
  'mcq',
  'true_false',
  'short_answer',
  'fill_blank',
  'essay',
]

/** §5 messages (UNVERIFIED COPY unless native); the INFERRED ones are marked. */
export const QUESTION_MESSAGES = {
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tahap pendidikan.',
  difficulty: 'Sila pilih tahap kesukaran.',
  type: 'Jenis soalan tidak sah.',
  text: 'Teks soalan mesti sekurang-kurangnya 10 aksara.',
  image: 'Gambar mesti jenis JPG, PNG atau WebP dan tidak melebihi 2MB.',
  answerText: 'Sila masukkan jawapan betul.',
  /** INFERRED. */
  options: 'Sila isi semua pilihan jawapan.',
  correctAnswer: 'Sila pilih jawapan betul.',
  tfAnswer: 'Jawapan betul atau salah tidak sah.',
  points: 'Nilai mata mesti sekurang-kurangnya 1.',
  language: 'Bahasa tidak sah.',
  sp: 'SP DSKP tidak sah.',
  /** The contract `QuestionCognitiveLevelSchema` refusal. */
  cognitive: 'Aras pemikiran tidak sah.',
  /** Bab (D89), same copy as the contract `QUESTION_MESSAGES.guruChapter`. */
  guruChapter: 'Bab tidak sah.',
} as const

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_IMAGE_BYTES = 2 * 1024 * 1024

type Body = Readonly<Record<string, unknown>>

/** Fields of the parsed post: `input` is complete for a create and a patch for an edit. */
export type ParsedQuestion =
  | { ok: true; input: QuestionInput; type: QuestionType }
  | { ok: false; fields: Record<string, string> }

function objectOf(body: unknown): Body {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Body) : {}
}

function isBlob(value: unknown): value is Blob {
  return typeof Blob !== 'undefined' && value instanceof Blob
}

function intOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}

/** A trimmed string ('' is kept); anything else is `undefined`. */
function textOf(value: unknown): string | undefined {
  return typeof value === 'string' ? value.trim() : undefined
}

function flag(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

/** `name[0]…name[size-1]` from a JSON array, `name[]`, or indexed multipart keys. */
function indexed(body: Body, name: string, size: number): unknown[] {
  const out: unknown[] = Array.from({ length: size }, () => undefined)
  const direct = body[name] ?? body[`${name}[]`]
  const list = Array.isArray(direct) ? direct : direct === undefined ? [] : [direct]
  list.forEach((v, i) => {
    if (i < size) out[i] = v
  })
  for (let i = 0; i < size; i++) {
    const v = body[`${name}[${String(i)}]`]
    if (v !== undefined) out[i] = v
  }
  return out
}

/** `undefined` = nothing uploaded, a URL = accepted, `false` = rejected (§5). */
function acceptImage(value: unknown): string | false | undefined {
  if (!isBlob(value) || value.size === 0) return undefined
  if (!IMAGE_TYPES.includes(value.type) || value.size > MAX_IMAGE_BYTES) return false
  return storeUpload('question', uploadedFile(value) ?? { name: 'image' })
}

/** A comma list or the items: trimmed, empty items dropped (BR-M04-08). */
function altList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return items
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

/**
 * Validates a create (`current = null`) or an edit of `current`. On success `input` holds the values
 * to store (a create: every field; an edit: the fields to change).
 */
export function parseQuestionBody(
  body: unknown,
  current: Question | null,
  dskp: Pick<DskpStore, 'hasSp'>,
): ParsedQuestion {
  const b = objectOf(body)
  const fields: Record<string, string> = {}

  const subjectId = intOf(b.subjectId)
  if (subjectId === undefined || !curriculum.subject(subjectId))
    fields.subjectId = QUESTION_MESSAGES.subject
  const educationLevelId = intOf(b.educationLevelId)
  // D72: a hidden primary level (Darjah) is not a valid level on write, like an unknown one.
  if (
    educationLevelId === undefined ||
    !curriculum.level(educationLevelId) ||
    !visibleLevelIds().includes(educationLevelId)
  )
    fields.educationLevelId = QUESTION_MESSAGES.level
  const difficultyLevel = intOf(b.difficultyLevel)
  if (difficultyLevel === undefined || difficultyLevel < 1 || difficultyLevel > 5)
    fields.difficultyLevel = QUESTION_MESSAGES.difficulty

  let type: QuestionType = 'mcq'
  if (current) type = current.questionType
  else {
    const t = textOf(b.questionType)
    if (t !== undefined && (QUESTION_TYPES as readonly string[]).includes(t))
      type = t as QuestionType
    else fields.questionType = QUESTION_MESSAGES.type
  }

  const questionText = textOf(b.questionText) ?? ''
  if ([...questionText].length < 10) fields.questionText = QUESTION_MESSAGES.text

  // Images: a new file replaces the saved one; the remove flag clears it (S4).
  const newQuestionImage = acceptImage(b.questionImage)
  if (newQuestionImage === false) fields.questionImage = QUESTION_MESSAGES.image

  const values: Partial<QuestionInput> = {}

  if (type === 'mcq') {
    const options = indexed(b, 'options', 4).map((v) => textOf(v) ?? '')
    if (options.some((o) => o === '')) fields.options = QUESTION_MESSAGES.options
    values.options = options
    const removeFlags = indexed(b, 'removeOptionImage', 4).map(flag)
    const saved = current?.optionImages ?? []
    const images = indexed(b, 'optionImages', 4).map((v, i) => {
      const accepted = acceptImage(v)
      if (accepted === false) fields[`optionImages.${String(i)}`] = QUESTION_MESSAGES.image
      if (typeof accepted === 'string') return accepted
      return removeFlags[i] ? null : (saved[i] ?? null)
    })
    values.optionImages = images
    const correct = intOf(b.correctAnswer)
    if (correct === undefined || correct < 0 || correct > 3)
      fields.correctAnswer = QUESTION_MESSAGES.correctAnswer
    else values.correctAnswer = correct
  } else if (type === 'true_false') {
    const raw = b.tfAnswer
    if (raw === undefined) {
      if (!current) values.tfAnswer = null
    } else if (raw === null || raw === '') values.tfAnswer = null
    else if (raw === true || raw === 'true' || raw === '1' || raw === 1) values.tfAnswer = true
    else if (raw === false || raw === 'false' || raw === '0' || raw === 0) values.tfAnswer = false
    else fields.tfAnswer = QUESTION_MESSAGES.tfAnswer
  } else if (type === 'short_answer' || type === 'fill_blank') {
    const answer = textOf(b.correctAnswerText) ?? ''
    if (answer === '') fields.correctAnswerText = QUESTION_MESSAGES.answerText
    else values.correctAnswerText = answer
    if (b.altAnswers !== undefined || !current) values.altAnswers = altList(b.altAnswers)
  } else if (b.modelAnswer !== undefined || !current) {
    const model = textOf(b.modelAnswer) ?? ''
    values.modelAnswer = model === '' ? null : model
  }

  if (b.explanation !== undefined || !current) {
    const explanation = textOf(b.explanation) ?? ''
    values.explanation = explanation === '' ? null : explanation
  }

  let language: Language | undefined = current ? undefined : 'bm'
  const rawLanguage = textOf(b.language)
  if (rawLanguage !== undefined && rawLanguage !== '') {
    if (rawLanguage === 'bm' || rawLanguage === 'en') language = rawLanguage
    else fields.language = QUESTION_MESSAGES.language
  }
  if (language !== undefined) values.language = language

  const rawPoints = b.pointsValue
  if (rawPoints === undefined || rawPoints === null || rawPoints === '') {
    if (!current) values.pointsValue = 1
  } else {
    const points = intOf(rawPoints)
    if (points === undefined || points < 1) fields.pointsValue = QUESTION_MESSAGES.points
    else values.pointsValue = points
  }

  if ('dskpSpId' in b) {
    const raw = b.dskpSpId
    if (raw === null || raw === undefined || raw === '') values.dskpSpId = null
    else {
      const sp = intOf(raw)
      if (sp === undefined || !dskp.hasSp(sp)) fields.dskpSpId = QUESTION_MESSAGES.sp
      else values.dskpSpId = sp
    }
  } else if (!current) values.dskpSpId = null

  // Aras pemikiran (R1-B05 / T33): one of the six levels sets it, blank or null clears it, absent keeps it.
  if ('cognitiveLevel' in b) {
    const raw = b.cognitiveLevel
    if (raw === null || raw === undefined || raw === '') values.cognitiveLevel = null
    else if (isCognitive(raw)) values.cognitiveLevel = raw
    else fields.cognitiveLevel = QUESTION_MESSAGES.cognitive
  }

  // Bab: blank or null clears it, a number sets it, absent keeps it (the mock does not read M03's chapters).
  if ('curriculumChapterId' in b) {
    const raw = b.curriculumChapterId
    if (raw === null || raw === undefined || raw === '') values.curriculumChapterId = null
    else {
      const chapter = intOf(raw)
      if (chapter === undefined || chapter < 1) fields.curriculumChapterId = QUESTION_MESSAGES.guruChapter
      else values.curriculumChapterId = chapter
    }
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields }

  const input: QuestionInput = {
    ...values,
    subjectId: subjectId as number,
    educationLevelId: educationLevelId as number,
    difficultyLevel: difficultyLevel as number,
    questionText,
    ...(current ? {} : { questionType: type }),
    ...(typeof newQuestionImage === 'string'
      ? { questionImage: newQuestionImage }
      : flag(b.removeQuestionImage)
        ? { questionImage: null }
        : current
          ? {}
          : { questionImage: null }),
  }
  return { ok: true, input, type }
}
