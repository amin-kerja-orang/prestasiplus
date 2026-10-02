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
import { int, notFound, ok, pageParams, paged, route, type RouteDef } from '@/mock/define'

import type { StructuredDetail, StructuredRow } from '../../api/structured'
import { structuredRepo } from '../repository/structured'
import type { StructuredQuestion } from '../repository/types'
import { adminOnly, excerpt, nameLookup, queryFilterId, userRef } from './workflow-common'

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

export const structuredRoutes: RouteDef[] = [
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
]
