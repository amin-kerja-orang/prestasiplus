/**
 * SRS M09 v1.6 §7 #21 `GET /api/admin/audio-kbat-sets` (S12), #22
 * `GET /api/admin/audio-kbat-sets/template` (the XLSX / Word template downloads, placeholder files,
 * OQ-M09-03) and #23 `POST /api/admin/audio-kbat-sets` (S13, multipart or JSON). Admin only.
 *
 * Create body: `title, educationLevelId, subjectId, status?, sourceLabel?, instructions?`, the 4
 * sections as `sections[n][title|audio|transcript]` and the 30 questions as
 * `questions[n][questionText|optionA|optionB|optionC|optionD|correctAnswer|marks|kbatLevel|dskpSpId|explanation]`
 * (n = 1…4 / 1…30). The live snake_case spellings (`education_level_id`, `question_text`, …) are
 * accepted too, and JSON bodies may send `sections` / `questions` as arrays or objects keyed by n.
 * Section files are checked in the mock (audio type, at most 20 MB) and kept as a stored file name
 * only (no real storage); the reader player #25 serves them as `/storage/audio-kbat/{id}/{name}`.
 */

import {
  blob,
  created,
  paginate,
  pageParams,
  queryInt,
  queryString,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { audioKbatRepo, M09Error } from '../repository'
import { QUESTION_COUNT, SECTION_RANGES } from '../repository/audio-support'
import type {
  AudioKbatQuestion,
  AudioKbatSection,
  AudioKbatSetRow,
  AudioKbatStatus,
} from '../types'
import {
  ADMIN_FLASH,
  adminOnly,
  asInt,
  bodyOf,
  clean,
  fileOf,
  MAX_LEN,
  pick,
  sanitiseName,
} from './admin-common'
import {
  FIELD_INVALID,
  FIELD_REQUIRED,
  levelRef,
  refusal,
  requireViewer,
  subjectRef,
} from './common'

export const AUDIO_PAGE_SIZE = 20
export const AUDIO_MAX_PAGE_SIZE = 100
export const MAX_AUDIO_BYTES = 20 * 1024 * 1024

export const STATUS_LABELS: Readonly<Record<AudioKbatStatus, string>> = {
  draft: 'Draft',
  pending_review: 'Pending Review',
  approved: 'Approved',
  archived: 'Archived',
}
const FILTER_STATUSES = Object.keys(STATUS_LABELS) as AudioKbatStatus[]
/** BR-M09-15: the create form has no "Archived" option. */
const CREATE_STATUSES: readonly AudioKbatStatus[] = ['approved', 'pending_review', 'draft']

const AUDIO_EXT = /\.(mp3|m4a|wav|ogg|aac|mp4)$/i

const listItem = (s: AudioKbatSetRow) => ({
  id: s.id,
  title: s.title,
  educationLevel: levelRef(s.educationLevelId) ?? { id: s.educationLevelId, name: '' },
  subject: subjectRef(s.subjectId) ?? { id: s.subjectId, name: '' },
  status: s.status,
  statusLabel: STATUS_LABELS[s.status],
  questionCount: s.questions.length,
})

/** The row `n` of `sections` / `questions` from an array, an object keyed by n, or flat keys. */
function indexed(
  body: Record<string, unknown>,
  group: 'sections' | 'questions',
  n: number,
): Record<string, unknown> {
  const g = body[group]
  if (Array.isArray(g)) {
    const items = g as unknown[]
    const byNo = items.find(
      (x) => typeof x === 'object' && x !== null && asInt((x as { no?: unknown }).no) === n,
    )
    const item = byNo ?? items[n - 1]
    if (typeof item === 'object' && item !== null) return item as Record<string, unknown>
  } else if (typeof g === 'object' && g !== null) {
    const item = (g as Record<string, unknown>)[String(n)]
    if (typeof item === 'object' && item !== null) return item as Record<string, unknown>
  }
  const out: Record<string, unknown> = {}
  const bracket = `${group}[${String(n)}][`
  const dotted = `${group}.${String(n)}.`
  for (const [key, value] of Object.entries(body)) {
    if (key.startsWith(bracket) && key.endsWith(']')) out[key.slice(bracket.length, -1)] = value
    else if (key.startsWith(dotted)) out[key.slice(dotted.length)] = value
  }
  return out
}

function parseSections(
  body: Record<string, unknown>,
  fields: Record<string, string>,
): AudioKbatSection[] {
  return SECTION_RANGES.map(([from, to], i) => {
    const n = i + 1
    const raw = indexed(body, 'sections', n)
    const title = clean(raw.title)
    const transcript = clean(raw.transcript)
    let audioFileName: string | null = null
    const file = fileOf(raw.audio)
    if (file) {
      // Both the declared type and the extension must be audio (SEC M-1): `x.html` declared as
      // `audio/mpeg` is refused. A file with no declared type is judged by its extension alone.
      const typeOk = file.type === '' || file.type.startsWith('audio/') || file.type === 'video/mp4'
      const ext = AUDIO_EXT.exec(file.name)?.[0].toLowerCase() ?? null
      if (!typeOk || ext === null || file.size > MAX_AUDIO_BYTES) {
        fields[`sections.${String(n)}.audio`] = `${file.name}: format atau saiz tidak dibenarkan.`
      } else {
        // Stored name = sanitised base + the validated extension; fallback `audio{n}`.
        const base = sanitiseName(file.name.slice(0, file.name.length - ext.length)).replace(
          /\./g,
          '',
        )
        audioFileName = `${base === '' ? `audio${String(n)}` : base}${ext}`
      }
    }
    if (
      title !== null &&
      title !== undefined &&
      (typeof title !== 'string' || title.length > 255)
    ) {
      fields[`sections.${String(n)}.title`] = FIELD_INVALID
    }
    if (transcript !== null && transcript !== undefined && typeof transcript !== 'string') {
      fields[`sections.${String(n)}.transcript`] = FIELD_INVALID
    }
    return {
      no: n,
      // The live form pre-fills "Audio n" (FN-M09-5.2.4); an empty title falls back to it.
      title: typeof title === 'string' ? title : `Audio ${String(n)}`,
      audioFileName,
      transcript: typeof transcript === 'string' ? transcript : null,
      questionFrom: from,
      questionTo: to,
    }
  })
}

function parseQuestions(
  body: Record<string, unknown>,
  fields: Record<string, string>,
): AudioKbatQuestion[] {
  return Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const n = i + 1
    const raw = indexed(body, 'questions', n)
    const key = (name: string): string => `questions.${String(n)}.${name}`

    const req = (name: string, max: number, ...spellings: string[]): string => {
      const v = clean(pick(raw, name, ...spellings))
      if (v === null || v === undefined) {
        fields[key(name)] = FIELD_REQUIRED
        return ''
      }
      if (typeof v !== 'string' || v.length > max) {
        fields[key(name)] = FIELD_INVALID
        return ''
      }
      return v
    }
    const questionText = req('questionText', MAX_LEN.questionText, 'question_text')
    const optionA = req('optionA', MAX_LEN.option, 'option_a')
    const optionB = req('optionB', MAX_LEN.option, 'option_b')
    const optionC = req('optionC', MAX_LEN.option, 'option_c')
    const optionD = req('optionD', MAX_LEN.option, 'option_d')

    const answerRaw = clean(pick(raw, 'correctAnswer', 'correct_answer'))
    let correctAnswer: AudioKbatQuestion['correctAnswer'] = 'A'
    if (answerRaw === null || answerRaw === undefined) fields[key('correctAnswer')] = FIELD_REQUIRED
    else if (
      typeof answerRaw !== 'string' ||
      !['A', 'B', 'C', 'D'].includes(answerRaw.toUpperCase())
    ) {
      fields[key('correctAnswer')] = FIELD_INVALID
    } else correctAnswer = answerRaw.toUpperCase() as AudioKbatQuestion['correctAnswer']

    const ranged = (name: string, spelling: string, min: number, max: number, dflt: number) => {
      const v = clean(pick(raw, name, spelling))
      if (v === null || v === undefined) return dflt
      const num = asInt(v)
      if (num === undefined || num < min || num > max) {
        fields[key(name)] = FIELD_INVALID
        return dflt
      }
      return num
    }
    const marks = ranged('marks', 'marks', 1, 20, 1)
    const kbatLevel = ranged('kbatLevel', 'kbat_level', 1, 5, 3)

    const dskpRaw = clean(pick(raw, 'dskpSpId', 'dskp_sp_id'))
    let dskpSpId: number | null = null
    if (dskpRaw !== null && dskpRaw !== undefined) {
      const num = asInt(dskpRaw)
      if (num === undefined || num < 1) fields[key('dskpSpId')] = FIELD_INVALID
      else dskpSpId = num
    }
    const explanationRaw = clean(raw.explanation)
    if (
      explanationRaw !== null &&
      explanationRaw !== undefined &&
      (typeof explanationRaw !== 'string' || explanationRaw.length > MAX_LEN.explanation)
    ) {
      fields[key('explanation')] = FIELD_INVALID
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

function createBody(set: AudioKbatSetRow) {
  return {
    ...listItem(set),
    sourceLabel: set.sourceLabel,
    instructions: set.instructions,
    sections: set.sections,
    createdAt: set.createdAt,
  }
}

export const adminAudioRoutes: RouteDef[] = [
  route('GET', '/api/admin/audio-kbat-sets', [adminOnly], (req) => {
    const page = pageParams(req.query, {
      pageSize: AUDIO_PAGE_SIZE,
      maxPageSize: AUDIO_MAX_PAGE_SIZE,
    })
    const educationLevelId = queryInt(req.query, 'educationLevelId')
    const subjectId = queryInt(req.query, 'subjectId')
    const status = queryString(req.query, 'status')?.trim() ?? ''
    const sets = audioKbatRepo.adminList({
      ...(educationLevelId !== undefined ? { educationLevelId } : {}),
      ...(subjectId !== undefined ? { subjectId } : {}),
      // INFERRED: an unknown status value is ignored (the live select only offers real ones).
      ...(FILTER_STATUSES.includes(status as AudioKbatStatus)
        ? { status: status as AudioKbatStatus }
        : {}),
      search: queryString(req.query, 'search') ?? '',
    })
    // The stat cards count every set, never the filtered ones (FR-M09-63).
    // Secondary-only (D72): sets of a hidden primary level are neither listed nor counted (rows stay stored).
    const isShown = (s: AudioKbatSetRow) => levelRef(s.educationLevelId) !== null
    const { sets: setCount, approved, draftOrPending, questions } = audioKbatRepo.stats(isShown)
    const shown = sets.filter(isShown)
    return paginate(shown.map(listItem), page, {
      stats: { sets: setCount, approved, draftPending: draftOrPending, questions },
    })
  }),

  route('GET', '/api/admin/audio-kbat-sets/template', [adminOnly], (req) => {
    const format = (queryString(req.query, 'format') ?? 'xlsx').trim().toLowerCase()
    if (format !== 'xlsx' && format !== 'docx') {
      return validationError({ format: FIELD_INVALID })
    }
    // OQ-M09-03: placeholder files, not real office documents.
    return format === 'xlsx'
      ? blob(
          new Blob(['Template Audio KBAT (contoh sahaja)\n'], {
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          }),
          'template-audio-kbat.xlsx',
        )
      : blob(
          new Blob(['Template Audio KBAT (contoh sahaja)\n'], {
            type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          'template-audio-kbat.docx',
        )
  }),

  route('POST', '/api/admin/audio-kbat-sets', [adminOnly], (req) => {
    const body = bodyOf(req.body)
    const fields: Record<string, string> = {}

    const title = clean(body.title)
    if (title === null || title === undefined) fields.title = FIELD_REQUIRED
    else if (typeof title !== 'string' || title.length > 255) fields.title = FIELD_INVALID

    const levelRaw = clean(pick(body, 'educationLevelId', 'education_level_id'))
    const educationLevelId = asInt(levelRaw)
    if (levelRaw === null || levelRaw === undefined) fields.educationLevelId = FIELD_REQUIRED
    else if (
      educationLevelId === undefined ||
      !curriculum.level(educationLevelId) ||
      curriculum.isLevelHidden(educationLevelId)
    ) {
      fields.educationLevelId = FIELD_INVALID
    }
    const subjectRaw = clean(pick(body, 'subjectId', 'subject_id'))
    const subjectId = asInt(subjectRaw)
    if (subjectRaw === null || subjectRaw === undefined) fields.subjectId = FIELD_REQUIRED
    else if (subjectId === undefined || !curriculum.subject(subjectId)) {
      fields.subjectId = FIELD_INVALID
    }

    const statusRaw = clean(body.status)
    let status: AudioKbatStatus = 'approved'
    if (statusRaw !== null && statusRaw !== undefined) {
      if (
        typeof statusRaw !== 'string' ||
        !CREATE_STATUSES.includes(statusRaw as AudioKbatStatus)
      ) {
        fields.status = FIELD_INVALID
      } else status = statusRaw as AudioKbatStatus
    }

    const sourceRaw = clean(pick(body, 'sourceLabel', 'source_label'))
    if (
      sourceRaw !== null &&
      sourceRaw !== undefined &&
      (typeof sourceRaw !== 'string' || sourceRaw.length > 255)
    ) {
      fields.sourceLabel = FIELD_INVALID
    }
    const instructionsRaw = clean(body.instructions)
    if (
      instructionsRaw !== null &&
      instructionsRaw !== undefined &&
      (typeof instructionsRaw !== 'string' || instructionsRaw.length > MAX_LEN.instructions)
    ) {
      fields.instructions = FIELD_INVALID
    }

    const sections = parseSections(body, fields)
    const questions = parseQuestions(body, fields)
    if (Object.keys(fields).length > 0) return validationError(fields)

    try {
      const row = audioKbatRepo.create(requireViewer(req).id, {
        title: title as string,
        educationLevelId: educationLevelId as number,
        subjectId: subjectId as number,
        status,
        sourceLabel: typeof sourceRaw === 'string' ? sourceRaw : null,
        instructions: typeof instructionsRaw === 'string' ? instructionsRaw : null,
        sections,
        questions,
      })
      return created(createBody(row), { status: ADMIN_FLASH.audioCreated })
    } catch (error) {
      if (error instanceof M09Error) return refusal(error)
      throw error
    }
  }),
]
