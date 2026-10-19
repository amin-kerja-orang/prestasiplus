/**
 * Body validation for the M14 handlers (SRS M14 §5, §7; "validate all input at the boundary").
 * One declarative spec per body: whole numbers (JSON numbers or numeric strings, as a multipart post
 * sends them), trimmed text, enum values and booleans. Failures answer `422 VALIDATION_ERROR` with
 * `fields` (camelCase names) and the summary "Sila lengkapkan semua medan wajib." (SRS §8.2).
 */

import { validationError, type MockRequest, type MockResponse } from '@/mock/define'

import { MSG } from './common'

export type Body = Readonly<Record<string, unknown>>

export type FieldSpec =
  | { kind: 'int'; min?: number; max?: number; optional?: boolean }
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

const isBlob = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob

/** The request body as a plain record (JSON object or multipart fields); anything else is `{}`. */
export function bodyOf(req: MockRequest): Body {
  const b = req.body
  return typeof b === 'object' && b !== null && !Array.isArray(b) && !isBlob(b) ? (b as Body) : {}
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
  if (value === true || value === 1 || value === '1' || value === 'true' || value === 'on') {
    return true
  }
  if (value === false || value === 0 || value === '0' || value === 'false') return false
  return undefined
}

const isEmpty = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '')

/**
 * Reads `input` by `specs`. Returns the parsed values, or the `422` response (every failing field,
 * the first problem of each). Optional fields that are absent or blank read `undefined`.
 */
export function readFields<S extends Specs>(
  input: unknown,
  specs: S,
): { ok: true; value: Parsed<S> } | { ok: false; response: MockResponse } {
  const body: Body =
    typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Body) : {}
  const fields: Record<string, string> = {}
  const value: Record<string, unknown> = {}
  for (const [name, spec] of Object.entries(specs)) {
    const raw = body[name]
    if (isEmpty(raw)) {
      if (spec.optional) continue
      // An unchecked checkbox is not posted: a required boolean needs a value.
      fields[name] = MSG.required
      continue
    }
    switch (spec.kind) {
      case 'int': {
        const n = intOf(raw)
        if (
          n === undefined ||
          (spec.min !== undefined && n < spec.min) ||
          (spec.max !== undefined && n > spec.max)
        ) {
          fields[name] = MSG.invalid
        } else value[name] = n
        break
      }
      case 'text': {
        if (typeof raw !== 'string') fields[name] = MSG.invalid
        else {
          const text = raw.trim()
          if (
            (spec.max !== undefined && [...text].length > spec.max) ||
            (spec.pattern !== undefined && !spec.pattern.test(text))
          ) {
            fields[name] = MSG.invalid
          } else value[name] = text
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
  if (Object.keys(fields).length > 0) {
    return { ok: false, response: validationError(fields, MSG.summary) }
  }
  return { ok: true, value: value as Parsed<S> }
}
