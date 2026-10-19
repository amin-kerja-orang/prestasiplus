import { z } from '../zod'

/**
 * Request-field builders that reproduce the mock's input handling and exact 422 copy
 * (`mock/handlers/admin-common.ts` + `src/mock/server/validate.ts`, Laravel default English):
 *
 * - strings are trimmed and an empty string becomes null (`normalise`); null/absent is "empty";
 * - integers and booleans accept what the mock accepts (JSON numbers or digit strings; true, false,
 *   1, 0, "1", "0"), and the parsed output is a number or boolean;
 * - a JSON number is read as its text where the field is free text (`topicNumber`);
 * - every failure message is the mock's template with `:attribute` replaced by the field name in
 *   words (`educationLevelId` becomes "education level id").
 *
 * Existence and uniqueness rules ("The selected :attribute is invalid." for unknown references,
 * "The :attribute has already been taken." for duplicate codes) need the database and are enforced
 * by the server with the same copy; `CURRICULUM_VALIDATION_MESSAGES` holds the templates.
 */

export const CURRICULUM_VALIDATION_MESSAGES = {
  required: 'The :attribute field is required.',
  string: 'The :attribute field must be a string.',
  integer: 'The :attribute field must be an integer.',
  boolean: 'The :attribute field must be true or false.',
  array: 'The :attribute field must be an array.',
  exists: 'The selected :attribute is invalid.',
  unique: 'The :attribute has already been taken.',
  regex: 'The :attribute field format is invalid.',
  min: 'The :attribute field must be at least :n.',
  maxString: 'The :attribute field must not be greater than :n characters.',
} as const

/** Laravel `:attribute`: `educationLevelId` becomes "education level id". */
export function attributeName(field: string): string {
  return field
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .trim()
}

const text = (template: string, field: string, n?: number): string => {
  const out = template.replaceAll(':attribute', attributeName(field))
  return n === undefined ? out : out.replaceAll(':n', String(n))
}
const missing = (input: unknown): boolean => input === undefined || input === null
const M = CURRICULUM_VALIDATION_MESSAGES

/** Mock `normalise`: trim; empty becomes null. */
const trimmed = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  const t = v.trim()
  return t === '' ? null : t
}

/** Free-text field; `numberAsText` reads a JSON number as its text (BR-07 `topicNumber`). */
export function textField(field: string, opts: { max?: number; required?: boolean; numberAsText?: boolean } = {}) {
  const base = z.string({
    error: (i) => (missing(i.input) && opts.required ? text(M.required, field) : text(M.string, field)),
  })
  const inner = opts.max === undefined ? base : base.max(opts.max, { error: text(M.maxString, field, opts.max) })
  return z.preprocess(
    (v) => trimmed(opts.numberAsText && typeof v === 'number' ? String(v) : v),
    opts.required ? inner : inner.nullish(),
  )
}

/** Integer accepted as a JSON number or a digit string; always optional (the mock never requires one). */
export function intField(field: string, opts: { min?: number } = {}) {
  let inner = z.int({ error: text(M.integer, field) })
  if (opts.min !== undefined) inner = inner.min(opts.min, { error: text(M.min, field, opts.min) })
  return z.preprocess((v) => {
    const t = trimmed(v)
    return typeof t === 'string' && /^-?\d+$/.test(t) ? Number(t) : t
  }, inner.nullish())
}

/** Laravel `boolean`: true, false, 1, 0, "1", "0". */
export function boolField(field: string, opts: { required?: boolean } = {}) {
  const inner = z.boolean({
    error: (i) => (missing(i.input) && opts.required ? text(M.required, field) : text(M.boolean, field)),
  })
  return z.preprocess(
    (v) => (v === 1 || v === '1' ? true : v === 0 || v === '0' ? false : trimmed(v)),
    opts.required ? inner : inner.optional(),
  )
}

/** Opaque id of an existing record; a number is read as its text. Unknown ids are the server's 422. */
export function idField(field: string, opts: { required?: boolean } = {}) {
  const inner = z
    .string({
      error: (i) => (missing(i.input) && opts.required !== false ? text(M.required, field) : text(M.exists, field)),
    })
    .min(1, { error: text(M.exists, field) })
    .max(64, { error: text(M.exists, field) })
  return z.preprocess((v) => trimmed(typeof v === 'number' ? String(v) : v), inner)
}

export function enumField<const T extends readonly [string, ...string[]]>(field: string, values: T) {
  return z.preprocess(
    trimmed,
    z.enum(values, { error: (i) => (missing(i.input) ? text(M.required, field) : text(M.exists, field)) }),
  )
}

export function hexColorField(field: string) {
  return z.preprocess(
    trimmed,
    z
      .string({ error: text(M.string, field) })
      .regex(/^#[0-9a-fA-F]{6}$/, { error: text(M.regex, field) })
      .nullish(),
  )
}

export function idListField(field: string) {
  const item = z.string({ error: text(M.exists, field) }).min(1, { error: text(M.exists, field) })
  return z.preprocess(
    (v) => (Array.isArray(v) ? v.map((x) => (typeof x === 'number' ? String(x) : x)) : v),
    z.array(item, { error: text(M.array, field) }).nullish(),
  )
}
