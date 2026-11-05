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
 * - #53 (API-GUR-18, 44-F1): MCQ only; `difficultyLevel` is an int 1–5 (the words easy/medium/hard are refused);
 *   `chapterId` is required iff the Subjek + Tingkatan has chapters, `spIds` / `tp` / `cognitiveLevel` iff it has DSKP
 *   nodes (D112); a new row is `pending_review` (shown "Menunggu Semakan"), active, `createdBy` = the viewer. No image fields in this flow.
 * - #54/#55/#56 (BR-M10-01, SEC-M10-07): a question that is not the viewer's own, or unknown, is a
 *   404. #55 takes the same body and rules as #53 (the edit form sends every field; `correctOptionId`
 *   is an alias of `correctAnswer`).
 * - #57: the CSV template. #58: the import of `csvFile` (see `csv.ts`); 422 for a missing or wrong
 *   file (`.csv`, 2 MB, 500 rows), missing columns or no data rows; otherwise 200 with `imported` and `errors`.
 * - #55/#56 act only while the item is pending (else 409). Status words: pending / approved / rejected.
 */

import {
  blob,
  conflict,
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
import { QUESTION_MESSAGES } from '@pp/contract'
import { parseCsv } from '@/modules/m04-question-bank/mock'
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
  viewerId,
  type Body,
} from './common'
import { MAX_ROWS, MSG_TOO_MANY, planImport, TEMPLATE_CSV, TEMPLATE_NAME } from './csv'

const PAGE_SIZE = 20
const TEXT_MAX = 2000
const OPTION_MAX = 500
const CSV_MAX_BYTES = 2 * 1024 * 1024
const QUESTION_TYPES: readonly QuestionType[] = ['mcq']
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

/** The 44-F1 / 44-F3 texts (the same strings as the real API). */
const QMSG = {
  level: 'Sila pilih tingkatan.',
  subject: 'Sila pilih subjek.',
  difficulty: 'Sila pilih kesukaran.',
  chapterId: 'Sila pilih bab.',
  spIds: 'Sila pilih Standard Pembelajaran (SP).',
  tp: 'Sila pilih TP.',
  tpRange: 'Tahap Penguasaan (TP) mesti antara 1 dan 6.',
  cognitiveLevel: 'Sila pilih aras pemikiran.',
  csvNone: 'Sila pilih fail.',
  csvType: 'Jenis fail tidak disokong. Format dibenarkan: CSV.',
  csvSize: 'Fail melebihi saiz maksimum 2 MB.',
  csvColumns: (cols: string): string =>
    `Lajur wajib tiada: ${cols}. Gunakan templat yang disediakan.`,
  locked: 'Soalan ini sudah diterima atau diluluskan dan tidak boleh diubah.',
} as const
const ARAS = ['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta']

/** DSKP fields the M04 store has no column for (the mock keeps them beside the question). */
const dskpExtra = new Map<
  number,
  { spIds: number[]; tp: number | null; cognitiveLevel: string | null }
>()

const DIFFICULTY_LABELS: Readonly<Record<number, string>> = {
  1: 'Sangat Mudah',
  2: 'Mudah',
  3: 'Sederhana',
  4: 'Sukar',
  5: 'Sangat Sukar',
}
const STATUS_WORDS = {
  pending: 'Menunggu Semakan',
  approved: 'Diluluskan',
  rejected: 'Ditolak',
} as const

/** M04 status → the teacher's three words (FR-GUR-44-10). */
function statusOf(q: Question): 'pending' | 'approved' | 'rejected' {
  if (q.status === 'approved') return 'approved'
  if (q.status === 'rejected') return 'rejected'
  return 'pending'
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
    status: statusOf(q),
    statusLabel: STATUS_WORDS[statusOf(q)],
    rejectionReason: null,
    editable: statusOf(q) === 'pending',
    options: q.options ?? [],
    correctAnswer: q.correctAnswer ?? 0,
    explanation: q.explanation,
    createdAt: q.createdAt,
  }
}

/** #53 / #54 / #55 `data`: the summary plus the DSKP fields of 44-F1 (`QuestionGuruDetail`). */
function detailOf(q: Question) {
  return {
    ...summaryOf(q),
    chapterId: q.curriculumChapterId,
    spIds: dskpExtra.get(q.id)?.spIds ?? (q.dskpSpId === null ? [] : [q.dskpSpId]),
    tp: dskpExtra.get(q.id)?.tp ?? null,
    cognitiveLevel: dskpExtra.get(q.id)?.cognitiveLevel ?? null,
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

/** Kesukaran: an int 1 to 5 (a word such as `easy` is refused); `undefined` = not valid. */
export function mapDifficulty(value: unknown): number | undefined {
  if (typeof value === 'string' && !/^\s*\d+\s*$/.test(value)) return undefined
  const n = intOf(value)
  return n !== undefined && n >= 1 && n <= 5 ? n : undefined
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

type Parsed =
  | { ok: true; input: QuestionInput; extra?: Place['extra'] }
  | { ok: false; fields: Record<string, string> }

export type Place = Pick<QuestionInput, 'curriculumChapterId' | 'dskpSpId' | 'scriptType'> & {
  extra: { spIds: number[]; tp: number | null; cognitiveLevel: string | null }
}

/** The SP of a Subjek + Tingkatan (flattened Bidang → SK → SP): "DSKP nodes exist" when not empty. */
function spsOf(subjectId: number, levelId: number): number[] {
  return dskpRepo
    .bidang({ subjectId, educationLevelId: levelId })
    .flatMap((b) => dskpRepo.sk(b.id))
    .flatMap((k) => dskpRepo.sp(k.id))
    .map((sp) => sp.id)
}

/** The Bab, SP, TP, Aras and script fields of create (#53) under the conditional rule of D112. */
export function placement(
  b: Body,
  subjectId: number | undefined,
  levelId: number | undefined,
  fields: Record<string, string>,
): Place {
  const blank = (v: unknown) => v === undefined || v === null || v === ''
  const known = subjectId !== undefined && levelId !== undefined
  const chapters = known ? curriculum.chapters(subjectId, levelId).filter((c) => c.isActive) : []
  const spPool = known ? spsOf(subjectId, levelId) : []

  let chapterId: number | null = null
  if (!blank(b.chapterId)) {
    const id = intOf(b.chapterId)
    const chapter = chapters.find((c) => c.id === id)
    if (!chapter) fields.chapterId = QMSG.chapterId
    else chapterId = chapter.id
  } else if (chapters.length > 0 && known) fields.chapterId = QMSG.chapterId

  const spIds = (listOf(b, 'spIds') ?? [])
    .filter((v) => !blank(v))
    .map((v) => intOf(v))
    .filter((v): v is number => v !== undefined)
  if (
    spIds.length > 3 ||
    spIds.some((id) => !dskpRepo.hasSp(id) || (known && spPool.length > 0 && !spPool.includes(id)))
  ) {
    fields.spIds = QMSG.spIds
  } else if (spIds.length === 0 && spPool.length > 0) fields.spIds = QMSG.spIds

  let tp: number | null = null
  if (blank(b.tp)) {
    if (spPool.length > 0) fields.tp = QMSG.tp
  } else {
    const n = intOf(b.tp)
    if (n === undefined || n < 1 || n > 6) fields.tp = QMSG.tpRange
    else tp = n
  }

  let cognitiveLevel: string | null = null
  const aras = textOf(b.cognitiveLevel) ?? ''
  if (aras === '') {
    if (spPool.length > 0) fields.cognitiveLevel = QMSG.cognitiveLevel
  } else if (!ARAS.includes(aras)) fields.cognitiveLevel = QMSG.cognitiveLevel
  else cognitiveLevel = aras

  const out: Place = {
    curriculumChapterId: chapterId,
    dskpSpId: spIds[0] ?? null,
    extra: { spIds, tp, cognitiveLevel },
  }
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
  if (levelId === undefined || !curriculum.level(levelId)) fields.educationLevelId = QMSG.level
  const subjectId = intOf(b.subjectId)
  if (subjectId === undefined || !curriculum.subject(subjectId)) fields.subjectId = QMSG.subject

  const sent = textOf(b.questionType)
  const type = (sent === undefined || sent === '' ? 'mcq' : sent) as QuestionType
  if (!QUESTION_TYPES.includes(type)) fields.questionType = MSG.questionType

  const difficulty = mapDifficulty(b.difficultyLevel)
  if (difficulty === undefined) fields.difficultyLevel = QMSG.difficulty

  const text = textOf(b.questionText) ?? ''
  if (text === '') fields.questionText = MSG.questionText
  else if ([...text].length > TEXT_MAX) fields.questionText = MSG.questionTextLong

  const values: Partial<QuestionInput> = {}
  const options = (listOf(b, 'options', 4) ?? Array.from({ length: 4 }, () => undefined)).map(
    optionText,
  )
  if (options.some((o) => o === '')) fields.options = MSG.options
  else if (options.some((o) => [...o].length > OPTION_MAX)) fields.options = MSG.optionLong
  values.options = options
  const key = keyIndex(b.correctAnswer ?? b.correctOptionId)
  if (key === undefined) fields.correctAnswer = MSG.correctAnswer
  else values.correctAnswer = key
  const explanation = textOf(b.explanation) ?? ''
  if (b.explanation !== undefined) values.explanation = explanation === '' ? null : explanation

  const { extra, ...place } = placement(b, subjectId, levelId, fields)

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    extra,
    input: {
      ...values,
      ...place,
      subjectId: subjectId as number,
      educationLevelId: levelId as number,
      difficultyLevel: difficulty as number,
      questionType: type,
      questionText: text,
    },
  }
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
      if (parsed.extra) dskpExtra.set(made.id, parsed.extra)
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
      return validationError({ csvFile: QMSG.csvNone })
    }
    if (typeof value === 'string') {
      // JSON bodies (scripts, tests) may carry the file's text.
      if (new TextEncoder().encode(value).length > CSV_MAX_BYTES) {
        return validationError({ csvFile: QMSG.csvSize })
      }
      text = value
    } else {
      const file = fileOf(value)
      if (!file) return validationError({ csvFile: QMSG.csvNone })
      if (!/\.csv$/i.test(file.name)) return validationError({ csvFile: QMSG.csvType })
      if (file.size > CSV_MAX_BYTES) return validationError({ csvFile: QMSG.csvSize })
      if (file.blob === null) return validationError({ csvFile: QMSG.csvNone })
      text = await file.blob.text()
    }
    if (parseCsv(text).length - 1 > MAX_ROWS) return validationError({ csvFile: MSG_TOO_MANY })
    const plan = planImport(text)
    if (plan.missingColumns.length > 0) {
      return validationError({ csvFile: QMSG.csvColumns(plan.missingColumns.join(', ')) })
    }
    if (plan.dataRows === 0) return validationError({ csvFile: MSG.csvNoData })

    const userId = viewerId(req)
    const now = ctx.clock.now()
    const made = ctx.transaction(() => {
      const rows = questions.importFromTeacher({ id: userId }, plan.rows, now)
      for (const q of rows) teacherGamification.onQuestionContributed(userId, q.id, now)
      return rows
    })
    return ok({ imported: made.length, errors: plan.failures })
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
      if (statusOf(current) !== 'pending') return conflict(QMSG.locked)
      // The same form and rules as the create (44-F1): the edit form sends every field.
      const parsed = parseCreate(bodyOf(req))
      if (!parsed.ok) return validationError(parsed.fields)
      const row = questions.updateOwn(
        { id: viewerId(req) },
        current.id,
        parsed.input,
        ctx.clock.now(),
      )
      if (!row) return notFound()
      if (parsed.extra) dskpExtra.set(row.id, parsed.extra)
      return ok(detailOf(row))
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/guru/questions/:id',
    [teacherOnly],
    (req) => {
      const own = ownQuestion(req, Number(req.params.id))
      if (own && statusOf(own) !== 'pending') return conflict(QMSG.locked)
      const result = questions.deleteOwn({ id: viewerId(req) }, Number(req.params.id))
      // REQ-A-023b: only a question a held paper places (served) or a set / test / battle uses (in_use) is refused, as the real API.
      if (typeof result === 'string') {
        return conflict(
          result === 'in_use' ? QUESTION_MESSAGES.deleteInUse : QUESTION_MESSAGES.deleteRefused,
        )
      }
      return result ? ok({ removed: 1 }) : notFound()
    },
    { params: { id: int() } },
  ),
]
