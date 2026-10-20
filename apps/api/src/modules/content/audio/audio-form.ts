import {
  AUDIO_CHOICES,
  AUDIO_CREATE_STATUSES,
  AUDIO_MAX_BYTES,
  AUDIO_QUESTION_COUNT,
  AUDIO_SECTION_RANGES,
  CONTENT_MESSAGES,
  contentFileRefused,
  type AudioKbatStatus,
} from '@pp/contract'

import { isIdString } from '../../../db/ids'
import { sniffMime } from '../../files/content-inspect'
import {
  AUDIO_EXPLANATION_MAX,
  AUDIO_MIME_OF_EXTENSION,
  AUDIO_OPTION_MAX,
  AUDIO_QUESTION_TEXT_MAX,
  MAX_TRANSCRIPT_CHARS,
  type AudioExtension,
} from './audio.constants'
import { hasNul } from './null-char'

const REQUIRED = CONTENT_MESSAGES.fieldRequired
const INVALID = CONTENT_MESSAGES.fieldInvalid

/** A section file as multer hands it over (memory storage). */
export interface UploadedPart {
  fieldname: string
  originalname: string
  mimetype: string
  size: number
  buffer: Buffer
}

export interface ParsedAudioFile {
  /** Name as stored: a sanitised base and the validated extension. */
  fileName: string
  extension: AudioExtension
  bytes: Buffer
}

export interface ParsedSection {
  no: number
  title: string
  transcript: string | null
  questionFrom: number
  questionTo: number
  audio: ParsedAudioFile | null
}

export interface ParsedQuestion {
  no: number
  questionText: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctAnswer: 'A' | 'B' | 'C' | 'D'
  marks: number
  kbatLevel: number
  dskpSpId: string | null
  explanation: string | null
}

export interface ParsedSetInput {
  title: string
  educationLevelId: string
  subjectId: string
  status: AudioKbatStatus
  sourceLabel: string | null
  instructions: string | null
  sections: ParsedSection[]
  questions: ParsedQuestion[]
}

type Dict = Record<string, unknown>
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A text value: trimmed, blank is "absent" (null). Anything that is not a string or number is kept as is, so a type check can refuse it. */
function clean(v: unknown): unknown {
  if (v === undefined || v === null) return null
  // A NUL character cannot be stored; a non-string marker makes every type check refuse the field as invalid.
  if (hasNul(v)) return { nul: true }
  if (typeof v === 'string') {
    const t = v.trim()
    return t === '' ? null : t
  }
  return v
}

function asInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isInteger(v) ? v : undefined
  if (typeof v === 'string' && /^-?\d{1,15}$/.test(v.trim())) return Number(v.trim())
  return undefined
}

/** An id sent as a string or a number; null when it is not a canonical positive bigint. */
function asId(v: unknown): string | null {
  const text = typeof v === 'number' && Number.isSafeInteger(v) ? String(v) : typeof v === 'string' ? v.trim() : ''
  return /^[1-9]\d{0,18}$/.test(text) && isIdString(text) ? text : null
}

/** Row `n` (1-based) of `sections` / `questions`: an array, an object keyed by n (multipart), or flat keys. */
function indexed(body: Dict, group: 'sections' | 'questions', n: number): Dict {
  const g = body[group]
  if (Array.isArray(g)) {
    const items = g as unknown[]
    const byNo = items.find((x) => isDict(x) && asInt(x.no) === n)
    // multipart `sections[1]` becomes index 1 of a sparse array; a JSON array starts at index 0.
    const item = byNo ?? (items[0] === undefined && items[n] !== undefined ? items[n] : items[n - 1])
    if (isDict(item)) return item
  } else if (isDict(g)) {
    const item = g[String(n)]
    if (isDict(item)) return item
  }
  const out: Dict = {}
  const bracket = `${group}[${String(n)}][`
  const dotted = `${group}.${String(n)}.`
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith(bracket) && key.endsWith(']')) out[key.slice(bracket.length, -1)] = value
    else if (key.startsWith(dotted)) out[key.slice(dotted.length)] = value
  }
  return out
}

const SECTION_AUDIO_FIELD = /^(?:sections\[(\d+)\]\[audio\]|sections\.(\d+)\.audio)$/

/** The section audio parts by section number. A repeated part for one section keeps the first. */
function audioParts(files: readonly UploadedPart[]): Map<number, UploadedPart> {
  const out = new Map<number, UploadedPart>()
  for (const f of files) {
    const m = SECTION_AUDIO_FIELD.exec(f.fieldname)
    const n = m ? Number(m[1] ?? m[2]) : NaN
    if (Number.isInteger(n) && !out.has(n)) out.set(n, f)
  }
  return out
}

/** Lower case, spaces to "-", only a-z0-9_- kept, dots removed (the extension is added back), at most 100 chars. */
function safeBase(original: string, ext: string): string {
  const base = original.slice(0, original.length - ext.length - 1)
  return base
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 100)
}

/**
 * Checks one section file: the extension is allow-listed, the declared type is audio (or video/mp4), the size is
 * within the rule, and the BYTES really are the audio container of that extension. `x.html` declared as
 * `audio/mpeg`, or an executable renamed `x.mp3`, is refused.
 */
export function inspectAudio(part: UploadedPart, n: number): ParsedAudioFile | null {
  const name = part.originalname
  const dot = name.lastIndexOf('.')
  const ext = dot >= 0 ? name.slice(dot + 1).toLowerCase() : ''
  if (!Object.hasOwn(AUDIO_MIME_OF_EXTENSION, ext)) return null
  const extension = ext as AudioExtension
  const typeOk = part.mimetype === '' || part.mimetype.startsWith('audio/') || part.mimetype === 'video/mp4'
  if (!typeOk || part.buffer.length === 0 || part.buffer.length > AUDIO_MAX_BYTES) return null
  if (sniffMime(part.buffer) !== AUDIO_MIME_OF_EXTENSION[extension]) return null
  const base = safeBase(name, ext)
  return { fileName: `${base === '' ? `audio${String(n)}` : base}.${extension}`, extension, bytes: part.buffer }
}

function parseSections(body: Dict, files: readonly UploadedPart[], fields: Record<string, string>): ParsedSection[] {
  const parts = audioParts(files)
  return AUDIO_SECTION_RANGES.map(([from, to], i) => {
    const n = i + 1
    const raw = indexed(body, 'sections', n)
    const title = clean(raw.title)
    const transcript = clean(raw.transcript)
    let audio: ParsedAudioFile | null = null
    const part = parts.get(n)
    if (part) {
      audio = inspectAudio(part, n)
      if (!audio) fields[`sections.${String(n)}.audio`] = contentFileRefused(part.originalname || 'audio')
    }
    if (title !== null && (typeof title !== 'string' || title.length > 255)) fields[`sections.${String(n)}.title`] = INVALID
    if (transcript !== null && (typeof transcript !== 'string' || transcript.length > MAX_TRANSCRIPT_CHARS)) {
      fields[`sections.${String(n)}.transcript`] = INVALID
    }
    return {
      no: n,
      // The form pre-fills "Audio n"; an empty title falls back to it.
      title: typeof title === 'string' ? title : `Audio ${String(n)}`,
      transcript: typeof transcript === 'string' ? transcript : null,
      questionFrom: from,
      questionTo: to,
      audio,
    }
  })
}

function parseQuestions(body: Dict, fields: Record<string, string>): ParsedQuestion[] {
  return Array.from({ length: AUDIO_QUESTION_COUNT }, (_, i) => {
    const n = i + 1
    const raw = indexed(body, 'questions', n)
    const key = (name: string): string => `questions.${String(n)}.${name}`

    const text = (name: string, max: number): string => {
      const v = clean(raw[name])
      if (v === null) {
        fields[key(name)] = REQUIRED
        return ''
      }
      if (typeof v !== 'string' || v.length > max) {
        fields[key(name)] = INVALID
        return ''
      }
      return v
    }
    const questionText = text('questionText', AUDIO_QUESTION_TEXT_MAX)
    const optionA = text('optionA', AUDIO_OPTION_MAX)
    const optionB = text('optionB', AUDIO_OPTION_MAX)
    const optionC = text('optionC', AUDIO_OPTION_MAX)
    const optionD = text('optionD', AUDIO_OPTION_MAX)

    const answerRaw = clean(raw.correctAnswer)
    let correctAnswer: ParsedQuestion['correctAnswer'] = 'A'
    if (answerRaw === null) fields[key('correctAnswer')] = REQUIRED
    else if (typeof answerRaw !== 'string' || !(AUDIO_CHOICES as readonly string[]).includes(answerRaw.toUpperCase())) {
      fields[key('correctAnswer')] = INVALID
    } else correctAnswer = answerRaw.toUpperCase() as ParsedQuestion['correctAnswer']

    const ranged = (name: string, min: number, max: number, dflt: number): number => {
      const v = clean(raw[name])
      if (v === null) return dflt
      const num = asInt(v)
      if (num === undefined || num < min || num > max) {
        fields[key(name)] = INVALID
        return dflt
      }
      return num
    }
    const marks = ranged('marks', 1, 20, 1)
    const kbatLevel = ranged('kbatLevel', 1, 5, 3)

    const dskpRaw = clean(raw.dskpSpId)
    let dskpSpId: string | null = null
    if (dskpRaw !== null) {
      dskpSpId = asId(dskpRaw)
      if (dskpSpId === null) fields[key('dskpSpId')] = INVALID
    }
    const explanationRaw = clean(raw.explanation)
    if (explanationRaw !== null && (typeof explanationRaw !== 'string' || explanationRaw.length > AUDIO_EXPLANATION_MAX)) {
      fields[key('explanation')] = INVALID
    }

    return {
      no: n,
      questionText,
      optionA,
      optionB,
      optionC,
      optionD,
      correctAnswer,
      marks,
      kbatLevel,
      dskpSpId,
      explanation: typeof explanationRaw === 'string' ? explanationRaw : null,
    }
  })
}

/**
 * Turns the create body (multipart text parts plus the section files, or a JSON object) into the logical
 * structure of the contract. Field errors are collected under dotted keys (`sections.2.audio`,
 * `questions.5.optionA`); the caller refuses when `fields` is not empty. The user is never read from the body.
 */
export function parseCreateForm(rawBody: unknown, files: readonly UploadedPart[]): { value: ParsedSetInput; fields: Record<string, string> } {
  const body: Dict = isDict(rawBody) ? rawBody : {}
  const fields: Record<string, string> = {}

  const title = clean(body.title)
  if (title === null) fields.title = REQUIRED
  else if (typeof title !== 'string' || title.length > 255) fields.title = INVALID

  const levelRaw = clean(body.educationLevelId)
  const educationLevelId = asId(levelRaw)
  if (levelRaw === null) fields.educationLevelId = REQUIRED
  else if (educationLevelId === null) fields.educationLevelId = INVALID
  const subjectRaw = clean(body.subjectId)
  const subjectId = asId(subjectRaw)
  if (subjectRaw === null) fields.subjectId = REQUIRED
  else if (subjectId === null) fields.subjectId = INVALID

  const statusRaw = clean(body.status)
  let status: AudioKbatStatus = 'approved'
  if (statusRaw !== null) {
    if (typeof statusRaw !== 'string' || !(AUDIO_CREATE_STATUSES as readonly string[]).includes(statusRaw)) fields.status = INVALID
    else status = statusRaw as AudioKbatStatus
  }

  const sourceRaw = clean(body.sourceLabel)
  if (sourceRaw !== null && (typeof sourceRaw !== 'string' || sourceRaw.length > 255)) fields.sourceLabel = INVALID
  const instructionsRaw = clean(body.instructions)
  if (instructionsRaw !== null && (typeof instructionsRaw !== 'string' || instructionsRaw.length > 5000)) fields.instructions = INVALID

  const sections = parseSections(body, files, fields)
  const questions = parseQuestions(body, fields)

  return {
    fields,
    value: {
      title: typeof title === 'string' ? title : '',
      educationLevelId: educationLevelId ?? '',
      subjectId: subjectId ?? '',
      status,
      sourceLabel: typeof sourceRaw === 'string' ? sourceRaw : null,
      instructions: typeof instructionsRaw === 'string' ? instructionsRaw : null,
      sections,
      questions,
    },
  }
}
