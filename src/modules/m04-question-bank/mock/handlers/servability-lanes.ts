/**
 * `GET /api/admin/servability/lanes/subjektif` (FR-ADM-Q23.3, API `ServabilityReadsService.subjektifLane`): the Subjektif lane of the
 * Kandungan SPM hub. Admin only. It lists the structured questions of M04's own store (D12), newest id first, so every row `id` is the
 * numeric question id that `Sunting` opens in the Skema & Rubrik editor (`/admin/spm/subjektif/:id/sunting`).
 *
 * Row: `{id, title (stem, at most 120 characters), meta "#id · Subjek · Tingkatan", status (lifecycle code), attention, actions}`. The
 * store holds approved and draft questions only, so `review` and `archived` match nothing. `attention` carries the `no_scheme` sentence of
 * a served question with a leaf part and no rubric; the store has no MCQ leaf, so `no_key` never shows. The response also carries the
 * `subjects` options, `count` (rows under the filters) and the hub card's `attention` lines.
 */

import {
  SERVABILITY_HUB_CARDS,
  SERVABILITY_REASON_MS,
  ServabilityLaneQuerySchema,
  type ServabilityLaneRow,
} from '@pp/contract'

import { curriculum } from '@/modules/m03-curriculum/mock'
import { paged, route, validationError, type MockRequest, type MockResponse, type RouteDef } from '@/mock/define'

import { laneHasNoScheme, structuredRepo } from '../repository/structured'
import type { StructuredQuestion } from '../repository/types'
import { adminOnly, nameLookup } from './workflow-common'

const TITLE_MAX = 120
const STATUSES = ['approved', 'review', 'draft', 'archived'] as const

/** Stem on one line, at most 120 characters (the API's `clip`). */
function clip(text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  return t.length > TITLE_MAX ? `${t.slice(0, TITLE_MAX - 1)}…` : t
}

export function toLaneRow(q: StructuredQuestion, names: ReturnType<typeof nameLookup>): ServabilityLaneRow {
  const id = String(q.id)
  return {
    id,
    title: clip(q.stimulus),
    meta: [`#${id}`, names.subject(q.subjectId)?.name ?? '', names.level(q.educationLevelId)?.name ?? ''].filter((p) => p !== '').join(' · '),
    status: q.status === 'published' ? 'approved' : 'draft',
    attention: q.status === 'published' && q.isActive && laneHasNoScheme(q) ? [SERVABILITY_REASON_MS.no_scheme] : [],
    actions: ['preview', 'edit'],
  }
}

/** The hub card's attention lines, on the same rows as the lane. */
export function laneAttentionLines(attention: number): { count: number; text: string }[] {
  return attention > 0 ? [{ count: attention, text: `${attention.toLocaleString('en-US')} ${SERVABILITY_HUB_CARDS.subjektif.attentionLabel}` }] : []
}

function fieldsOf(issues: readonly { path: readonly PropertyKey[]; message: string }[]): Record<string, string> {
  const fields: Record<string, string> = {}
  for (const issue of issues) fields[issue.path.length > 0 ? issue.path.map(String).join('.') : '_'] ??= issue.message
  return fields
}

function subjektifLane(req: MockRequest): MockResponse {
  // Empty values count as absent (a form that sends `search=`), like the API.
  const clean = Object.fromEntries(
    Object.entries(req.query)
      .map(([k, v]) => [k, Array.isArray(v) ? v[0] : v] as const)
      .filter(([, v]) => v !== undefined && v !== ''),
  )
  const parsed = ServabilityLaneQuerySchema.safeParse(clean)
  if (!parsed.success) return validationError(fieldsOf(parsed.error.issues))
  const q = parsed.data
  const status = STATUSES.find((s) => s === q.status)
  const subjectId = q.subjectId === undefined ? undefined : /^\d+$/.test(q.subjectId) ? Number(q.subjectId) : null
  // An unknown status value or a non-numeric subject id matches nothing (the API compares in SQL).
  const none = (q.status !== undefined && status === undefined) || subjectId === null
  const res = none
    ? { rows: [] as StructuredQuestion[], total: 0 }
    : structuredRepo.laneList({
        ...(typeof subjectId === 'number' ? { subjectId } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(q.search !== undefined ? { search: q.search } : {}),
        page: q.page,
        pageSize: q.pageSize,
      })
  const names = nameLookup()
  const subjects = curriculum
    .subjects()
    .filter((s) => s.isActive)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'ms') || a.id - b.id)
    .map((s) => ({ id: String(s.id), name: s.name }))
  return paged({ rows: res.rows.map((r) => toLaneRow(r, names)), total: res.total }, { page: q.page, pageSize: q.pageSize }, undefined, {
    subjects,
    count: res.total,
    attention: laneAttentionLines(structuredRepo.laneFigures().attention),
  })
}

export const servabilityLaneRoutes: RouteDef[] = [route('GET', '/api/admin/servability/lanes/subjektif', [adminOnly], subjektifLane)]

