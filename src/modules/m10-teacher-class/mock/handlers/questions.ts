/**
 * SRS M10 v1.18 §7 #51–#58 (S21 "Sumbang Soalan", S22 Tambah, S23 Detail, S24 Edit); all **T**.
 *
 * M04 owns the question store (D12): every write goes through `questions.createFromTeacher`,
 * `updateOwn`, `deleteOwn` and `importFromTeacher`, and the counts and the list come from the M04 query
 * Q-CONTRIB (`questions.contributions`, objective rows with `createdBy` = the viewer, PKSK excluded).
 * After every question created here (#53 and each valid row of #58) M14
 * `teacherGamification.onQuestionContributed(userId, questionId)` runs (XL3-12, BR-M10-21): +1 count,
 * +10 syiling, badges reached. Deleting never takes anything back.
 *
 * - #51 (BR-M10-21, BR-M10-23): `stats` Jumlah / Diluluskan / Menunggu / Digunakan; the 8 tiers with
 *   `reached` ⇔ Jumlah ≥ threshold; `nextTier` = the first tier not reached (`null` when all are);
 *   `breakdown` = top 10 subjects by count (ties by name) + "Lain" for the rest.
 * - #52: the viewer's questions, ids ascending, 20 per page.
 * - #53 (BR-M10-22, §5): `difficultyLevel` `easy`/`medium`/`hard` → 2/3/4 (or the M04 number 1–5); a
 *   new row is `pending_review`, active, `createdBy` = the viewer. An image arrives as a file
 *   (`questionImage`, JPEG/PNG/WebP ≤ 2 MB, only a `blob:mock/` reference is stored, D22) or as
 *   `questionImageUrl`.
 * - #54/#55/#56 (BR-M10-01, SEC-M10-07): a question that is not the viewer's own, or unknown, is a
 *   404. #55 keeps the saved difficulty when none is sent (DV-M10-15, INFERRED); an MCQ edit sends
 *   all four options by index (`id` 0–3, never trusted as a record id) and `correctOptionId`.
 * - #57: the CSV template. #58: the import of `csvFile` (see `csv.ts`); 422 for a missing or wrong
 *   file, missing columns or no data rows; otherwise 200 with `imported` and the failed rows.
 */

import {
  blob,
  created,
  int,
  notFound,
  ok,
  paged,
  pageParams,
  raw,
  route,
  validationError,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'
import {
  questions,
  type Question,
  type QuestionInput,
  type QuestionType,
} from '@/modules/m04-question-bank/mock'
import { teacherGamification } from '@/modules/m14-gamification/mock'

import { dskpRepo } from '../repository/dskp'
import {
  bodyOf,
  fileOf,
  intOf,
  listOf,
  MSG,
  teacherOnly,
  textOf,
  uploadRef,
  viewerId,
  type Body,
} from './common'
import { planImport, TEMPLATE_CSV, TEMPLATE_NAME } from './csv'

const PAGE_SIZE = 20
const TEXT_MAX = 2000
const OPTION_MAX = 500
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const IMAGE_MAX_BYTES = 2 * 1024 * 1024
const CSV_MAX_BYTES = 5 * 1024 * 1024
const QUESTION_TYPES: readonly QuestionType[] = [
  'mcq',
  'true_false',
  'short_answer',
  'fill_blank',
  'essay',
]
const SCRIPT_TYPES = ['rumi', 'arab', 'jawi', 'mixed'] as const

/** BR-M10-23 / FN-M10-7.1.3. */
const TIERS = [
  { name: 'Penyumbang Baru', threshold: 10, icon: 'fa-seedling' },
  { name: 'Penyumbang Aktif', threshold: 100, icon: 'fa-fire' },
  { name: 'Penyumbang Dedikasi', threshold: 500, icon: 'fa-award' },
  { name: 'Penyumbang Cemerlang', threshold: 1000, icon: 'fa-trophy' },
  { name: 'Penyumbang Terbilang', threshold: 2500, icon: 'fa-crown' },
  { name: 'Legenda Soalan', threshold: 5000, icon: 'fa-gem' },
  { name: 'Guru Maestro', threshold: 10000, icon: 'fa-star' },
  { name: 'Legenda Terulung', threshold: 50000, icon: 'fa-crown' },
] as const

const DIFFICULTY_LABELS: Readonly<Record<number, string>> = {
  1: 'Sangat Mudah',
  2: 'Mudah',
  3: 'Sederhana',
  4: 'Sukar',
  5: 'Sangat Sukar',
}

/** M04 BR-M04-02 labels. */
const STATUS_LABELS: Readonly<Record<string, string>> = {
  draft: 'Draf',
  pending_review: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
  archived: 'Diarkibkan',
  pending: 'Menunggu',
}

// ---------------------------------------------------------------------------------------------
// Response shapes
// ---------------------------------------------------------------------------------------------

/** One card of "Soalan Saya" (FN-M10-7.1.8). */
function summaryOf(q: Question) {
  const subject = q.subjectId === null ? undefined : curriculum.subject(q.subjectId)
  const level = q.educationLevelId === null ? undefined : curriculum.level(q.educationLevelId)
  return {
    id: q.id,
    questionType: q.questionType,
    questionText: q.questionText,
    subjectId: q.subjectId,
    subjectName: subject?.name ?? '',
    educationLevelId: q.educationLevelId,
    levelName: level?.name ?? '',
    difficultyLevel: q.difficultyLevel,
    difficultyLabel: DIFFICULTY_LABELS[q.difficultyLevel] ?? '',
    dskpTagged: q.dskpTagged,
    status: q.status,
    statusLabel: STATUS_LABELS[q.status] ?? q.status,
    isActive: q.isActive,
    options: q.options,
    correctAnswer: q.correctAnswer,
    explanation: q.explanation,
    source: q.sourceSet ?? q.sourceType ?? null,
    createdAt: q.createdAt,
  }
}

/** #53 / #54 / #55 `data`: the summary plus the S23 / S24 fields and the usage figures. */
function detailOf(q: Question) {
  const attempts = q.usage.attempts
  return {
    ...summaryOf(q),
    questionImage: q.questionImage,
    optionImages: q.optionImages,
    tfAnswer: q.tfAnswer,
    correctAnswerText: q.correctAnswerText,
    altAnswers: q.altAnswers,
    modelAnswer: q.modelAnswer,
    language: q.language,
    scriptType: q.scriptType,
    textDirection: q.textDirection,
    curriculumChapterId: q.curriculumChapterId,
    curriculumTopicId: q.curriculumTopicId,
    dskpSpId: q.dskpSpId,
    usage: {
      attempts,
      correct: q.usage.correct,
      accuracy: attempts === 0 ? 0 : Math.round((q.usage.correct / attempts) * 100),
    },
  }
}

/** The viewer's own objective question, or `undefined` (BR-M10-01: not own and unknown alike). */
function ownQuestion(req: MockRequest, id: number): Question | undefined {
  const q = questions.get(id)
  return q && q.createdBy === viewerId(req) && q.pkskDomainId === null ? q : undefined
}

// ---------------------------------------------------------------------------------------------
// Validation (§5)
// ---------------------------------------------------------------------------------------------

/** BR-M10-22: `easy`/`medium`/`hard` → 2/3/4, or the M04 number 1–5; `undefined` = not valid. */
export function mapDifficulty(value: unknown): number | undefined {
  if (value === 'easy') return 2
  if (value === 'medium') return 3
  if (value === 'hard') return 4
  const n = intOf(value)
  return n !== undefined && n >= 1 && n <= 5 ? n : undefined
}

/** `undefined` = nothing uploaded, a reference = accepted, `false` = refused (§5). */
function acceptImage(scope: string, value: unknown): string | false | undefined {
  const file = fileOf(value)
  if (!file) return undefined
  if (!IMAGE_TYPES.includes(file.type) || file.size > IMAGE_MAX_BYTES) return false
  return uploadRef(scope, file.name)
}

/** An option as sent: a string, `{text}` or `{optionText}`. */
function optionText(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'object' && value !== null) {
    const v = value as { text?: unknown; optionText?: unknown }
    return textOf(v.optionText) ?? textOf(v.text) ?? ''
  }
  return ''
}

/** The MCQ key as an index 0–3 from a number, a numeric string or a letter A–D. */
function keyIndex(value: unknown): number | undefined {
  const n = intOf(value)
  if (n !== undefined) return n >= 0 && n <= 3 ? n : undefined
  const t = textOf(value)?.toUpperCase()
  return t !== undefined && /^[A-D]$/.test(t) ? t.charCodeAt(0) - 65 : undefined
}

/** A comma list or the items: trimmed, empty items dropped. */
function altList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : []
  return items
    .filter((v): v is string => typeof v === 'string')
    .map((v) => v.trim())
    .filter((v) => v !== '')
}

type Parsed = { ok: true; input: QuestionInput } | { ok: false; fields: Record<string, string> }

/** The chapter, topic, DSKP and script fields shared by create (#53). */
function placement(
  b: Body,
  subjectId: number | undefined,
  levelId: number | undefined,
  fields: Record<string, string>,
): Pick<QuestionInput, 'curriculumChapterId' | 'curriculumTopicId' | 'dskpSpId' | 'scriptType'> {
  const out: Pick<
    QuestionInput,
    'curriculumChapterId' | 'curriculumTopicId' | 'dskpSpId' | 'scriptType'
  > = {}
  const blank = (v: unknown) => v === undefined || v === null || v === ''

  let chapterId: number | null = null
  if (!blank(b.curriculumChapterId)) {
    const id = intOf(b.curriculumChapterId)
    const chapter = id === undefined ? undefined : curriculum.chapter(id)
    if (
      !chapter ||
      (subjectId !== undefined && chapter.subjectId !== subjectId) ||
      (levelId !== undefined && chapter.educationLevelId !== levelId)
    ) {
      fields.curriculumChapterId = MSG.chapter
    } else chapterId = chapter.id
  }
  out.curriculumChapterId = chapterId

  let topicId: number | null = null
  if (!blank(b.curriculumTopicId)) {
    const id = intOf(b.curriculumTopicId)
    const topic = id === undefined ? undefined : curriculum.topic(id)
    if (!topic || chapterId === null || topic.chapterId !== chapterId) {
      fields.curriculumTopicId = MSG.topic
    } else topicId = topic.id
  }
  out.curriculumTopicId = topicId

  let spId: number | null = null
  if (!blank(b.dskpSpId)) {
    const id = intOf(b.dskpSpId)
    if (id === undefined || !dskpRepo.hasSp(id)) fields.dskpSpId = MSG.sp
    else spId = id
  }
  out.dskpSpId = spId

  const script = textOf(b.scriptType)
  if (script === undefined || script === '') out.scriptType = 'rumi'
  else if ((SCRIPT_TYPES as readonly string[]).includes(script)) {
    out.scriptType = script as (typeof SCRIPT_TYPES)[number]
  } else fields.scriptType = MSG.scriptType
  return out
}

/** Validates the S22 post (#53). */
export function parseCreate(b: Body): Parsed {
  const fields: Record<string, string> = {}

  const levelId = intOf(b.educationLevelId)
  if (levelId === undefined || !curriculum.level(levelId)) fields.educationLevelId = MSG.level
  const subjectId = intOf(b.subjectId)
  if (subjectId === undefined || !curriculum.subject(subjectId)) fields.subjectId = MSG.subject

  const type = textOf(b.questionType) as QuestionType | undefined
  if (type === undefined || !QUESTION_TYPES.includes(type)) fields.questionType = MSG.questionType

  const difficulty = mapDifficulty(b.difficultyLevel)
  if (difficulty === undefined) fields.difficultyLevel = MSG.difficulty

  const text = textOf(b.questionText) ?? ''
  if (text === '') fields.questionText = MSG.questionText
  else if ([...text].length > TEXT_MAX) fields.questionText = MSG.questionTextLong

  const image = acceptImage('question', b.questionImage)
  if (image === false) fields.questionImage = MSG.image
  const url = textOf(b.questionImageUrl)

  const values: Partial<QuestionInput> = {}
  if (type === 'mcq') {
    const options = (listOf(b, 'options', 4) ?? Array.from({ length: 4 }, () => undefined)).map(
      optionText,
    )
    if (options.some((o) => o === '')) fields.options = MSG.options
    else if (options.some((o) => [...o].length > OPTION_MAX)) fields.options = MSG.optionLong
    values.options = options
    const key = keyIndex(b.correctAnswer)
    if (key === undefined) fields.correctAnswer = MSG.correctAnswer
    else values.correctAnswer = key
    const images = (listOf(b, 'optionImages', 4) ?? []).map((v, i) => {
      const accepted = acceptImage('option', v)
      if (accepted === false) fields[`optionImages.${String(i)}`] = MSG.image
      return typeof accepted === 'string' ? accepted : null
    })
    if (images.length > 0)
      values.optionImages = Array.from({ length: 4 }, (_, i) => images[i] ?? null)
  } else if (type === 'true_false') {
    const tf = b.tfAnswer
    const flag =
      tf === true || tf === 'true' || tf === '1' || tf === 1
        ? true
        : tf === false || tf === 'false' || tf === '0' || tf === 0
          ? false
          : undefined
    if (flag === undefined) fields.tfAnswer = MSG.tfAnswer
    else values.tfAnswer = flag
  } else if (type === 'short_answer' || type === 'fill_blank') {
    const answer = textOf(b.correctAnswerText) ?? textOf(b.correctAnswer) ?? ''
    if (answer === '') fields.correctAnswer = MSG.correctAnswerText
    else if ([...answer].length > OPTION_MAX) fields.correctAnswer = MSG.correctAnswerLong
    else values.correctAnswerText = answer
    values.altAnswers = altList(b.altAnswers ?? b['altAnswers[]'])
  } else if (type === 'essay') {
    const model = textOf(b.modelAnswer) ?? ''
    values.modelAnswer = model === '' ? null : model
  }

  const explanation = textOf(b.explanation) ?? ''
  if (explanation !== '') values.explanation = explanation

  const place = placement(b, subjectId, levelId, fields)

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    input: {
      ...values,
      ...place,
      subjectId: subjectId as number,
      educationLevelId: levelId as number,
      difficultyLevel: difficulty as number,
      questionType: type,
      questionText: text,
      questionImage:
        typeof image === 'string' ? image : url !== undefined && url !== '' ? url : null,
    },
  }
}

/** Validates the S24 post (#55) against the saved question. */
function parseUpdate(b: Body, current: Question): Parsed {
  const fields: Record<string, string> = {}
  const patch: Partial<QuestionInput> = {}

  const text = textOf(b.questionText) ?? ''
  if (text === '') fields.questionText = MSG.questionText
  else if ([...text].length > TEXT_MAX) fields.questionText = MSG.questionTextLong
  else patch.questionText = text

  const d = b.difficultyLevel
  if (d !== undefined && d !== null && d !== '') {
    const mapped = mapDifficulty(d)
    if (mapped === undefined) fields.difficultyLevel = MSG.difficulty
    else patch.difficultyLevel = mapped
  }

  if (
    current.questionType === 'mcq' &&
    (b.options !== undefined || b.correctOptionId !== undefined)
  ) {
    const list = updateOptions(b)
    const options = Array.from({ length: 4 }, () => '')
    const seen = new Set<number>()
    for (const entry of list) {
      const id =
        typeof entry === 'object' && entry !== null
          ? intOf((entry as { id?: unknown }).id)
          : undefined
      if (id !== undefined && id >= 0 && id <= 3 && !seen.has(id)) {
        seen.add(id)
        options[id] = optionText(entry)
      }
    }
    if (seen.size !== 4 || options.some((o) => o === '')) fields.options = MSG.options
    else if (options.some((o) => [...o].length > OPTION_MAX)) fields.options = MSG.optionLong
    else patch.options = options
    const key = keyIndex(b.correctOptionId)
    if (key === undefined) fields.correctOptionId = MSG.correctAnswer
    else patch.correctAnswer = key
  }

  if (b.explanation !== undefined) {
    const e = textOf(b.explanation) ?? ''
    patch.explanation = e === '' ? null : e
  }

  const image = acceptImage('question', b.image ?? b.questionImage)
  if (image === false) fields.image = MSG.image
  else if (typeof image === 'string') patch.questionImage = image

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return { ok: true, input: patch as QuestionInput }
}

// ---------------------------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------------------------

export const questionRoutes: RouteDef[] = [
  route('GET', '/api/guru/contributions', [teacherOnly], (req) => {
    const { counts, bySubject } = questions.contributions(viewerId(req), { page: 1 })
    const named = [...bySubject.entries()]
      .flatMap(([subjectId, count]) => {
        const subject = typeof subjectId === 'number' ? curriculum.subject(subjectId) : undefined
        return subject ? [{ label: subject.name, count }] : []
      })
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    const rest = named.slice(10).reduce((sum, r) => sum + r.count, 0)
    const breakdown = named.slice(0, 10)
    if (rest > 0) breakdown.push({ label: 'Lain', count: rest })
    const tiers = TIERS.map((t) => ({ ...t, reached: counts.total >= t.threshold }))
    const next = tiers.find((t) => !t.reached)
    return raw(200, {
      stats: {
        total: counts.total,
        approved: counts.approved,
        pending: counts.pending,
        used: counts.used,
      },
      tiers,
      nextTier: next ? { name: next.name, threshold: next.threshold } : null,
      breakdown,
    })
  }),

  route('GET', '/api/guru/questions', [teacherOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const res = questions.contributions(viewerId(req), { page: page.page })
    return paged({ rows: res.rows.map(summaryOf), total: res.total }, page)
  }),

  route('POST', '/api/guru/questions', [teacherOnly], (req, ctx) => {
    const parsed = parseCreate(bodyOf(req))
    if (!parsed.ok) return validationError(parsed.fields)
    const now = ctx.clock.now()
    const userId = viewerId(req)
    const row = ctx.transaction(() => {
      const made = questions.createFromTeacher({ id: userId }, parsed.input, now)
      teacherGamification.onQuestionContributed(userId, made.id, now)
      return made
    })
    return created(detailOf(row))
  }),

  // Static segments beat `:id`, so the template is not shadowed by the detail route.
  route('GET', '/api/guru/questions/template', [teacherOnly], () =>
    blob(new Blob([TEMPLATE_CSV], { type: 'text/csv' }), TEMPLATE_NAME),
  ),

  route('POST', '/api/guru/questions/import', [teacherOnly], async (req, ctx) => {
    const value = bodyOf(req).csvFile
    let text: string
    if (value === undefined || value === null || value === '') {
      return validationError({ csvFile: MSG.csvRequired })
    }
    if (typeof value === 'string') {
      // JSON bodies (scripts, tests) may carry the file's text.
      if (new TextEncoder().encode(value).length > CSV_MAX_BYTES) {
        return validationError({ csvFile: MSG.csvFile })
      }
      text = value
    } else {
      const file = fileOf(value)
      if (!file) return validationError({ csvFile: MSG.csvRequired })
      if (!/\.(csv|txt)$/i.test(file.name) || file.size > CSV_MAX_BYTES || file.blob === null) {
        return validationError({ csvFile: MSG.csvFile })
      }
      text = await file.blob.text()
    }
    const plan = planImport(text)
    if (plan.missingColumns.length > 0) {
      return validationError({ csvFile: MSG.csvColumns(plan.missingColumns.join(', ')) })
    }
    if (plan.dataRows === 0) return validationError({ csvFile: MSG.csvNoData })

    const userId = viewerId(req)
    const now = ctx.clock.now()
    const made = ctx.transaction(() => {
      const rows = questions.importFromTeacher({ id: userId }, plan.rows, now)
      for (const q of rows) teacherGamification.onQuestionContributed(userId, q.id, now)
      return rows
    })
    return ok({ imported: made.length, failed: plan.failures })
  }),

  route(
    'GET',
    '/api/guru/questions/:id',
    [teacherOnly],
    (req) => {
      const q = ownQuestion(req, Number(req.params.id))
      return q ? ok(detailOf(q)) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'PUT',
    '/api/guru/questions/:id',
    [teacherOnly],
    (req, ctx) => {
      const current = ownQuestion(req, Number(req.params.id))
      if (!current) return notFound()
      const parsed = parseUpdate(bodyOf(req), current)
      if (!parsed.ok) return validationError(parsed.fields)
      const row = questions.updateOwn(
        { id: viewerId(req) },
        current.id,
        parsed.input,
        ctx.clock.now(),
      )
      return row ? ok(detailOf(row)) : notFound()
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/guru/questions/:id',
    [teacherOnly],
    (req) =>
      questions.deleteOwn({ id: viewerId(req) }, Number(req.params.id))
        ? ok({ removed: 1 })
        : notFound(),
    { params: { id: int() } },
  ),
]

/**
 * The MCQ options of #55: a JSON array of `{id, optionText}`, or the multipart keys
 * `options[i][id]` / `options[i][optionText]` of a PUT that carries an image.
 */
function updateOptions(b: Body): unknown[] {
  if (Array.isArray(b.options)) return b.options as unknown[]
  const out: Record<number, { id?: unknown; optionText?: unknown }> = {}
  for (const [key, value] of Object.entries(b)) {
    const m = /^options\[(\d+)\]\[(id|optionText|text)\]$/.exec(key)
    if (m) (out[Number(m[1])] ??= {})[m[2] === 'id' ? 'id' : 'optionText'] = value
  }
  return Object.values(out)
}
