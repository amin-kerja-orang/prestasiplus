/**
 * Validation helper (overview §6.4): a small typed rule set that answers `422 VALIDATION_ERROR` with
 * `fields` and exact messages. There is no schema library: rules are few, and every message can be
 * replaced per rule or per field so module copy stays exact (SRS §5 of each module).
 *
 * ```ts
 * const invalid = validate(req.body, {
 *   name: [required()],
 *   email: [required(), email(), unique((v) => users.findByEmail(String(v)) !== undefined)],
 *   password: [required(), min(6), confirmed()],
 * })
 * if (invalid) return invalid
 * ```
 *
 * Semantics follow Laravel 11, whose English defaults are the M01 §5 copy until live copy is
 * verified:
 * - fields are validated in the order given; each field reports its **first** failing rule;
 * - rules other than `required` are skipped for an empty value (`undefined`, `null`, blank string,
 *   empty array);
 * - `min`/`max` measure numbers by value, strings by characters, arrays by items and files
 *   (`Blob`) by kilobytes;
 * - `:attribute` is the field name in words (`profilePicture` / `profile_picture` → "profile
 *   picture"), unless `options.attributes` names it;
 * - the top-level `message` is the first field message plus "(and N more error(s))".
 */

import { abort, validationError } from './respond'
import type { MockResponse } from './types'

export type Input = Readonly<Record<string, unknown>>

export interface RuleContext {
  field: string
  input: Input
}

/** A rule returns `null` when the value passes, or its message template (with `:attribute`). */
export interface ValidationRule {
  readonly name: string
  /** Implicit rules (e.g. `required`) also run on empty values. */
  readonly implicit?: boolean
  check(value: unknown, ctx: RuleContext): string | null
}

export type RuleSet = Readonly<Record<string, readonly ValidationRule[]>>

export interface ValidateOptions {
  /** Message overrides: `'field.rule'` (wins) or `'rule'` → message (may use `:attribute`). */
  messages?: Readonly<Record<string, string>>
  /** `:attribute` names per field. */
  attributes?: Readonly<Record<string, string>>
  /** Top-level `error.message`; default: the Laravel summary. */
  message?: string
}

export function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true
  if (typeof value === 'string') return value.trim() === ''
  if (Array.isArray(value)) return value.length === 0
  return false
}

/** `profilePicture`, `profile_picture` → "profile picture". */
export function attributeName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
}

/** Reads `a.b.0.c` paths from the input. */
export function readPath(input: Input, field: string): unknown {
  let value: unknown = input
  for (const key of field.split('.')) {
    if (value === null || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

type Measured =
  | { kind: 'numeric'; size: number }
  | { kind: 'string'; size: number }
  | { kind: 'array'; size: number }
  | { kind: 'file'; size: number }

function measure(value: unknown): Measured | null {
  if (typeof value === 'number' && Number.isFinite(value)) return { kind: 'numeric', size: value }
  if (typeof value === 'string') return { kind: 'string', size: [...value].length }
  if (Array.isArray(value)) return { kind: 'array', size: value.length }
  if (typeof Blob !== 'undefined' && value instanceof Blob) {
    return { kind: 'file', size: value.size / 1024 }
  }
  return null
}

function withMessage(rule: ValidationRule, message: string | undefined): ValidationRule {
  if (message === undefined) return rule
  return { ...rule, check: (value, ctx) => (rule.check(value, ctx) === null ? null : message) }
}

export function required(message?: string): ValidationRule {
  return withMessage(
    {
      name: 'required',
      implicit: true,
      check: (value) => (isEmptyValue(value) ? 'The :attribute field is required.' : null),
    },
    message,
  )
}

/** WHATWG `type=email` syntax, like the native field on the same forms. */
const EMAIL_RE =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export function email(message?: string): ValidationRule {
  return withMessage(
    {
      name: 'email',
      check: (value) =>
        typeof value === 'string' && EMAIL_RE.test(value)
          ? null
          : 'The :attribute field must be a valid email address.',
    },
    message,
  )
}

const MIN_MESSAGES = {
  numeric: 'The :attribute field must be at least :n.',
  string: 'The :attribute field must be at least :n characters.',
  array: 'The :attribute field must have at least :n items.',
  file: 'The :attribute field must be at least :n kilobytes.',
} as const

const MAX_MESSAGES = {
  numeric: 'The :attribute field must not be greater than :n.',
  string: 'The :attribute field must not be greater than :n characters.',
  array: 'The :attribute field must not have more than :n items.',
  file: 'The :attribute field must not be greater than :n kilobytes.',
} as const

export function min(n: number, message?: string): ValidationRule {
  return withMessage(
    {
      name: 'min',
      check(value) {
        const m = measure(value)
        if (m === null) return MIN_MESSAGES.string.replace(':n', String(n))
        return m.size < n ? MIN_MESSAGES[m.kind].replace(':n', String(n)) : null
      },
    },
    message,
  )
}

export function max(n: number, message?: string): ValidationRule {
  return withMessage(
    {
      name: 'max',
      check(value) {
        const m = measure(value)
        if (m === null) return MAX_MESSAGES.string.replace(':n', String(n))
        return m.size > n ? MAX_MESSAGES[m.kind].replace(':n', String(n)) : null
      },
    },
    message,
  )
}

/** The value (compared as text, like Laravel) is one of `values`. */
export function oneOf(
  values: readonly (string | number | boolean)[],
  message?: string,
): ValidationRule {
  const allowed = new Set(values.map((v) => String(v)))
  return withMessage(
    {
      name: 'in',
      check: (value) =>
        (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') &&
        allowed.has(String(value))
          ? null
          : 'The selected :attribute is invalid.',
    },
    message,
  )
}
/** Laravel's name for `oneOf`. */
export const isIn = oneOf

/** `exists`: `found(value)` tells whether the referenced record exists. */
export function exists(
  found: (value: unknown, ctx: RuleContext) => boolean,
  message?: string,
): ValidationRule {
  return withMessage(
    {
      name: 'exists',
      check: (value, ctx) => (found(value, ctx) ? null : 'The selected :attribute is invalid.'),
    },
    message,
  )
}

/** `unique`: `taken(value)` tells whether another record already uses the value. */
export function unique(
  taken: (value: unknown, ctx: RuleContext) => boolean,
  message?: string,
): ValidationRule {
  return withMessage(
    {
      name: 'unique',
      check: (value, ctx) => (taken(value, ctx) ? 'The :attribute has already been taken.' : null),
    },
    message,
  )
}

/** The value equals `<field>Confirmation` (camelCase API names), or the given field. */
export function confirmed(otherField?: string, message?: string): ValidationRule {
  return withMessage(
    {
      name: 'confirmed',
      check: (value, ctx) =>
        readPath(ctx.input, otherField ?? `${ctx.field}Confirmation`) === value
          ? null
          : 'The :attribute field confirmation does not match.',
    },
    message,
  )
}

/** A custom rule: `check` returns the message template when the value fails. */
export function rule(
  name: string,
  check: (value: unknown, ctx: RuleContext) => string | null,
  options: { implicit?: boolean } = {},
): ValidationRule {
  return { name, implicit: options.implicit ?? false, check }
}

/** Field → first message, or `null` when everything passes. */
export function validationErrors(
  input: unknown,
  rules: RuleSet,
  options: ValidateOptions = {},
): Record<string, string> | null {
  const data: Input =
    typeof input === 'object' && input !== null && !Array.isArray(input) ? (input as Input) : {}
  const fields: Record<string, string> = {}
  for (const [field, fieldRules] of Object.entries(rules)) {
    const value = readPath(data, field)
    const empty = isEmptyValue(value)
    for (const r of fieldRules) {
      if (empty && !r.implicit) continue
      const template = r.check(value, { field, input: data })
      if (template === null) continue
      const custom = options.messages?.[`${field}.${r.name}`] ?? options.messages?.[r.name]
      const attribute = options.attributes?.[field] ?? attributeName(field)
      fields[field] = (custom ?? template).replaceAll(':attribute', attribute)
      break
    }
  }
  return Object.keys(fields).length > 0 ? fields : null
}

/** `422 VALIDATION_ERROR` response, or `null` when the input is valid. */
export function validate(
  input: unknown,
  rules: RuleSet,
  options: ValidateOptions = {},
): MockResponse | null {
  const fields = validationErrors(input, rules, options)
  return fields ? validationError(fields, options.message) : null
}

/** Like `validate`, but throws (the server answers 422 and rolls back). */
export function assertValid(input: unknown, rules: RuleSet, options: ValidateOptions = {}): void {
  const response = validate(input, rules, options)
  if (response) abort(response)
}
