/**
 * API-GUR-24 "Soalan & Rujukan" (S6-T16; PRD-60 2.17.2, PRD-20 R1-GUR-44a): `GET/POST /api/guru/personal-questions`,
 * `GET/PUT/DELETE /:id`. Guard: teacher or admin (**T**).
 *
 * - The list is the viewer's own questions, newest first, 20 per page, with the `educationLevelId` filter; the response
 *   rows and the `GET /:id` detail are one `PersonalQuestion` shape. Another teacher's id and an unknown id are 404.
 * - The body (POST and PUT alike): `subjectId`, `educationLevelId` (Tingkatan 1 to 5), the four DSKP fields under the
 *   conditional rule of D112 (`placement` of the bank form: same ids and texts), `difficulty` 1..5, `text` (2000),
 *   four `options {text}` (500 each), `correctIndex` 0..3 and `referenceUrl` (http or https only, 2048).
 * - DELETE answers `{deleted: 1}`; a question drawn into an active Misi is `409` "Soalan sedang digunakan dalam misi."
 *   and stays (the seed rule sets `inActiveMission`, see `seeds/personal-questions.ts`).
 */

import {
  conflict,
  created,
  int,
  notFound,
  ok,
  paged,
  pageParams,
  route,
  validationError,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { toIsoMyt } from '@/lib/time'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { personalQuestionsRepo } from '../repository/personal-questions'
import type { PersonalQuestionInput } from '../repository/personal-questions'
import type { PersonalQuestionRow } from '../repository/types'
import { bodyOf, intOf, listOf, teacherOnly, textOf, viewerId, type Body } from './common'
import { mapDifficulty, placement } from './questions'

const PAGE_SIZE = 20
const TEXT_MAX = 2000
const OPTION_MAX = 500
const URL_MAX = 2048

/** The 44a field texts (the same strings as the real API, PRD-20 field table and PRD-60 rules). */
export const PQ_MESSAGES = {
  subject: 'Sila pilih subjek.',
  level: 'Sila pilih tingkatan.',
  difficulty: 'Sila pilih kesukaran.',
  text: 'Sila isi teks soalan.',
  textLong: 'Teks soalan tidak boleh melebihi 2000 aksara.',
  url: 'Pautan mesti bermula dengan http:// atau https://.',
  urlLong: 'Pautan tidak boleh melebihi 2048 aksara.',
  option: (letter: string): string => `Sila isi pilihan ${letter}.`,
  optionLong: (letter: string): string => `Pilihan ${letter} tidak boleh melebihi 500 aksara.`,
  correct: 'Sila tanda satu jawapan yang betul.',
  inUse: 'Soalan sedang digunakan dalam misi.',
} as const

const LETTERS = ['A', 'B', 'C', 'D'] as const
const len = (text: string): number => [...text].length

/** Only an http or https address with a host (`javascript:`, `ftp:`, `data:` are refused). */
function isHttpUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value)) return false
  try {
    const u = new URL(value)
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname !== ''
  } catch {
    return false
  }
}

/** An option as sent: `{text}`. */
function optionText(value: unknown): string {
  if (typeof value === 'object' && value !== null)
    return textOf((value as { text?: unknown }).text) ?? ''
  return ''
}

type Parsed =
  { ok: true; input: PersonalQuestionInput } | { ok: false; fields: Record<string, string> }

/** Validates the body of POST and PUT. */
export function parsePersonal(b: Body, ownerId: number): Parsed {
  const fields: Record<string, string> = {}

  const subjectId = intOf(b.subjectId)
  if (subjectId === undefined || !curriculum.subject(subjectId))
    fields.subjectId = PQ_MESSAGES.subject

  const levelId = intOf(b.educationLevelId)
  const level = levelId === undefined ? undefined : curriculum.level(levelId)
  if (!level || !/^Tingkatan [1-5]$/.test(level.name)) fields.educationLevelId = PQ_MESSAGES.level

  const difficulty = mapDifficulty(b.difficulty)
  if (difficulty === undefined) fields.difficulty = PQ_MESSAGES.difficulty

  const text = textOf(b.text) ?? ''
  if (text === '') fields.text = PQ_MESSAGES.text
  else if (len(text) > TEXT_MAX) fields.text = PQ_MESSAGES.textLong

  const options = (listOf(b, 'options', 4) ?? Array.from({ length: 4 }, () => undefined)).map(
    optionText,
  )
  for (const [i, letter] of LETTERS.entries()) {
    const o = options[i] ?? ''
    if (o === '') fields.options ??= PQ_MESSAGES.option(letter)
    else if (len(o) > OPTION_MAX) fields.options ??= PQ_MESSAGES.optionLong(letter)
  }

  const key = intOf(b.correctIndex)
  if (key === undefined || key < 0 || key > 3) fields.correctIndex = PQ_MESSAGES.correct

  let referenceUrl: string | null = null
  const link = textOf(b.referenceUrl) ?? ''
  if (link !== '') {
    if (len(link) > URL_MAX) fields.referenceUrl = PQ_MESSAGES.urlLong
    else if (!isHttpUrl(link)) fields.referenceUrl = PQ_MESSAGES.url
    else referenceUrl = link
  }

  const place = placement(b, subjectId, levelId, fields)

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    input: {
      ownerId,
      subjectId: subjectId as number,
      educationLevelId: levelId as number,
      difficulty: difficulty as number,
      text,
      chapterId: place.curriculumChapterId ?? null,
      spIds: place.extra.spIds,
      tp: place.extra.tp,
      cognitiveLevel: place.extra.cognitiveLevel,
      options,
      correctIndex: key as number,
      referenceUrl,
    },
  }
}

/** `PersonalQuestion` (PRD-60 2.17.2). */
function viewOf(q: PersonalQuestionRow) {
  return {
    id: q.id,
    subjectId: q.subjectId,
    subjectName: curriculum.subject(q.subjectId)?.name ?? '',
    educationLevelId: q.educationLevelId,
    difficulty: q.difficulty,
    text: q.text,
    chapterId: q.chapterId,
    spIds: q.spIds,
    tp: q.tp,
    cognitiveLevel: q.cognitiveLevel,
    options: q.options.map((text) => ({ text })),
    correctIndex: q.correctIndex,
    referenceUrl: q.referenceUrl,
    createdAt: q.createdAt,
  }
}

const own = (req: MockRequest): PersonalQuestionRow | undefined =>
  personalQuestionsRepo.getOwn(viewerId(req), Number(req.params.id))

export const personalQuestionRoutes: RouteDef[] = [
  route('GET', '/api/guru/personal-questions', [teacherOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const asked = req.query.educationLevelId
    const levelId = intOf(typeof asked === 'string' ? asked : undefined)
    const rows = personalQuestionsRepo.forOwner(viewerId(req), levelId)
    const from = (page.page - 1) * page.pageSize
    return paged(
      { rows: rows.slice(from, from + page.pageSize).map(viewOf), total: rows.length },
      page,
    )
  }),

  route('POST', '/api/guru/personal-questions', [teacherOnly], (req, ctx) => {
    const parsed = parsePersonal(bodyOf(req), viewerId(req))
    if (!parsed.ok) return validationError(parsed.fields)
    return created(viewOf(personalQuestionsRepo.create(parsed.input, toIsoMyt(ctx.clock.now()))))
  }),

  route(
    'GET',
    '/api/guru/personal-questions/:id',
    [teacherOnly],
    (req) => {
      const q = own(req)
      return q ? ok(viewOf(q)) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'PUT',
    '/api/guru/personal-questions/:id',
    [teacherOnly],
    (req) => {
      const current = own(req)
      if (!current) return notFound()
      const parsed = parsePersonal(bodyOf(req), current.ownerId)
      if (!parsed.ok) return validationError(parsed.fields)
      return ok(viewOf(personalQuestionsRepo.update(current.id, parsed.input)))
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/guru/personal-questions/:id',
    [teacherOnly],
    (req) => {
      const current = own(req)
      if (!current) return notFound()
      if (current.inActiveMission) return conflict(PQ_MESSAGES.inUse)
      personalQuestionsRepo.remove(current.id)
      return ok({ deleted: 1 })
    },
    { params: { id: int() } },
  ),
]
