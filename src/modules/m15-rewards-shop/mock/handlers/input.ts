/**
 * Boundary validation of the M15 admin requests (SRS M15 v1.4 §5 server-side re-check, BR-M15-11,
 * BR-M15-12, BR-M15-13). No live BM copy exists for the server answers (SRS §5), so the messages
 * are the Laravel-style defaults; the pages never reach them through the native checks.
 */

import {
  DELIVERY_METHODS,
  HADIAH_CATEGORIES,
  type BulkAction,
  type DeliveryMethod,
  type HadiahCategory,
} from '../../api/types'
import type { BulkChange } from '../repository/hadiah'
import type { HadiahFields } from '../repository/types'

export type Fields = Record<string, string>

type Raw = Record<string, unknown>

const isBlank = (v: unknown): boolean =>
  v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

/** An integer from a number or a digit string (optional minus); `undefined` when not an integer. */
function asInt(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isSafeInteger(v) ? v : undefined
  if (typeof v === 'string' && /^-?\d+$/.test(v.trim())) {
    const n = Number(v.trim())
    return Number.isSafeInteger(n) ? n : undefined
  }
  return undefined
}

function asBool(v: unknown, fallback: boolean): boolean | undefined {
  if (v === undefined || v === null) return fallback
  if (typeof v === 'boolean') return v
  if (v === 1 || v === '1' || v === 'true' || v === 'on') return true
  if (v === 0 || v === '0' || v === 'false' || v === 'off') return false
  return undefined
}

const label = (field: string): string => field.replace(/([A-Z])/g, ' $1').toLowerCase()

export type ParsedInput = { ok: true; value: HadiahFields } | { ok: false; fields: Fields }

/** #3 / #4: required `category`, `vendor`, `title`, `denominationRm`, `tokenCost`; defaults BR-M15-13. */
export function parseHadiahInput(body: unknown): ParsedInput {
  const fields: Fields = {}
  const b: Raw = typeof body === 'object' && body !== null ? (body as Raw) : {}

  const text = (name: string, max: number, required: boolean): string | null => {
    const v = b[name]
    if (isBlank(v)) {
      if (required) fields[name] = `The ${label(name)} field is required.`
      return null
    }
    if (typeof v !== 'string') {
      fields[name] = `The ${label(name)} field must be a string.`
      return null
    }
    if (v.length > max) {
      fields[name] = `The ${label(name)} field must not be greater than ${String(max)} characters.`
      return null
    }
    return v
  }

  const int = (
    name: string,
    min: number,
    max: number,
    required: boolean,
    fallback: number | null,
  ): number | null => {
    const v = b[name]
    if (isBlank(v)) {
      if (required) fields[name] = `The ${label(name)} field is required.`
      return fallback
    }
    const n = asInt(v)
    if (n === undefined) {
      fields[name] = `The ${label(name)} field must be an integer.`
      return fallback
    }
    if (n < min || n > max) {
      fields[name] = `The ${label(name)} field must be between ${String(min)} and ${String(max)}.`
      return fallback
    }
    return n
  }

  const category = b.category
  if (isBlank(category)) fields.category = 'The category field is required.'
  else if (!HADIAH_CATEGORIES.includes(category as HadiahCategory)) {
    fields.category = 'The selected category is invalid.'
  }
  const delivery = b.deliveryMethod
  if (!isBlank(delivery) && !DELIVERY_METHODS.includes(delivery as DeliveryMethod)) {
    fields.deliveryMethod = 'The selected delivery method is invalid.'
  }

  const vendor = text('vendor', 100, true)
  const title = text('title', 200, true)
  const description = text('description', 1000, false)
  const iconEmoji = text('iconEmoji', 8, false)
  const vendorSku = text('vendorSku', 100, false)
  const termsText = text('termsText', 2000, false)
  let imageUrl = text('imageUrl', 500, false)
  if (imageUrl !== null && !/^https?:\/\/\S+$/i.test(imageUrl.trim())) {
    fields.imageUrl = 'The image url field must be a valid URL.'
    imageUrl = null
  }

  const denominationRm = int('denominationRm', 1, 10000, true, null)
  const tokenCost = int('tokenCost', 1, 10000, true, null)
  const stockQuantity = int('stockQuantity', 0, 999_999_999, false, null)
  const maxPerMonth = int('maxPerMonthPerStudent', 1, 99, false, null)
  const validity = int('voucherValidityDays', 1, 1825, false, 365)
  const displayOrder = int('displayOrder', 0, 9999, false, 100)

  const isActive = asBool(b.isActive, true)
  if (isActive === undefined) fields.isActive = 'The is active field must be true or false.'
  const consent = asBool(b.requiresParentConsent, false)
  if (consent === undefined) {
    fields.requiresParentConsent = 'The requires parent consent field must be true or false.'
  }

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    value: {
      category: category as HadiahCategory,
      vendor: vendor as string,
      title: title as string,
      description,
      denominationRm: denominationRm as number,
      tokenCost: tokenCost as number,
      iconEmoji,
      stockQuantity,
      maxPerMonthPerStudent: maxPerMonth,
      voucherValidityDays: validity as number,
      deliveryMethod: isBlank(delivery) ? 'manual' : (delivery as DeliveryMethod),
      vendorSku,
      displayOrder: displayOrder as number,
      imageUrl,
      termsText,
      isActive: isActive as boolean,
      requiresParentConsent: consent as boolean,
    },
  }
}

const BULK_ACTIONS: readonly BulkAction[] = [
  'activate',
  'deactivate',
  'delete',
  'set_stock',
  'set_max_per_month',
  'set_token_cost',
]

export type ParsedBulk =
  { ok: true; change: BulkChange; ids: number[] } | { ok: false; fields: Fields }

/** The raw text of a bulk value: a string or a number, trimmed; `''` when absent. */
function rawText(v: unknown): string | undefined {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return undefined
}

/** #5 (BR-M15-11, BR-M15-12): the action, the ids and the action's value. */
export function parseBulk(body: unknown): ParsedBulk {
  const fields: Fields = {}
  const b: Raw = typeof body === 'object' && body !== null ? (body as Raw) : {}

  const action = b.action
  if (isBlank(action)) fields.action = 'The action field is required.'
  else if (!BULK_ACTIONS.includes(action as BulkAction)) {
    fields.action = 'The selected action is invalid.'
  }

  const ids: number[] = []
  if (!Array.isArray(b.ids) || b.ids.length === 0) {
    fields.ids = 'The ids field is required.'
  } else {
    for (const v of b.ids as unknown[]) {
      const n = asInt(v)
      if (n === undefined || n < 1) {
        fields.ids = 'The ids field must contain positive integers.'
        break
      }
      ids.push(n)
    }
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields }

  switch (action as BulkAction) {
    case 'activate':
    case 'deactivate':
    case 'delete':
      return { ok: true, change: { action: action as 'activate' | 'deactivate' | 'delete' }, ids }
    case 'set_stock': {
      const t = rawText(b.stockValue)
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 999_999))) {
        return { ok: false, fields: { stockValue: 'The stock value must be 0-999999 or empty.' } }
      }
      return { ok: true, change: { action: 'set_stock', value: t === '' ? null : Number(t) }, ids }
    }
    case 'set_max_per_month': {
      const t = rawText(b.maxPerMonthValue)
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 99))) {
        return {
          ok: false,
          fields: { maxPerMonthValue: 'The max per month value must be 0-99 or empty.' },
        }
      }
      const n = t === '' ? 0 : Number(t)
      return { ok: true, change: { action: 'set_max_per_month', value: n === 0 ? null : n }, ids }
    }
    case 'set_token_cost': {
      const t = rawText(b.tokenCostDeltaPct)
      // BR-M15-11: `parseInt(text, 10)` semantics (leading integer; "50%" -> 50, "+50abc" -> 50).
      const pct = t === undefined ? Number.NaN : Number.parseInt(t, 10)
      if (Number.isNaN(pct) || pct === 0 || pct < -90 || pct > 500) {
        return {
          ok: false,
          fields: {
            tokenCostDeltaPct: 'The token cost adjustment must be between -90 and 500 (not 0).',
          },
        }
      }
      return { ok: true, change: { action: 'set_token_cost', pct }, ids }
    }
  }
}

/** #7: the voucher code, trimmed, 1-100 characters. */
export function parseVoucherCode(
  body: unknown,
): { ok: true; code: string } | { ok: false; fields: Fields } {
  const raw = typeof body === 'object' && body !== null ? (body as Raw).code : undefined
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (code === '') return { ok: false, fields: { code: 'The code field is required.' } }
  if (code.length > 100) {
    return {
      ok: false,
      fields: { code: 'The code field must not be greater than 100 characters.' },
    }
  }
  return { ok: true, code }
}
