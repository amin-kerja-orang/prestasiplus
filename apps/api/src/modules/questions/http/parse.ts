/**
 * Request parsing of the question routes (BE-09 Part C). The contract schemas give the shape errors
 * (BM copy from `QUESTION_MESSAGES`); this file adds the module bounds (page, search, id list) and
 * the response helpers (flash envelope, list meta). Every failure is one 422 `VALIDATION_ERROR` with
 * a `fields` map, like the mock.
 */
import {
  QUESTION_MESSAGES,
  QuestionBulkRequestSchema,
  QuestionListQuerySchema,
  QuestionStructuredListQuerySchema,
  type ListMeta,
} from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import type { AdminListFilter, QuestionStatus, StructuredListFilter } from '../types'

/** Admin list page size when the client sends none (mock: 20 per page, newest first). */
export const ADMIN_PAGE_SIZE = 20
export const STRUCTURED_PAGE_SIZE = 25
export const GURU_PAGE_SIZE = 20
/** Largest page number accepted: keeps `OFFSET` far from integer limits. */
export const MAX_PAGE = 100_000
/** Longest `search` text and longest filter value (BE-NFR-25). */
export const SEARCH_MAX = 100
export const FILTER_MAX = 64
/** Most ids one bulk action may carry. */
export const BULK_MAX_IDS = 200

export const PAGE_MESSAGE = 'Halaman tidak sah.'
export const SEARCH_MESSAGE = 'Carian tidak boleh melebihi 100 aksara.'
export const FILTER_MESSAGE = 'Nilai penapis tidak sah.'
export const BULK_TOO_MANY_MESSAGE = 'Terlalu banyak soalan dipilih (had 200).'
export const BODY_MESSAGE = 'Badan permintaan mesti objek JSON.'
/** The bulk action name that ADR-0027 removed; accepted as an input alias of `approved` for one release. */
export const LEGACY_PUBLISHED_ACTION = 'published'

const newFields = (): Record<string, string> => Object.create(null) as Record<string, string>

export const invalid = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })

/** First issue per path (the shared pipe's rule). */
export function fieldsOf(error: z.ZodError): Record<string, string> {
  const fields = newFields()
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.map(String).join('.') : '_'
    fields[key] ??= issue.message
  }
  return fields
}

/** Parses a body with a contract schema; a non-object body is a 422 too. */
export function parseBody<S extends z.ZodType>(schema: S, raw: unknown): z.output<S> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw invalid({ _: BODY_MESSAGE })
  const res = schema.safeParse(raw)
  if (!res.success) throw invalid(fieldsOf(res.error))
  return res.data
}

/** Query values as trimmed strings; empty values count as absent (mock), arrays and objects are refused. */
function cleanQuery(raw: unknown, keys: readonly string[], fields: Record<string, string>): Record<string, string> {
  const source = typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
  const out: Record<string, string> = {}
  for (const key of keys) {
    const value = source[key]
    if (value === undefined) continue
    if (typeof value !== 'string') {
      fields[key] = key === 'page' || key === 'pageSize' ? PAGE_MESSAGE : FILTER_MESSAGE
      continue
    }
    const text = value.trim()
    if (text !== '') out[key] = text
  }
  return out
}

function pageOf(text: string | undefined, max: number, fallback: number, key: string, fields: Record<string, string>): number {
  if (text === undefined) return fallback
  const n = /^\d{1,9}$/.test(text) ? Number(text) : Number.NaN
  if (!Number.isInteger(n) || n < 1 || n > max) {
    fields[key] = PAGE_MESSAGE
    return fallback
  }
  return n
}

/** `GET /questions`. Unknown filter values match nothing; a bad `status` is a 422 on `status`. */
export function parseAdminList(raw: unknown): AdminListFilter {
  const fields = newFields()
  const q = cleanQuery(raw, ['page', 'pageSize', 'subjectId', 'educationLevelId', 'difficultyLevel', 'status', 'dskpFilter', 'complianceFilter', 'sourceFilter', 'search', 'tagReview', 'missing'], fields)
  const page = pageOf(q.page, MAX_PAGE, 1, 'page', fields)
  const pageSize = pageOf(q.pageSize, 100, ADMIN_PAGE_SIZE, 'pageSize', fields)
  for (const key of ['subjectId', 'educationLevelId', 'difficultyLevel', 'dskpFilter', 'complianceFilter', 'sourceFilter'] as const) {
    if ((q[key]?.length ?? 0) > FILTER_MAX) fields[key] = FILTER_MESSAGE
  }
  if ((q.search?.length ?? 0) > SEARCH_MAX) fields.search = SEARCH_MESSAGE
  const { page: _p, pageSize: _s, ...rest } = q
  void _p
  void _s
  const parsed = QuestionListQuerySchema.safeParse({ ...rest, page, pageSize })
  if (!parsed.success) {
    for (const [k, v] of Object.entries(fieldsOf(parsed.error))) fields[k] ??= v
  }
  if (Object.keys(fields).length > 0 || !parsed.success) throw invalid(fields)
  const d = parsed.data
  return {
    page: d.page,
    pageSize: d.pageSize,
    ...(d.subjectId === undefined ? {} : { subjectId: d.subjectId }),
    ...(d.educationLevelId === undefined ? {} : { educationLevelId: d.educationLevelId }),
    ...(d.difficultyLevel === undefined ? {} : { difficultyLevel: d.difficultyLevel }),
    ...(d.status === undefined ? {} : { status: d.status as QuestionStatus }),
    ...(d.dskpFilter === undefined ? {} : { dskpFilter: d.dskpFilter }),
    ...(d.complianceFilter === undefined ? {} : { complianceFilter: d.complianceFilter }),
    ...(d.sourceFilter === undefined ? {} : { sourceFilter: d.sourceFilter }),
    ...(d.search === undefined ? {} : { search: d.search }),
    ...(d.tagReview === undefined ? {} : { tagReview: true }),
    ...(d.missing === undefined ? {} : { missing: d.missing }),
  }
}

/** `GET /structured-questions`: 25 per page. */
export function parseStructuredList(raw: unknown): StructuredListFilter {
  const fields = newFields()
  const q = cleanQuery(raw, ['page', 'subjectId', 'educationLevelId', 'kbatLevel'], fields)
  const page = pageOf(q.page, MAX_PAGE, 1, 'page', fields)
  for (const key of ['subjectId', 'educationLevelId', 'kbatLevel'] as const) {
    if ((q[key]?.length ?? 0) > FILTER_MAX) fields[key] = FILTER_MESSAGE
  }
  const { page: _p, ...rest } = q
  void _p
  const parsed = QuestionStructuredListQuerySchema.safeParse({ ...rest, page })
  if (!parsed.success) {
    for (const [k, v] of Object.entries(fieldsOf(parsed.error))) fields[k] ??= v
  }
  if (Object.keys(fields).length > 0 || !parsed.success) throw invalid(fields)
  const d = parsed.data
  return {
    page: d.page,
    pageSize: STRUCTURED_PAGE_SIZE,
    ...(d.subjectId === undefined ? {} : { subjectId: d.subjectId }),
    ...(d.educationLevelId === undefined ? {} : { educationLevelId: d.educationLevelId }),
    ...(d.kbatLevel === undefined ? {} : { kbatLevel: d.kbatLevel }),
  }
}

/** `GET /guru/questions`: only `page` (20 per page). */
export function parseGuruPage(raw: unknown): number {
  const fields = newFields()
  const q = cleanQuery(raw, ['page'], fields)
  const page = pageOf(q.page, MAX_PAGE, 1, 'page', fields)
  if (Object.keys(fields).length > 0) throw invalid(fields)
  return page
}

/** `POST /questions/bulk-action`: the contract message for a missing or unknown action, ids capped. */
export function parseBulk(raw: unknown): z.output<typeof QuestionBulkRequestSchema> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw invalid({ _: BODY_MESSAGE })
  // ADR-0027: one release still accepts the removed `published` action from an old client and treats it as `approved`.
  const body = (raw as { action?: unknown }).action === LEGACY_PUBLISHED_ACTION ? { ...raw, action: 'approved' } : raw
  const res = QuestionBulkRequestSchema.safeParse(body)
  if (!res.success) {
    // The mock reports a bad element under `ids`, not `ids.<i>`.
    const fields = newFields()
    for (const [key, message] of Object.entries(fieldsOf(res.error))) fields[key.replace(/^ids\.\d+$/, 'ids')] ??= message
    throw invalid(fields)
  }
  if (res.data.ids.length > BULK_MAX_IDS) throw invalid({ ids: BULK_TOO_MANY_MESSAGE })
  return res.data
}

/** `{ data, status }` of an admin write (mock E3). */
export const flash = <T>(data: T, status: string): { data: T; status: string } => ({ data, status })

export const FLASH = {
  added: QUESTION_MESSAGES.added,
  updated: QUESTION_MESSAGES.updated,
  deleted: QUESTION_MESSAGES.deleted,
  bulk: QUESTION_MESSAGES.bulkUpdated,
} as const

/** List meta with the per-status counts of the admin list (`meta.counts`). */
export const adminMeta = (page: number, pageSize: number, total: number, counts: Record<string, number>): ListMeta => ({
  ...listMeta(page, pageSize, total),
  counts,
})
