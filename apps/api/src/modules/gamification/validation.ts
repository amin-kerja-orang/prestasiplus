import { GAMIFICATION_MESSAGES as MSG } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'

/**
 * Body reading that mirrors the mock (`handlers/input.ts`): whole numbers (JSON numbers or numeric strings, as a
 * multipart post sends them), trimmed text, enum values, booleans and ids. Every failing field is reported
 * (the first problem of each) with the summary "Sila lengkapkan semua medan wajib." (422 `VALIDATION_ERROR`).
 */
export type Body = Readonly<Record<string, unknown>>

export type FieldSpec =
  | { kind: 'int'; min?: number; max?: number; optional?: boolean }
  | { kind: 'id'; optional?: boolean }
  | { kind: 'text'; max?: number; pattern?: RegExp; optional?: boolean }
  | { kind: 'enum'; values: readonly string[]; optional?: boolean }
  | { kind: 'bool'; optional?: boolean }

type Specs = Readonly<Record<string, FieldSpec>>
type Out<F extends FieldSpec> = F extends { optional: true }
  ? (F extends { kind: 'int' } ? number : F extends { kind: 'bool' } ? boolean : string) | undefined
  : F extends { kind: 'int' }
    ? number
    : F extends { kind: 'bool' }
      ? boolean
      : string
export type Parsed<S extends Specs> = { [K in keyof S]: Out<S[K]> }

/** The request body as a plain record; anything else is `{}`. */
export function bodyOf(raw: unknown): Body {
  return typeof raw === 'object' && raw !== null && !Array.isArray(raw) ? (raw as Body) : {}
}

/** A whole number from a JSON number or a numeric string; `undefined` otherwise. */
export function intOf(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isSafeInteger(value) ? value : undefined
  if (typeof value === 'string' && /^\s*-?\d+\s*$/.test(value)) {
    const n = Number(value)
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}

/** A boolean from true/false, 1/0, "1"/"0", "true"/"false", "on"; `undefined` otherwise. */
export function boolOf(value: unknown): boolean | undefined {
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') return true
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return undefined
}

const isEmpty = (value: unknown): boolean => value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/** 422 `VALIDATION_ERROR` with the given fields (omitted when empty) and top-level message. */
export function validationFailure(fields: Record<string, string>, message: string = MSG.summary): ApiError {
  return ApiError.of('VALIDATION_ERROR', { message, ...(Object.keys(fields).length > 0 ? { fields } : {}) })
}

export const notFoundError = (message?: string): ApiError => ApiError.of('NOT_FOUND', message === undefined ? {} : { message })

/** Reads `input` by `specs`; throws the 422 when any field fails. Absent or blank optional fields read `undefined`. */
export function readFields<S extends Specs>(input: unknown, specs: S): Parsed<S> {
  const body = bodyOf(input)
  const fields: Record<string, string> = {}
  const value: Record<string, unknown> = {}
  for (const [name, spec] of Object.entries(specs)) {
    const raw = body[name]
    if (isEmpty(raw)) {
      if (!spec.optional) fields[name] = MSG.required
      continue
    }
    switch (spec.kind) {
      case 'int': {
        const n = intOf(raw)
        if (n === undefined || (spec.min !== undefined && n < spec.min) || (spec.max !== undefined && n > spec.max)) fields[name] = MSG.invalid
        else value[name] = n
        break
      }
      case 'id': {
        const text = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : ''
        if (/^[1-9]\d{0,18}$/.test(text) && BigInt(text) <= 9223372036854775807n) value[name] = text
        else fields[name] = MSG.invalid
        break
      }
      case 'text': {
        if (typeof raw !== 'string') fields[name] = MSG.invalid
        else {
          const text = raw.trim()
          if ((spec.max !== undefined && [...text].length > spec.max) || (spec.pattern !== undefined && !spec.pattern.test(text))) fields[name] = MSG.invalid
          else value[name] = text
        }
        break
      }
      case 'enum': {
        if (typeof raw === 'string' && spec.values.includes(raw)) value[name] = raw
        else fields[name] = MSG.invalid
        break
      }
      case 'bool': {
        const b = boolOf(raw)
        if (b === undefined) fields[name] = MSG.invalid
        else value[name] = b
        break
      }
    }
  }
  if (Object.keys(fields).length > 0) throw validationFailure(fields)
  return value as Parsed<S>
}

/** A route `:id`: digits only and within bigint range, else the router's own 404 "Not Found." (the mock `int()` param). */
export function idParam(raw: string): bigint {
  if (!/^(0|[1-9]\d{0,18})$/.test(raw)) throw notFoundError()
  const id = BigInt(raw)
  if (id > 9223372036854775807n) throw notFoundError()
  return id
}

/** `YYYY-MM-DD` naming a calendar date that exists (rejects 2026-02-31, 2026-13-01). */
export function isRealDate(value: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const t = new Date(Date.UTC(y, mo - 1, d))
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d
}

/** A query value (a repeated key arrives as an array: the first string wins). */
export function queryText(v: unknown): string {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : ''
}

/** An invalid or missing page reads as 1. */
export function pageOf(v: unknown): number {
  const n = Number.parseInt(queryText(v), 10)
  return Number.isSafeInteger(n) && n >= 1 && String(n) === queryText(v).trim() ? n : 1
}
