/**
 * M04 structured questions, admin reads (SRS §7 #18–#19, BR-M04-26/27, FR-M04-83…90). Admin-only.
 * Student practice reads the same store through M05 (XL-24).
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 18 | `GET /api/structured-questions` | `subjectId, educationLevelId, kbatLevel, page`; 25 per page; `meta.stats` |
 * | 19 | `GET /api/structured-questions/:id` | question + sub-questions + `createdBy`; 404 |
 *
 * An unknown or malformed filter value matches nothing (S8 "Tiada soalan berstruktur ditemui").
 * INFERRED: the excerpt length (100 characters + "...").
 */

import { curriculum } from '@/modules/m03-curriculum/mock'
import {
  int,
  notFound,
  validationError,
  ok,
  pageParams,
  paged,
  queryString,
  requireRole,
  route,
  type RouteDef,
} from '@/mock/define'

import type { StructuredDetail, StructuredRow } from '../../api/structured'
import type { GuruStructuredDetail, GuruStructuredRow } from '../../api/structured-guru'
import {
  GURU_SUBMISSION_PREFIX,
  guruSubmissions,
  submissionCreatedAt,
  type GuruSubmission,
} from '../repository/guru-structured'
import { structuredRepo } from '../repository/structured'
import type { StructuredQuestion } from '../repository/types'
import { structuredRubricRoutes } from './structured-rubric'
import { adminOnly, excerpt, nameLookup, queryFilterId, userRef } from './workflow-common'

/** API-GUR-26 (S6-T17): teacher read mount; the admin routes below are unchanged. */
const teacherRead = requireRole('teacher', 'admin')
export const GURU_PAGE_SIZE = 20

export const STRUCTURED_EXCERPT_LENGTH = 100
const PAGE_SIZE = 25

function toRow(q: StructuredQuestion, names: ReturnType<typeof nameLookup>): StructuredRow {
  return {
    id: q.id,
    stimulusExcerpt: excerpt(q.stimulus, STRUCTURED_EXCERPT_LENGTH),
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    kbatLevel: q.kbatLevel,
    totalMarks: q.totalMarks,
    subCount: q.subQuestions.length,
  }
}

export function toDetail(
  q: StructuredQuestion,
  names: ReturnType<typeof nameLookup>,
): StructuredDetail {
  const {
    createdBy,
    subQuestions,
    createdAtMs: _createdAtMs,
    updatedAtMs: _updatedAtMs,
    contribSchoolId: _contribSchoolId,
    ...fields
  } = q
  void [_createdAtMs, _updatedAtMs, _contribSchoolId]
  return {
    ...fields,
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    subQuestions: [...subQuestions].sort((a, b) => a.order - b.order),
    createdBy: userRef(createdBy),
  }
}

/** The KBAT chip text of a cognitive level: LOTS 1-2, MOTS 3, HOTS 4-6; empty without a level. */
function kbatChip(level: number): string {
  if (level < 1 || level > 6) return ''
  return level <= 2 ? `LOTS ${String(level)}` : level === 3 ? `MOTS 3` : `HOTS ${String(level)}`
}

function toGuruRow(
  q: StructuredQuestion,
  number: number,
  names: ReturnType<typeof nameLookup>,
): GuruStructuredRow {
  return {
    id: q.id,
    number,
    textExcerpt: excerpt(q.stimulus, STRUCTURED_EXCERPT_LENGTH),
    level: names.level(q.educationLevelId),
    subject: names.subject(q.subjectId),
    kbat: kbatChip(q.kbatLevel),
    subCount: q.subQuestions.length,
    marks: q.totalMarks,
    status: 'approved',
    source: 'question',
    editable: false,
  }
}

/** Row of an own submission (`g{n}` id, status `review`, or `rejected` once returned, editable until the admin accepts it). */
function toSubmissionRow(
  r: GuruSubmission,
  number: number,
  names: ReturnType<typeof nameLookup>,
): GuruStructuredRow {
  return {
    id: r.id,
    number,
    textExcerpt: excerpt(r.stimulus || (r.parts[0]?.text ?? ''), STRUCTURED_EXCERPT_LENGTH),
    level: names.level(r.educationLevelId),
    subject: names.subject(r.subjectId),
    kbat: r.cognitiveLevel ? kbatChip(COGNITIVE_INDEX[r.cognitiveLevel]) : '',
    subCount: r.parts.length,
    marks: r.parts.reduce((sum, p) => sum + p.marks, 0),
    status: r.rejectionReason ? 'rejected' : 'review',
    source: 'submission',
    editable: r.editable,
  }
}

const COGNITIVE_INDEX = {
  mengingat: 1,
  memahami: 2,
  mengaplikasi: 3,
  menganalisis: 4,
  menilai: 5,
  mencipta: 6,
} as const

function toSubmissionDetail(
  r: GuruSubmission,
  names: ReturnType<typeof nameLookup>,
): GuruStructuredDetail {
  const row = toSubmissionRow(r, 1, names)
  return {
    id: r.id,
    subject: row.subject,
    level: row.level,
    kbat: row.kbat,
    status: row.status,
    stimulus: r.stimulus,
    // A `blob:mock/` reference (mock-mode upload, D22) cannot load: no image.
    stimulusImage:
      r.stimulusImageId && !r.stimulusImageId.startsWith('blob:mock/')
        ? `/api/files/${r.stimulusImageId}`
        : null,
    totalMarks: row.marks,
    subCount: row.subCount,
    subQuestions: r.parts.map((p, i) => ({
      partLabel: String.fromCharCode(97 + i),
      questionText: p.text,
      marks: p.marks,
      cognitiveLevel: p.cognitiveLevel,
      modelAnswer: p.scheme,
      depth: 0,
    })),
    createdAt: submissionCreatedAt(r),
    source: 'submission',
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

/** The approved questions in [start, start + limit) of the filtered, newest-first list. */
function approvedWindow(
  filter: { subjectId?: number; educationLevelId?: number },
  start: number,
  limit: number,
): { rows: StructuredQuestion[]; total: number } {
  const first = Math.floor(start / GURU_PAGE_SIZE) + 1
  const a = structuredRepo.visible({ ...filter, page: first, pageSize: GURU_PAGE_SIZE })
  const b =
    start % GURU_PAGE_SIZE === 0
      ? { rows: [] as StructuredQuestion[] }
      : structuredRepo.visible({ ...filter, page: first + 1, pageSize: GURU_PAGE_SIZE })
  const from = start % GURU_PAGE_SIZE
  return { rows: [...a.rows, ...b.rows].slice(from, from + limit), total: a.total }
}

function toGuruDetail(
  q: StructuredQuestion,
  names: ReturnType<typeof nameLookup>,
): GuruStructuredDetail {
  return {
    id: q.id,
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    kbat: kbatChip(q.kbatLevel),
    status: 'approved',
    totalMarks: q.totalMarks,
    subCount: q.subQuestions.length,
    createdAt: q.createdAt,
    source: 'question',
    editable: false,
    form: null,
    stimulus: q.stimulus,
    // The real endpoint serves no question picture of an approved question.
    stimulusImage: null,
    subQuestions: [...q.subQuestions]
      .sort((a, b) => a.order - b.order)
      .map((s) => ({
        partLabel: s.partLabel,
        questionText: s.questionText,
        marks: s.marks,
        cognitiveLevel: null,
        modelAnswer: s.modelAnswer,
        depth: 0,
      })),
  }
}

export const structuredRoutes: RouteDef[] = [
  route('GET', '/api/guru/structured-questions', [teacherRead], (req) => {
    const page = pageParams(req.query, { pageSize: GURU_PAGE_SIZE })
    const status = queryString(req.query, 'status')
    // Like the BE's zod enum: any other status is a 422 on `status`.
    if (status !== undefined && status !== '' && status !== 'approved' && status !== 'review')
      return validationError({ status: 'Invalid option: expected one of "approved"|"review"' })
    const subjectId = queryFilterId(req.query, 'subjectId')
    const educationLevelId = queryFilterId(req.query, 'educationLevelId')
    const filter = {
      ...(subjectId !== undefined ? { subjectId } : {}),
      ...(educationLevelId !== undefined ? { educationLevelId } : {}),
    }
    // Ruling B on #493: no status = own submissions first (newest first), then approved questions;
    // `approved` = approved only; `review` = the caller's own submissions only.
    const own =
      status === 'approved' ? [] : guruSubmissions.listOwn(req.session?.userId ?? 0, filter)
    const offset = (page.page - 1) * GURU_PAGE_SIZE
    const ownRows = own.slice(offset, offset + GURU_PAGE_SIZE)
    const approved =
      status === 'review'
        ? { rows: [] as StructuredQuestion[], total: 0 }
        : approvedWindow(filter, Math.max(0, offset - own.length), GURU_PAGE_SIZE - ownRows.length)
    const names = nameLookup()
    const rows = [
      ...ownRows.map((r, i) => toSubmissionRow(r, offset + i + 1, names)),
      ...approved.rows.map((q, i) => toGuruRow(q, offset + ownRows.length + i + 1, names)),
    ]
    return paged({ rows, total: own.length + approved.total }, page)
  }),
  route('GET', '/api/guru/structured-questions/:id', [teacherRead], (req) => {
    const id = String(req.params.id)
    if (id.startsWith(GURU_SUBMISSION_PREFIX)) {
      // Another teacher's submission is a 404 (AC-GUR-44b-6).
      const own = guruSubmissions.getOwn(req.session?.userId ?? 0, id)
      return own ? ok(toSubmissionDetail(own, nameLookup())) : notFound()
    }
    const q = /^\d+$/.test(id) ? structuredRepo.getVisible(Number(id)) : null
    return q ? ok(toGuruDetail(q, nameLookup())) : notFound()
  }),
  route('GET', '/api/structured-questions', [adminOnly], (req) => {
    const page = pageParams(req.query, { pageSize: PAGE_SIZE })
    const subjectId = queryFilterId(req.query, 'subjectId')
    const educationLevelId = queryFilterId(req.query, 'educationLevelId')
    const kbatLevel = queryFilterId(req.query, 'kbatLevel')
    const result = structuredRepo.adminList({
      ...(subjectId !== undefined ? { subjectId } : {}),
      ...(educationLevelId !== undefined ? { educationLevelId } : {}),
      ...(kbatLevel !== undefined ? { kbatLevel } : {}),
      page: page.page,
    })
    const names = nameLookup()
    const bySubject = [...result.stats.bySubject]
      .flatMap(([id, count]) => {
        const name = curriculum.subject(id)?.name
        return name === undefined || count < 1 ? [] : [{ name, count }]
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'ms'))
    return paged({ rows: result.rows.map((q) => toRow(q, names)), total: result.total }, page, {
      stats: { total: result.stats.total, published: result.stats.published, bySubject },
    })
  }),
  route(
    'GET',
    '/api/structured-questions/:id',
    [adminOnly],
    (req) => {
      const q = structuredRepo.get(req.params.id as number)
      return q ? ok(toDetail(q, nameLookup())) : notFound()
    },
    { params: { id: int() } },
  ),
  ...structuredRubricRoutes,
]
