/**
 * Response envelopes (master SRS §7.2, §7.3; overview §6.3).
 *
 * - Single resource: `{ data: T }`.
 * - List: `{ data: T[], meta: ListMeta }`. `meta` carries the agreed optional extensions `from`,
 *   `to` (Laravel "Showing X to Y of Z results"; `null` on an empty page) and `counts` (per-tab or
 *   per-status totals), plus any module aggregates typed through the `X` parameter (M01 SRS Q2).
 * - Error: `{ error: { code, message, fields?, retryAfter? } }`. `retryAfter` (seconds) comes with
 *   `429 RATE_LIMITED`.
 *
 * Lists that live does not paginate still use the list envelope with `page: 1, totalPages: 1`.
 */

import type {
  ErrorBody as ContractErrorBody,
  ErrorPayload as ContractErrorPayload,
} from '@pp/contract'

export interface BaseListMeta {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  /** 1-based index of the first row on this page; `null` when the page is empty (Laravel). */
  from?: number | null
  /** 1-based index of the last row on this page; `null` when the page is empty (Laravel). */
  to?: number | null
  /** Named totals shown next to the list (tab badges, status counts). */
  counts?: Record<string, number>
}

/** List meta with module-specific aggregates, e.g. `ListMeta<{ averageScore: number }>`. */
export type ListMeta<X extends object = Record<never, never>> = BaseListMeta & X

export interface Envelope<T> {
  data: T
}

export interface ListEnvelope<T, X extends object = Record<never, never>> {
  data: T[]
  meta: ListMeta<X>
}

/** What `api.list()` (and an unwrapped list response) resolves to. */
export type ListResult<T, X extends object = Record<never, never>> = ListEnvelope<T, X>

/** `{ code, message (BM), fields?, retryAfter?, ... }`: defined once in `@pp/contract` (ADR-0018). */
export type ErrorPayload = ContractErrorPayload

export type ErrorBody = ContractErrorBody

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** `{ data: ... }` (with or without `meta`). */
export function isEnvelope(body: unknown): body is Envelope<unknown> & Record<string, unknown> {
  return isRecord(body) && 'data' in body
}

/** `{ data: [...], meta: {...} }`. */
export function isListEnvelope(body: unknown): body is ListEnvelope<unknown> {
  return isEnvelope(body) && Array.isArray(body.data) && isRecord(body.meta)
}

/** `{ error: { code, message } }` in the master SRS §7.3 shape. */
export function isErrorBody(body: unknown): body is ErrorBody {
  return (
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.code === 'string' &&
    typeof body.error.message === 'string'
  )
}
