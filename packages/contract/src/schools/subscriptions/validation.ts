import { z } from '../../zod'
import { ErrorPayloadSchema } from '../../common/error'

/**
 * Field-level validation copy of the M02 mock (`mock/define` rules `required`, `integer`, `min`,
 * `max`, `oneOf`, `date`). The mock answers 422 with Laravel-style English templates; the contract
 * reproduces them exactly so the same input yields the same `fields.<name>` text.
 * `:attribute` is the field name in words ("studentQuota" becomes "student quota").
 */
export const attributeOf = (field: string): string => field.replace(/([A-Z])/g, ' $1').toLowerCase()
export const requiredMessage = (field: string): string => `The ${attributeOf(field)} field is required.`
export const invalidChoiceMessage = (field: string): string => `The selected ${attributeOf(field)} is invalid.`

const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/**
 * An integer the mock accepts as a number or as a digit string (`intOrNull`: `^\d+$` after trim),
 * with the mock bounds. Text digits are accepted on the wire (form posts and multipart); a negative
 * number or a decimal fails with the `integer`/`min` copy. No transform: the parsed value keeps the
 * form it was sent in, the server normalises it.
 */
export function digitInt(field: string, bounds: { min: number; max: number }) {
  const a = attributeOf(field)
  const intMsg = `The ${a} field must be an integer.`
  const minMsg = `The ${a} field must be at least ${String(bounds.min)}.`
  const maxMsg = `The ${a} field must not be greater than ${String(bounds.max)}.`
  const withinMin = (n: number) => n >= bounds.min
  const withinMax = (n: number) => n <= bounds.max
  return z.union(
    [
      z.number().int(intMsg).min(bounds.min, minMsg).max(bounds.max, maxMsg),
      z
        .string()
        .trim()
        .regex(/^\d+$/, intMsg)
        .refine((s) => withinMin(Number(s)), { error: minMsg })
        .refine((s) => withinMax(Number(s)), { error: maxMsg }),
    ],
    {
      error: (iss) => {
        if (isBlank(iss.input)) return requiredMessage(field)
        const branches = (iss as { errors?: { message: string }[][] }).errors
        const pick = typeof iss.input === 'number' ? branches?.[0]?.[0] : branches?.[1]?.[0]
        return pick?.message ?? intMsg
      },
    },
  ).meta({ description: `Integer ${String(bounds.min)} to ${String(bounds.max)}; a digit string is accepted (the mock coerces it).` })
}

/** A value from `values`: blank is "required", anything else is "The selected ... is invalid.". */
export function enumField<const T extends readonly [string, ...string[]]>(field: string, values: T) {
  return z.enum(values, { error: (iss) => (isBlank(iss.input) ? requiredMessage(field) : invalidChoiceMessage(field)) })
}

/** A required text field. */
export function requiredText(field: string) {
  return z.string({ error: () => requiredMessage(field) }).min(1, requiredMessage(field))
}

/** An optional text field: null, absent or a string; anything else is the mock `string` rule copy. */
export function optionalText(field: string, max = 1000) {
  return z
    .string({ error: `The ${attributeOf(field)} field must be a string.` })
    .max(max, `The ${attributeOf(field)} field must not be greater than ${String(max)} characters.`)
    .nullish()
}

/** `YYYY-MM-DD`, a real calendar date (the mock `date` rule). */
export function dateField(field: string) {
  const bad = `The ${attributeOf(field)} field must be a valid date.`
  return z
    .string({ error: (iss) => (isBlank(iss.input) ? requiredMessage(field) : bad) })
    .refine(
      (v) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
        const d = new Date(`${v}T00:00:00Z`)
        return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v
      },
      { error: bad },
    )
    .meta({ format: 'date', description: 'Calendar date YYYY-MM-DD.' })
}

/**
 * A 422 the mock raises from server state (not from the shape of the request). The schema pins the
 * code, the exact BM copy and the field it is reported on.
 */
export function refusalOf(field: string, message: string) {
  return z.object({
    error: ErrorPayloadSchema.extend({
      code: z.literal('VALIDATION_ERROR'),
      message: z.literal(message),
      fields: z.object({ [field]: z.literal(message) }),
    }),
  })
}

/** D57(a): 429 on every write route and public lookup, with `retryAfter` and the `Retry-After` header. */
export const RateLimitedBodySchema = z
  .object({
    error: ErrorPayloadSchema.extend({
      code: z.literal('RATE_LIMITED'),
      retryAfter: z.number().int().nonnegative().meta({ description: 'Seconds until a retry is allowed; equals the Retry-After header.' }),
    }),
  })
  .meta({ id: 'RateLimitedBody' })

/** Headers of the 429 response. */
export const RetryAfterHeaderSchema = z.object({
  'Retry-After': z.string().regex(/^\d+$/).meta({ description: 'Seconds until a retry is allowed.' }),
})

/** D57(b): responses carrying credentials, tokens or personal data of minors are never cached. */
export const NoStoreHeaderSchema = z.object({
  'Cache-Control': z.literal('no-store').meta({ description: 'Always "no-store".' }),
})
