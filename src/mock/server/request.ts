/**
 * Building `MockRequest`s from transport requests, plus small query readers for handlers
 * (overview §6.4).
 */

import type { TransportQuery, TransportRequest } from '@/api/transport'

import { normalizePath } from './router'
import type { MockQuery } from './types'

/** Splits a URL that may still carry `?query` and merges it with `query` (`query` wins per key). */
export function splitUrl(
  url: string,
  query: TransportQuery | undefined,
): { path: string; query: Record<string, string | string[]> } {
  const cut = url.indexOf('?')
  const rawPath = cut < 0 ? url : url.slice(0, cut)
  const search = cut < 0 ? '' : url.slice(cut + 1)
  const merged: Record<string, string | string[]> = {}
  if (search !== '') {
    for (const [key, value] of new URLSearchParams(search.split('#', 1)[0])) {
      const prev = merged[key]
      merged[key] =
        prev === undefined ? value : Array.isArray(prev) ? [...prev, value] : [prev, value]
    }
  }
  for (const [key, value] of Object.entries(query ?? {})) {
    merged[key] = Array.isArray(value) ? [...value] : value
  }
  return { path: normalizePath(rawPath), query: merged }
}

function isFormData(value: unknown): value is FormData {
  return typeof FormData !== 'undefined' && value instanceof FormData
}

/** Form fields as an object: repeated keys become arrays; files stay `File`/`Blob`. */
export function formDataToObject(form: FormData): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of form.entries()) {
    const prev = out[key]
    out[key] =
      prev === undefined
        ? value
        : Array.isArray(prev)
          ? [...(prev as unknown[]), value]
          : [prev, value]
  }
  return out
}

/**
 * The body as a server would receive it. JSON bodies go through `JSON.stringify`/`parse`, like a
 * real request: the handler never shares objects with the caller, `Date`s become strings and
 * `undefined` fields disappear.
 */
export function parseBody(body: unknown): { body: unknown; formData: FormData | null } {
  if (body === undefined) return { body: undefined, formData: null }
  if (isFormData(body)) return { body: formDataToObject(body), formData: body }
  if (typeof Blob !== 'undefined' && body instanceof Blob) return { body, formData: null }
  const text = JSON.stringify(body)
  return { body: text === undefined ? undefined : (JSON.parse(text) as unknown), formData: null }
}

// ---------------------------------------------------------------------------------------------
// Query readers
// ---------------------------------------------------------------------------------------------

/** The first value of `key`, or `undefined`. */
export function queryString(query: MockQuery, key: string): string | undefined {
  const value = query[key]
  return typeof value === 'string' ? value : value?.[0]
}

/** Every value of `key` (repeated keys), or `[]`. */
export function queryList(query: MockQuery, key: string): string[] {
  const value = query[key]
  if (value === undefined) return []
  return typeof value === 'string' ? [value] : [...value]
}

/** `key` as an integer (digits with an optional minus sign), or `undefined`. */
export function queryInt(query: MockQuery, key: string): number | undefined {
  const value = queryString(query, key)?.trim()
  if (value === undefined || !/^-?\d+$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : undefined
}

/** Every value of `key` that is an integer; others are dropped. */
export function queryIntList(query: MockQuery, key: string): number[] {
  return queryList(query, key)
    .map((v) => v.trim())
    .filter((v) => /^-?\d+$/.test(v))
    .map(Number)
    .filter(Number.isSafeInteger)
}

/** Header of a transport request (lower-case names). */
export function headersOf(req: TransportRequest): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [name, value] of Object.entries(req.headers)) out[name.toLowerCase()] = value
  return out
}
