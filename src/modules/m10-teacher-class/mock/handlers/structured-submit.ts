/**
 * API-GUR-17, structured variant (R1-GUR-44b, S6-T17; ADD-13): the teacher submits a structured question as
 * ONE guru intake batch with ONE structured item.
 *
 * | Route | Notes |
 * |---|---|
 * | `POST /api/guru/intake/structured` | 201 `{data: GuruStructuredDetail}`; strict JSON body; the total marks are computed |
 * | `PUT /api/guru/intake/structured/:id` | 200, the full body; 404 for an id that is not the viewer's own, 409 once accepted |
 * | `DELETE /api/guru/intake/structured/:id` | 200 `{data: {removed: 1}}`; same 404 / 409 |
 *
 * 422 `fields` keys are those of the contract: subjectId, educationLevelId, chapterId, spIds, tp, cognitiveLevel,
 * difficultyLevel, stimulus, stimulusImageId, parts, parts.{i}.text|marks|scheme|cognitiveLevel. The DSKP
 * conditional rule (D112) is not enforced here: the form decides it from the lookups. The reads (API-GUR-26)
 * are served by the M04 mock.
 */

import { toIsoMyt } from '@/lib/time'
import {
  conflict,
  created,
  notFound,
  ok,
  route,
  validationError,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import { COGNITIVE_LEVELS, STRUCTURED_COPY } from '../../lib/structured-form'
import { dskpRepo } from '../repository/dskp'
import { bodyOf, intOf, teacherOnly, viewerId, type Body } from './common'
import {
  guruSubmissions,
  type GuruSubmission,
  type GuruSubmissionInput,
} from '@/modules/m04-question-bank/mock'

/** `GURU_QUESTION_MESSAGES.locked`: the 409 of an edit or delete of an item that is no longer open. */
export const LOCKED_MESSAGE = 'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.'
const ALLOWED_KEYS = new Set([
  'subjectId',
  'educationLevelId',
  'chapterId',
  'spIds',
  'tp',
  'cognitiveLevel',
  'difficultyLevel',
  'stimulus',
  'stimulusImageId',
  'parts',
])
const PART_KEYS = new Set(['text', 'marks', 'scheme', 'cognitiveLevel'])
const LEVELS: readonly string[] = COGNITIVE_LEVELS.map((c) => c.value)

/** The zod 4 text of a strict-object violation: the BE returns it as is (key `_` at the root, `parts.{i}` in a part). */
const unrecognized = (keys: string[]): string =>
  keys.length === 1
    ? `Unrecognized key: "${keys[0] ?? ''}"`
    : `Unrecognized keys: ${keys.map((k) => `"${k}"`).join(', ')}`

type Parsed =
  { ok: true; input: GuruSubmissionInput } | { ok: false; fields: Record<string, string> }

const isNil = (v: unknown): v is null | undefined => v === null || v === undefined

/** Validates the strict body with the contract's keys and BM texts. */
export function parseStructuredBody(body: Body): Parsed {
  const f: Record<string, string> = {}
  const extra = Object.keys(body).filter((k) => !ALLOWED_KEYS.has(k))
  if (extra.length > 0) f._ = unrecognized(extra)

  const subjectId = intOf(body.subjectId)
  const educationLevelId = intOf(body.educationLevelId)
  if (subjectId === undefined || subjectId < 1) f.subjectId = STRUCTURED_COPY.subject
  if (educationLevelId === undefined || educationLevelId < 1)
    f.educationLevelId = STRUCTURED_COPY.level

  let chapterId: number | null = null
  if (!isNil(body.chapterId) && body.chapterId !== '') {
    const n = intOf(body.chapterId)
    if (n === undefined) f.chapterId = 'Bab tidak sah.'
    else chapterId = n
  }
  const spIds: number[] = []
  if (!isNil(body.spIds)) {
    const list = Array.isArray(body.spIds) ? (body.spIds as unknown[]) : null
    if (!list) f.spIds = 'SP tidak sah.'
    else if (list.length > 3) f.spIds = 'Satu soalan boleh mempunyai 1 hingga 3 SP sahaja.'
    else
      for (const x of list) {
        const n = intOf(x)
        if (n === undefined) f.spIds = 'SP tidak sah.'
        else spIds.push(n)
      }
  }
  let tp: number | null = null
  if (!isNil(body.tp)) {
    if (typeof body.tp !== 'number' || !Number.isInteger(body.tp) || body.tp < 1 || body.tp > 6)
      f.tp = STRUCTURED_COPY.tpRange
    else tp = body.tp
  }
  let cognitiveLevel: string | null = null
  if (!isNil(body.cognitiveLevel)) {
    if (typeof body.cognitiveLevel !== 'string' || !LEVELS.includes(body.cognitiveLevel))
      f.cognitiveLevel = STRUCTURED_COPY.cognitive
    else cognitiveLevel = body.cognitiveLevel
  }
  const difficulty = body.difficultyLevel
  if (
    typeof difficulty !== 'number' ||
    !Number.isInteger(difficulty) ||
    difficulty < 1 ||
    difficulty > 5
  )
    f.difficultyLevel = STRUCTURED_COPY.difficulty

  let stimulus = ''
  if (!isNil(body.stimulus)) {
    if (typeof body.stimulus !== 'string' || body.stimulus.length > 4000)
      f.stimulus = STRUCTURED_COPY.stimulusLong
    else stimulus = body.stimulus
  }
  let stimulusImageId: string | null = null
  if (!isNil(body.stimulusImageId)) {
    const id = body.stimulusImageId
    if (typeof id !== 'string' || id.length < 1 || id.length > 64)
      f.stimulusImageId = STRUCTURED_COPY.imageType
    else stimulusImageId = id
  }

  const parts: GuruSubmissionInput['parts'] = []
  if (!Array.isArray(body.parts) || body.parts.length < 1) f.parts = STRUCTURED_COPY.partsMin
  else if (body.parts.length > 10) f.parts = STRUCTURED_COPY.partsMax
  else
    (body.parts as unknown[]).forEach((raw, i) => {
      const p = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Body) : {}
      const at = (k: string) => `parts.${String(i)}.${k}`
      const extraPart = Object.keys(p).filter((k) => !PART_KEYS.has(k))
      if (extraPart.length > 0) f[`parts.${String(i)}`] = unrecognized(extraPart)
      const text = typeof p.text === 'string' ? p.text.trim() : ''
      if (text === '') f[at('text')] = STRUCTURED_COPY.partText
      else if (text.length > 2000) f[at('text')] = STRUCTURED_COPY.partTextLong
      const marks = p.marks
      if (typeof marks !== 'number' || !Number.isInteger(marks) || marks < 1 || marks > 20)
        f[at('marks')] = STRUCTURED_COPY.marks
      const scheme = typeof p.scheme === 'string' ? p.scheme.trim() : ''
      if (scheme === '') f[at('scheme')] = STRUCTURED_COPY.scheme
      else if (scheme.length > 2000) f[at('scheme')] = STRUCTURED_COPY.schemeLong
      let level: string | null = null
      if (!isNil(p.cognitiveLevel)) {
        if (typeof p.cognitiveLevel !== 'string' || !LEVELS.includes(p.cognitiveLevel))
          f[at('cognitiveLevel')] = STRUCTURED_COPY.cognitive
        else level = p.cognitiveLevel
      }
      parts.push({
        text,
        marks: typeof marks === 'number' ? marks : 0,
        scheme,
        cognitiveLevel: level as GuruSubmissionInput['cognitiveLevel'],
      })
    })

  if (Object.keys(f).length > 0) return { ok: false, fields: f }
  return {
    ok: true,
    input: {
      subjectId: subjectId as number,
      educationLevelId: educationLevelId as number,
      chapterId,
      spIds,
      tp,
      cognitiveLevel: cognitiveLevel as GuruSubmissionInput['cognitiveLevel'],
      difficultyLevel: difficulty as number,
      stimulus,
      stimulusImageId,
      parts,
    },
  }
}

/** `GuruStructuredDetail` of a submission (the answer of POST and PUT). */
function detailOf(r: GuruSubmission) {
  const subject = curriculum.subject(r.subjectId)
  const level = curriculum.level(r.educationLevelId)
  const totalMarks = r.parts.reduce((sum, p) => sum + p.marks, 0)
  return {
    id: r.id,
    subject: subject ? { id: subject.id, name: subject.name } : null,
    level: level ? { id: level.id, name: level.name } : null,
    kbat: '',
    status: r.editable ? ('review' as const) : ('approved' as const),
    stimulus: r.stimulus,
    stimulusImage:
      r.stimulusImageId && !r.stimulusImageId.startsWith('blob:mock/')
        ? `/api/files/${r.stimulusImageId}`
        : null,
    totalMarks,
    subCount: r.parts.length,
    subQuestions: r.parts.map((p, i) => ({
      partLabel: String.fromCharCode(97 + i),
      questionText: p.text,
      marks: p.marks,
      cognitiveLevel: p.cognitiveLevel,
      modelAnswer: p.scheme,
      depth: 0,
    })),
    createdAt: toIsoMyt(r.createdAtMs),
    source: 'submission' as const,
    editable: r.editable,
    form: {
      subjectId: r.subjectId,
      educationLevelId: r.educationLevelId,
      chapterId: r.chapterId,
      spIds: r.spIds,
      tp: r.tp,
      cognitiveLevel: r.cognitiveLevel,
      difficultyLevel: r.difficultyLevel,
      stimulusImageId: r.stimulusImageId,
      rejectionReason: r.rejectionReason,
    },
  }
}

/**
 * The BE's `resolveTags` + `guruDskpFields`: Subjek and Tingkatan must exist and be active (a Darjah is refused
 * like an unknown level, D72); the Bab must belong to them; then the D112 rule (Bab only where chapters exist,
 * SP, TP and Aras only where DSKP nodes exist). Returns the 422 `fields` (empty when fine).
 */
export function resolveTags(input: GuruSubmissionInput): Record<string, string> {
  const f: Record<string, string> = {}
  const subject = curriculum.subject(input.subjectId)
  const level = curriculum.level(input.educationLevelId)
  if (!subject || !subject.isActive) f.subjectId = STRUCTURED_COPY.subject
  if (!level || !level.isActive || level.stage === 'primary')
    f.educationLevelId = STRUCTURED_COPY.level
  if (f.subjectId || f.educationLevelId) return f

  const chapters = curriculum
    .chapters(input.subjectId, input.educationLevelId)
    .filter((c) => c.isActive)
  const sps = dskpRepo
    .bidang({ subjectId: input.subjectId, educationLevelId: input.educationLevelId })
    .flatMap((b) => dskpRepo.sk(b.id))
    .flatMap((k) => dskpRepo.sp(k.id))
  if (chapters.length > 0 && input.chapterId === null) f.chapterId = STRUCTURED_COPY.chapter
  if (sps.length > 0 && input.spIds.length === 0) f.spIds = STRUCTURED_COPY.sp
  if (sps.length > 0 && input.tp === null) f.tp = STRUCTURED_COPY.tp
  if (sps.length > 0 && input.cognitiveLevel === null) f.cognitiveLevel = STRUCTURED_COPY.cognitive
  if (input.chapterId !== null) {
    const chapter = chapters.find((c) => c.id === input.chapterId)
    if (!chapter) f.chapterId = 'Bab tidak sah.'
  }
  if (input.spIds.length > 0 && f.spIds === undefined) {
    const known = new Set(sps.map((x) => x.id))
    if (!input.spIds.every((id) => known.has(id))) f.spIds = 'SP tidak sah.'
  }
  return f
}

export const structuredSubmitRoutes: RouteDef[] = [
  route('POST', '/api/guru/intake/structured', [teacherOnly], (req, ctx) => {
    const parsed = parseStructuredBody(bodyOf(req))
    if (!parsed.ok) return validationError(parsed.fields)
    const tags = resolveTags(parsed.input)
    if (Object.keys(tags).length > 0) return validationError(tags)
    const row = guruSubmissions.add(viewerId(req), parsed.input, ctx.clock.now())
    return created(detailOf(row))
  }),
  route('PUT', '/api/guru/intake/structured/:id', [teacherOnly], (req) => {
    // Ownership first: another teacher's id is a 404 before the body is read.
    const row = guruSubmissions.getOwn(viewerId(req), String(req.params.id))
    if (!row) return notFound()
    // 409 before 422: an item that is no longer editable is refused whatever the body.
    if (!row.editable) return conflict(LOCKED_MESSAGE)
    const parsed = parseStructuredBody(bodyOf(req))
    if (!parsed.ok) return validationError(parsed.fields)
    const tags = resolveTags(parsed.input)
    if (Object.keys(tags).length > 0) return validationError(tags)
    return ok(detailOf(guruSubmissions.update(row, parsed.input)))
  }),
  route('DELETE', '/api/guru/intake/structured/:id', [teacherOnly], (req) => {
    const row = guruSubmissions.getOwn(viewerId(req), String(req.params.id))
    if (!row) return notFound()
    if (!row.editable) return conflict(LOCKED_MESSAGE)
    guruSubmissions.remove(row)
    return ok({ removed: 1 })
  }),
]
