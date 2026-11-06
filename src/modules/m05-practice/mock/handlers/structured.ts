/**
 * SRS M05 v1.17 §7 #15–#17 — the structured questions (S10 list incl. the SPM variants, Q3 answer
 * page and its attempt). Any session (A).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 15 | `GET /api/practice/structured` | `subjectId`, `kbatLevel`, `q`, `page`, `scope=spm`, `track=bahasa`; 12 per page |
 * | 16 | `GET /api/practice/structured/:id` | `scope`, `track` only decide `backUrl` (FR-M05-137); 404 |
 * | 17 | `POST /api/practice/structured/:id/attempts` | `{answers, scope?, track?}`; `markStructured` placeholder; 201 / 404 / 422 |
 *
 * The questions belong to M04 (D12): they are read only through the public `structured` repository
 * (`visible`, `getVisible`: published, active, Tingkatan 4/5, BR-M04-03). The mock keeps no copy.
 *
 * BR-23 / FR-M05-133…137: `scope=spm` lists the 15 Subjektif subjects (FR-M05-134) newest first
 * across subjects; with `track=bahasa` only BM and BI, BM sets before BI sets (M06 DV-M06-10).
 * An unknown `scope` or a `track` without `scope=spm` is ignored (the plain list); an unknown
 * `subjectId` / `kbatLevel`, or a subject outside the variant's list, matches nothing (§5).
 */

import { toIsoMyt } from '@/lib/time'
import {
  created,
  int,
  list,
  notFound,
  ok,
  pageMeta,
  pageParams,
  queryString,
  requireAuth,
  route,
  validationError,
  type MockQuery,
  type MockRequest,
  type RouteDef,
} from '@/mock/define'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { structured, type StructuredQuestion } from '@/modules/m04-question-bank/mock'

import type { StructuredAttemptRow } from '../datasets/types'
import { practiceRepo } from '../repository/practice'
import {
  BAHASA_SUBJECT_IDS,
  KBAT_LEVELS,
  MAX_ANSWER_CHARS,
  STRUCTURED_PAGE_SIZE,
  SUBJEKTIF_SUBJECT_IDS,
  markStructured,
} from '../repository/structured-rules'
import { userIdOf } from './common'

type Scope = 'spm' | null
type Track = 'bahasa' | null

/** INFERRED: the card preview is the first 200 characters of the stimulus plus "...". */
export const PREVIEW_LENGTH = 200
/** Longest accepted search text. */
const SEARCH_MAX = 100
/** Shown for sets whose creator is not a teacher (the observed live label, M04 anchor 4454). */
export const DEFAULT_AUTHOR = 'Guru Pakar'

// ---------------------------------------------------------------------------------------------
// Query parsing
// ---------------------------------------------------------------------------------------------

/** `scope` is `spm` or ignored; `track` is `bahasa` only together with `scope=spm`. */
function variant(query: MockQuery): { scope: Scope; track: Track } {
  const scope = queryString(query, 'scope')?.trim() === 'spm' ? 'spm' : null
  const track =
    scope === 'spm' && queryString(query, 'track')?.trim() === 'bahasa' ? 'bahasa' : null
  return { scope, track }
}

type Filter =
  | { kind: 'none' }
  | { kind: 'value'; value: number }
  /** A value that matches nothing (not a number). */
  | { kind: 'nothing' }

/** Empty or absent = no filter (the form keeps empty values); a non-number matches nothing (§5). */
function filterOf(query: MockQuery, key: string): Filter {
  const raw = queryString(query, key)?.trim()
  if (raw === undefined || raw === '') return { kind: 'none' }
  return /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw))
    ? { kind: 'value', value: Number(raw) }
    : { kind: 'nothing' }
}

// ---------------------------------------------------------------------------------------------
// The student view of a question (card, detail)
// ---------------------------------------------------------------------------------------------

function authorOf(q: StructuredQuestion): { author: string; school: string | null } {
  const creator = users.get(q.createdBy)
  if (!creator || creator.role !== 'teacher') return { author: DEFAULT_AUTHOR, school: null }
  const school = creator.schoolId !== null ? schools.get(creator.schoolId) : undefined
  return { author: creator.name, school: school?.name ?? null }
}

const preview = (text: string) =>
  text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH)}...` : text

function card(q: StructuredQuestion) {
  const { author, school } = authorOf(q)
  return {
    id: q.id,
    subjectId: q.subjectId,
    subjectName: curriculum.subject(q.subjectId)?.name ?? '',
    kbatLevel: q.kbatLevel,
    estimatedMinutes: q.estimatedMinutes,
    isTrial: q.isTrial,
    preview: preview(q.stimulus),
    topic: q.topic,
    author,
    school,
    // "{n} soalan": every sub-question; "{parts} bahagian": the top-level parts (FR-M05-135).
    subQuestionCount: q.subQuestions.length,
    levelName: curriculum.level(q.educationLevelId)?.name ?? '',
    parts: q.subQuestions.filter((s) => s.parentSubId === null).length,
    marks: q.totalMarks,
  }
}

// ---------------------------------------------------------------------------------------------
// The list (#15)
// ---------------------------------------------------------------------------------------------

interface ListQuery {
  subjectIds: readonly number[]
  kbatLevel: number | undefined
}

const count = (subjectId: number | undefined, kbatLevel: number | undefined) =>
  structured.visible({
    ...(subjectId !== undefined ? { subjectId } : {}),
    ...(kbatLevel !== undefined ? { kbatLevel } : {}),
    pageSize: 1,
  }).total

/** Rows `[start, end)` of one subject's list (newest first), read in page-aligned chunks. */
function slice(
  subjectId: number | undefined,
  kbatLevel: number | undefined,
  start: number,
  end: number,
) {
  const size = STRUCTURED_PAGE_SIZE
  const out: StructuredQuestion[] = []
  for (let page = Math.floor(start / size) + 1; page <= Math.floor((end - 1) / size) + 1; page++) {
    out.push(
      ...structured.visible({
        ...(subjectId !== undefined ? { subjectId } : {}),
        ...(kbatLevel !== undefined ? { kbatLevel } : {}),
        page,
        pageSize: size,
      }).rows,
    )
  }
  const first = Math.floor(start / size) * size
  return out.slice(start - first, end - first)
}

/** Subjects read one after the other (Tracking A Bahasa: BM before BI). */
function concatenated(q: ListQuery, offset: number, limit: number) {
  const totals = q.subjectIds.map((id) => count(id, q.kbatLevel))
  const total = totals.reduce((a, b) => a + b, 0)
  const rows: StructuredQuestion[] = []
  let base = 0
  for (const [i, id] of q.subjectIds.entries()) {
    const n = totals[i] as number
    const from = Math.max(offset - base, 0)
    const to = Math.min(offset + limit - base, n)
    if (to > from) rows.push(...slice(id, q.kbatLevel, from, to))
    base += n
  }
  return { rows, total }
}

/** Subjects merged by the M04 order (created desc, then id asc): the Subjektif SPM variant. */
function merged(q: ListQuery, offset: number, limit: number) {
  const totals = q.subjectIds.map((id) => count(id, q.kbatLevel))
  const total = totals.reduce((a, b) => a + b, 0)
  if (offset >= total) return { rows: [], total }
  const CHUNK = 100
  const cursors = q.subjectIds.map((id, i) => ({
    id,
    total: totals[i] as number,
    pos: 0,
    buf: [] as StructuredQuestion[],
    bufStart: 0,
  }))
  type Cursor = (typeof cursors)[number]
  const head = (c: Cursor): StructuredQuestion | undefined => {
    if (c.pos >= c.total) return undefined
    if (c.pos >= c.bufStart + c.buf.length) {
      c.bufStart = c.pos
      c.buf = slice(c.id, q.kbatLevel, c.pos, Math.min(c.pos + CHUNK, c.total))
    }
    return c.buf[c.pos - c.bufStart]
  }
  const rows: StructuredQuestion[] = []
  for (let n = 0; n < Math.min(offset + limit, total); n++) {
    let best: Cursor | undefined
    let bestRow: StructuredQuestion | undefined
    for (const c of cursors) {
      const row = head(c)
      if (!row) continue
      if (
        !bestRow ||
        row.createdAtMs > bestRow.createdAtMs ||
        (row.createdAtMs === bestRow.createdAtMs && row.id < bestRow.id)
      ) {
        best = c
        bestRow = row
      }
    }
    if (!best || !bestRow) break
    best.pos++
    if (n >= offset) rows.push(bestRow)
  }
  return { rows, total }
}

function subjectOptions(scope: Scope, track: Track): { id: number; name: string }[] {
  if (scope === null) {
    return curriculum
      .subjects({ active: true })
      .map((s) => ({ id: s.id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
  }
  const ids = track === 'bahasa' ? BAHASA_SUBJECT_IDS : SUBJEKTIF_SUBJECT_IDS
  return ids.flatMap((id) => {
    const s = curriculum.subject(id)
    return s ? [{ id, name: s.name }] : []
  })
}

/** The search (max 100 characters) matches the stem or stimulus text, case-insensitively (as the BE). */
function matchesTerm(q: StructuredQuestion, term: string): boolean {
  return q.stimulus.toLowerCase().includes(term)
}

/** A usable scheme: every leaf part (one with no child part) has a model answer (FR-MUR-17-1). */
function hasUsableScheme(q: StructuredQuestion): boolean {
  const parents = new Set(q.subQuestions.map((s) => s.parentSubId))
  return q.subQuestions
    .filter((s) => !parents.has(s.id))
    .every((s) => s.modelAnswer.trim() !== '')
}

/** The caller's highest attempt total on a set, or null without an attempt. */
function bestScoreOf(userId: number, id: number): { awarded: number; max: number } | null {
  let best: { awarded: number; max: number } | null = null
  for (const a of practiceRepo.structuredAttempts(userId)) {
    if (a.structuredQuestionId !== id) continue
    if (!best || a.totalAwarded > best.awarded) best = { awarded: a.totalAwarded, max: a.totalMax }
  }
  return best
}

function listStructured(req: MockRequest) {
  const { scope, track } = variant(req.query)
  const options = subjectOptions(scope, track)
  const page = pageParams(req.query, { pageSize: STRUCTURED_PAGE_SIZE })
  const offset = (page.page - 1) * page.pageSize
  const subject = filterOf(req.query, 'subjectId')
  const kbat = filterOf(req.query, 'kbatLevel')

  const term = (queryString(req.query, 'q') ?? '').trim().slice(0, SEARCH_MAX).toLowerCase()
  const markable = ['1', 'true'].includes(
    (queryString(req.query, 'markable') ?? '').trim().toLowerCase(),
  )
  let rows: StructuredQuestion[] = []
  let total = 0
  let pending = 0
  const empty =
    subject.kind === 'nothing' ||
    kbat.kind === 'nothing' ||
    (kbat.kind === 'value' && !(KBAT_LEVELS as readonly number[]).includes(kbat.value)) ||
    (scope !== null && subject.kind === 'value' && !options.some((o) => o.id === subject.value)) ||
    (scope === null && subject.kind === 'value' && !curriculum.subject(subject.value))
  if (!empty) {
    const kbatLevel = kbat.kind === 'value' ? kbat.value : undefined
    /** Rows `[from, from + limit)` of the list before the text search. */
    const read = (from: number, limit: number) => {
      if (subject.kind === 'value') {
        return {
          rows: slice(subject.value, kbatLevel, from, from + limit),
          total: count(subject.value, kbatLevel),
        }
      }
      if (scope === null) {
        // `visible` pages by whole pages: `from` is always a multiple of `limit` here.
        return structured.visible({
          ...(kbatLevel !== undefined ? { kbatLevel } : {}),
          page: Math.floor(from / limit) + 1,
          pageSize: limit,
        })
      }
      const q: ListQuery = { subjectIds: options.map((o) => o.id), kbatLevel }
      return track === 'bahasa' ? concatenated(q, from, limit) : merged(q, from, limit)
    }
    // The whole filtered list is read once: the text search, the `markable` rule and the pending
    // count (sets of this filter with no usable scheme, ignoring `markable`) all need it.
    const all = read(0, Math.max(read(0, 1).total, 1)).rows.filter(
      (row) => term === '' || matchesTerm(row, term),
    )
    pending = all.filter((row) => !hasUsableScheme(row)).length
    const shown = markable ? all.filter(hasUsableScheme) : all
    total = shown.length
    rows = shown.slice(offset, offset + page.pageSize)
  }
  const me = userIdOf(req)
  const items = rows.map((q) => ({ ...card(q), bestScore: bestScoreOf(me, q.id) }))
  return list(items, {
    ...pageMeta(total, page, items.length),
    scope,
    track,
    subjectOptions: options,
    pendingSchemeCount: pending,
  })
}

// ---------------------------------------------------------------------------------------------
// Detail (#16) and attempt (#17)
// ---------------------------------------------------------------------------------------------

/** FR-M05-137: the list the page belongs to. */
function backUrlOf(subjectId: number, scope: Scope, track: Track): string {
  if (scope === null) return '/latihan-berstruktur'
  return `/latihan-berstruktur?subject_id=${String(subjectId)}&scope=spm${track === 'bahasa' ? '&track=bahasa' : ''}`
}

function detail(q: StructuredQuestion, scope: Scope, track: Track) {
  return {
    id: q.id,
    subjectId: q.subjectId,
    subjectName: curriculum.subject(q.subjectId)?.name ?? '',
    levelName: curriculum.level(q.educationLevelId)?.name ?? '',
    stimulus: q.stimulus,
    stimulusImage: q.stimulusImage,
    subQuestions: [...q.subQuestions]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({ id: s.id, label: s.partLabel, text: s.questionText, marks: s.marks })),
    backUrl: backUrlOf(q.subjectId, scope, track),
  }
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

const SCOPE_MSG = 'Skop tidak sah.'
const ANSWERS_MSG = 'Jawapan tidak sah.'

export const structuredRoutes: RouteDef[] = [
  route('GET', '/api/practice/structured', [requireAuth()], (req) => listStructured(req)),

  route(
    'GET',
    '/api/practice/structured/:id',
    [requireAuth()],
    (req) => {
      const q = structured.getVisible(req.params.id as number)
      if (!q) return notFound()
      const { scope, track } = variant(req.query)
      return ok(detail(q, scope, track))
    },
    { params: { id: int() } },
  ),

  route(
    'POST',
    '/api/practice/structured/:id/attempts',
    [requireAuth()],
    (req, ctx) => {
      const q = structured.getVisible(req.params.id as number)
      if (!q) return notFound()
      const body = isObject(req.body) ? req.body : {}

      // scope / track: optional; only `spm` / `bahasa` (or null) are accepted, and `track`
      // needs `scope: 'spm'`.
      const rawScope = body.scope ?? null
      const rawTrack = body.track ?? null
      if (rawScope !== null && rawScope !== 'spm') return validationError({ scope: SCOPE_MSG })
      if (rawTrack !== null && (rawTrack !== 'bahasa' || rawScope !== 'spm')) {
        return validationError({ track: SCOPE_MSG })
      }
      const scope: Scope = rawScope === 'spm' ? 'spm' : null
      const track: Track = rawTrack === 'bahasa' ? 'bahasa' : null

      const raw = body.answers
      if (!Array.isArray(raw)) return validationError({ answers: ANSWERS_MSG })
      const valid = new Set(q.subQuestions.map((s) => s.id))
      const answers = new Map<number, string>()
      for (const [i, a] of raw.entries()) {
        const key = `answers.${String(i)}`
        if (!isObject(a) || typeof a.subQuestionId !== 'number' || typeof a.text !== 'string') {
          return validationError({ [key]: ANSWERS_MSG })
        }
        if (!valid.has(a.subQuestionId) || answers.has(a.subQuestionId)) {
          return validationError({ [key]: ANSWERS_MSG })
        }
        if (a.text.length > MAX_ANSWER_CHARS) {
          return validationError({
            [key]: `Jawapan tidak boleh melebihi ${String(MAX_ANSWER_CHARS)} aksara.`,
          })
        }
        answers.set(a.subQuestionId, a.text)
      }

      const marks = markStructured(q.subQuestions, answers)
      const row: Omit<StructuredAttemptRow, 'id'> = {
        userId: userIdOf(req),
        structuredQuestionId: q.id,
        scope,
        track,
        answers: [...answers].map(([subQuestionId, text]) => ({ subQuestionId, text })),
        marks,
        totalAwarded: marks.reduce((a, m) => a + m.awarded, 0),
        totalMax: marks.reduce((a, m) => a + m.max, 0),
        submittedAt: toIsoMyt(ctx.clock.now()),
      }
      const stored = practiceRepo.addStructuredAttempt(row)
      return created({
        ...stored,
        modelAnswers: q.subQuestions.map((s) => ({ subQuestionId: s.id, text: s.modelAnswer })),
      })
    },
    { params: { id: int() } },
  ),
]
