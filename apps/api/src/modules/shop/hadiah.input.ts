import { REWARD_BULK_ACTIONS, REWARD_CATEGORIES, REWARD_DELIVERY_METHODS, REWARD_VALIDATION_MESSAGES as MSG, type RewardBulkAction, type RewardCategory, type RewardDeliveryMethod } from '@pp/contract'

import { isIdString } from '../../db/ids'

/**
 * Boundary validation of the Hadiah admin writes: a port of the mock `handlers/input.ts` (BR-M15-11, 12, 13).
 * The mock is lenient on purpose (digit strings are accepted for numbers, booleans may be 1/0/"on"/"off"); the
 * messages are the Laravel-style English texts the contract lists (no BM copy exists). The field order of the
 * checks is the order of the summary message ("first message (and N more errors)").
 */

export type Fields = Record<string, string>
type Raw = Record<string, unknown>

/** The writable fields of a reward after defaults (BR-M15-13). `imageUrl` is validated but has no column (see report). */
export interface HadiahFields {
  category: RewardCategory
  vendor: string
  title: string
  description: string | null
  denominationRm: number
  tokenCost: number
  iconEmoji: string | null
  stockQuantity: number | null
  maxPerMonthPerStudent: number | null
  voucherValidityDays: number
  deliveryMethod: RewardDeliveryMethod
  vendorSku: string | null
  displayOrder: number
  imageUrl: string | null
  termsText: string | null
  isActive: boolean
  requiresParentConsent: boolean
}

const isBlank = (v: unknown): boolean => v === undefined || v === null || (typeof v === 'string' && v.trim() === '')

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
const record = (body: unknown): Raw => (typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Raw) : {})

export type ParsedInput = { ok: true; value: HadiahFields } | { ok: false; fields: Fields }

/** Create / replace body: required `category`, `vendor`, `title`, `denominationRm`, `tokenCost`; the rest defaults. */
export function parseHadiahInput(body: unknown): ParsedInput {
  const fields: Fields = {}
  const b = record(body)

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

  const int = (name: string, min: number, max: number, required: boolean, fallback: number | null): number | null => {
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
  if (isBlank(category)) fields.category = MSG.categoryRequired
  else if (!(REWARD_CATEGORIES as readonly unknown[]).includes(category)) fields.category = MSG.categoryInvalid
  const delivery = b.deliveryMethod
  if (!isBlank(delivery) && !(REWARD_DELIVERY_METHODS as readonly unknown[]).includes(delivery)) fields.deliveryMethod = MSG.deliveryMethodInvalid

  const vendor = text('vendor', 100, true)
  const title = text('title', 200, true)
  const description = text('description', 1000, false)
  const iconEmoji = text('iconEmoji', 8, false)
  const vendorSku = text('vendorSku', 100, false)
  const termsText = text('termsText', 2000, false)
  let imageUrl = text('imageUrl', 500, false)
  if (imageUrl !== null && !/^https?:\/\/\S+$/i.test(imageUrl.trim())) {
    fields.imageUrl = MSG.imageUrlInvalid
    imageUrl = null
  }

  const denominationRm = int('denominationRm', 1, 10000, true, null)
  const tokenCost = int('tokenCost', 1, 10000, true, null)
  const stockQuantity = int('stockQuantity', 0, 999_999_999, false, null)
  const maxPerMonth = int('maxPerMonthPerStudent', 1, 99, false, null)
  const validity = int('voucherValidityDays', 1, 1825, false, 365)
  const displayOrder = int('displayOrder', 0, 9999, false, 100)

  const isActive = asBool(b.isActive, true)
  if (isActive === undefined) fields.isActive = MSG.isActiveInvalid
  const consent = asBool(b.requiresParentConsent, false)
  if (consent === undefined) fields.requiresParentConsent = MSG.requiresParentConsentInvalid

  if (Object.keys(fields).length > 0) return { ok: false, fields }
  return {
    ok: true,
    value: {
      category: category as RewardCategory,
      vendor: vendor as string,
      title: title as string,
      description,
      denominationRm: denominationRm as number,
      tokenCost: tokenCost as number,
      iconEmoji,
      stockQuantity,
      maxPerMonthPerStudent: maxPerMonth,
      voucherValidityDays: validity as number,
      deliveryMethod: isBlank(delivery) ? 'manual' : (delivery as RewardDeliveryMethod),
      vendorSku,
      displayOrder: displayOrder as number,
      imageUrl,
      termsText,
      isActive: isActive as boolean,
      requiresParentConsent: consent as boolean,
    },
  }
}

export type BulkChange =
  | { action: 'activate' | 'deactivate' | 'delete' }
  | { action: 'set_stock'; value: number | null }
  | { action: 'set_max_per_month'; value: number | null }
  | { action: 'set_token_cost'; pct: number }

export type ParsedBulk = { ok: true; change: BulkChange; ids: string[] } | { ok: false; fields: Fields }

/** The raw text of a bulk value: a string or a number, trimmed; `''` when absent. */
function rawText(v: unknown): string | undefined {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v.trim()
  if (typeof v === 'number') return String(v)
  return undefined
}

/** Bulk action: the action, the ids (positive integers as numbers or digit strings) and the action's value. */
export function parseBulk(body: unknown): ParsedBulk {
  const fields: Fields = {}
  const b = record(body)

  const action = b.action
  if (isBlank(action)) fields.action = MSG.actionRequired
  else if (!(REWARD_BULK_ACTIONS as readonly unknown[]).includes(action)) fields.action = MSG.actionInvalid

  const ids: string[] = []
  if (!Array.isArray(b.ids) || b.ids.length === 0) {
    fields.ids = MSG.idsRequired
  } else {
    for (const v of b.ids as unknown[]) {
      const n = typeof v === 'number' ? (Number.isSafeInteger(v) ? String(v) : undefined) : typeof v === 'string' && /^\d{1,19}$/.test(v.trim()) ? v.trim().replace(/^0+(?=\d)/, '') : undefined
      if (n === undefined || n === '0' || !isIdString(n)) {
        fields.ids = MSG.idsInvalid
        break
      }
      ids.push(n)
    }
  }
  if (Object.keys(fields).length > 0) return { ok: false, fields }

  switch (action as RewardBulkAction) {
    case 'activate':
    case 'deactivate':
    case 'delete':
      return { ok: true, change: { action: action as 'activate' | 'deactivate' | 'delete' }, ids }
    case 'set_stock': {
      const t = rawText(b.stockValue)
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 999_999))) return { ok: false, fields: { stockValue: MSG.stockValue } }
      return { ok: true, change: { action: 'set_stock', value: t === '' ? null : Number(t) }, ids }
    }
    case 'set_max_per_month': {
      const t = rawText(b.maxPerMonthValue)
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 99))) return { ok: false, fields: { maxPerMonthValue: MSG.maxPerMonthValue } }
      const n = t === '' ? 0 : Number(t)
      return { ok: true, change: { action: 'set_max_per_month', value: n === 0 ? null : n }, ids }
    }
    case 'set_token_cost': {
      const t = rawText(b.tokenCostDeltaPct)
      // parseInt(text, 10) semantics: the leading integer ("50%" -> 50, "+50abc" -> 50).
      const pct = t === undefined ? Number.NaN : Number.parseInt(t, 10)
      if (Number.isNaN(pct) || pct === 0 || pct < -90 || pct > 500) return { ok: false, fields: { tokenCostDeltaPct: MSG.tokenCostDeltaPct } }
      return { ok: true, change: { action: 'set_token_cost', pct }, ids }
    }
  }
}

/** The voucher code of a delivery: trimmed, 1 to 100 characters. The code is a secret: it is never logged or put in an audit row. */
export function parseVoucherCode(body: unknown): { ok: true; code: string } | { ok: false; fields: Fields } {
  const raw = record(body).code
  const code = typeof raw === 'string' ? raw.trim() : ''
  if (code === '') return { ok: false, fields: { code: MSG.codeRequired } }
  if (code.length > 100) return { ok: false, fields: { code: MSG.codeTooLong } }
  return { ok: true, code }
}
