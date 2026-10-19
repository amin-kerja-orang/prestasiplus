/**
 * Pagination the Laravel way (overview §6.3, §6.4):
 * - `totalPages = max(1, ceil(totalItems / pageSize))`;
 * - an out-of-range page is **not an error**: it answers an empty page and keeps the requested
 *   `page` number;
 * - `from`/`to` are the 1-based positions of the first and last row on the page, `null` when the
 *   page is empty ("Showing X to Y of Z results");
 * - a missing or invalid `page` query value means page 1.
 */

import type { BaseListMeta } from '@/api/envelope'

import { list } from './respond'
import type { MockQuery, MockResponse } from './types'

export interface PageRequest {
  /** 1-based. */
  page: number
  pageSize: number
}

/** Paging fields the helpers compute; extra meta can never set them. */
type ComputedMetaKey = Exclude<keyof BaseListMeta, 'counts'>

/** Named totals (`counts`) and module aggregates. The computed paging fields are off limits. */
export type ExtraMeta = Record<string, unknown> & {
  counts?: Record<string, number>
} & { [K in ComputedMetaKey]?: never }

const COMPUTED_META_KEYS: readonly ComputedMetaKey[] = [
  'page',
  'pageSize',
  'totalItems',
  'totalPages',
  'from',
  'to',
]

/** Rejects extra meta that sets a computed field; the computed values always win. */
function mergeMeta(meta: BaseListMeta, extraMeta: ExtraMeta | undefined): BaseListMeta {
  if (extraMeta) {
    for (const key of COMPUTED_META_KEYS) {
      if (key in extraMeta) throw new Error(`pagination: extra meta must not set '${key}'`)
    }
  }
  return { ...extraMeta, ...meta }
}

function checkPage({ page, pageSize }: PageRequest) {
  if (!Number.isSafeInteger(page) || page < 1) {
    throw new RangeError(`pagination: page must be an integer ≥ 1, got ${String(page)}`)
  }
  if (!Number.isSafeInteger(pageSize) || pageSize < 1) {
    throw new RangeError(`pagination: pageSize must be an integer ≥ 1, got ${String(pageSize)}`)
  }
}

/** Meta for a page of `count` rows out of `totalItems`. */
export function pageMeta(totalItems: number, req: PageRequest, count: number): BaseListMeta {
  checkPage(req)
  const { page, pageSize } = req
  const offset = (page - 1) * pageSize
  return {
    page,
    pageSize,
    totalItems,
    totalPages: Math.max(1, Math.ceil(totalItems / pageSize)),
    from: count > 0 ? offset + 1 : null,
    to: count > 0 ? offset + count : null,
  }
}

/** Pages an in-memory array. */
export function paginate(
  items: readonly unknown[],
  req: PageRequest,
  extraMeta?: ExtraMeta,
  extra?: Record<string, unknown>,
): MockResponse {
  checkPage(req)
  const offset = (req.page - 1) * req.pageSize
  const rows = items.slice(offset, offset + req.pageSize)
  return list(rows, mergeMeta(pageMeta(items.length, req, rows.length), extraMeta), extra)
}

/** A page that is already cut (e.g. `store.query({page, pageSize})` → `{rows, total}`). */
export function paged(
  result: { rows: readonly unknown[]; total: number },
  req: PageRequest,
  extraMeta?: ExtraMeta,
  extra?: Record<string, unknown>,
): MockResponse {
  if (result.rows.length > req.pageSize) {
    throw new RangeError(
      `paged(): got ${String(result.rows.length)} rows for pageSize ${String(req.pageSize)}`,
    )
  }
  return list(
    result.rows,
    mergeMeta(pageMeta(result.total, req, result.rows.length), extraMeta),
    extra,
  )
}

/**
 * A list that live does not paginate: `page: 1`, `pageSize = totalItems` (at least 1), `totalPages: 1`
 * (M03 §7 convention).
 */
export function unpaged(
  items: readonly unknown[],
  extraMeta?: ExtraMeta,
  extra?: Record<string, unknown>,
): MockResponse {
  const n = items.length
  const meta: BaseListMeta = {
    page: 1,
    // Never 0, so a client computing pages from pageSize cannot divide by zero.
    pageSize: Math.max(1, n),
    totalItems: n,
    totalPages: 1,
    from: n > 0 ? 1 : null,
    to: n > 0 ? n : null,
  }
  return list(items, mergeMeta(meta, extraMeta), extra)
}

export interface PageParamOptions {
  /** The endpoint's page size (fixed, as live). */
  pageSize: number
  /** When set, a `pageSize` query value is honoured and clamped to [1, maxPageSize]. */
  maxPageSize?: number
  pageKey?: string
  pageSizeKey?: string
}

function firstValue(value: string | readonly string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : value?.[0]
}

function positiveInt(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined
  const n = Number(value.trim())
  return Number.isSafeInteger(n) && n >= 1 ? n : undefined
}

/** Reads `page` (invalid → 1, as Laravel) and, if allowed, `pageSize` from the query. */
export function pageParams(query: MockQuery, options: PageParamOptions): PageRequest {
  const page = positiveInt(firstValue(query[options.pageKey ?? 'page'])) ?? 1
  let pageSize = options.pageSize
  if (options.maxPageSize !== undefined) {
    const asked = positiveInt(firstValue(query[options.pageSizeKey ?? 'pageSize']))
    if (asked !== undefined) pageSize = Math.min(asked, options.maxPageSize)
  }
  return { page, pageSize }
}
