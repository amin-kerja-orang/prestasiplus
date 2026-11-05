/**
 * Boundary validation of the M15 admin requests, in step with the server's `shop/hadiah.input.ts`
 * (P07-02..15, BR-M15-11, 12, 13): same limits, same BM messages (the P07 rows where they give one,
 * else the ERR-REQ-10..15 patterns with the P07 labels), so the screens meet the same answers in the
 * mock and on the API. A reward is created Off (P07-14, U-OP-09) and never needs parent consent
 * (FR-GM-21.3): a posted `requiresParentConsent` is ignored.
 */

import { REWARD_VALIDATION_MESSAGES as MSG } from '@pp/contract'

import {
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

/** The P07 label of a field. */
const LABELS: Readonly<Record<string, string>> = {
  vendor: 'Vendor',
  title: 'Tajuk',
  description: 'Penerangan',
  denominationRm: 'Nilai (RM)',
  tokenCost: 'Kos Token',
  iconEmoji: 'Emoji Icon',
  stockQuantity: 'Stok',
  maxPerMonthPerStudent: 'Maks/bulan/pelajar',
  voucherValidityDays: 'Sah Hari',
  vendorSku: 'Vendor SKU',
  displayOrder: 'Display Order',
  imageUrl: 'Image URL',
  termsText: 'Terma Khas',
}
const label = (field: string): string => LABELS[field] ?? field
const required = (field: string): string => `${label(field)} diperlukan.`
const badFormat = (field: string): string => `Format ${label(field)} tidak sah.`
/** Characters as a reader counts them: a flag or a skin-tone emoji is one. */
const charCount = (text: string): number =>
  [...new Intl.Segmenter('ms', { granularity: 'grapheme' }).segment(text)].length

/** Delivery methods the form offers; `api` is not (FR-ADM-P2-07.3). */
const INPUT_DELIVERY_METHODS: readonly DeliveryMethod[] = ['manual', 'instant']

export type ParsedInput = { ok: true; value: HadiahFields } | { ok: false; fields: Fields }

/** #3 / #4: required `category`, `vendor`, `title`, `denominationRm`, `tokenCost`; defaults BR-M15-13. */
export function parseHadiahInput(body: unknown): ParsedInput {
  const fields: Fields = {}
  const b: Raw = typeof body === 'object' && body !== null ? (body as Raw) : {}

  const text = (name: string, max: number, isRequired: boolean): string | null => {
    const v = b[name]
    if (isBlank(v)) {
      if (isRequired) fields[name] = required(name)
      return null
    }
    if (typeof v !== 'string') {
      fields[name] = badFormat(name)
      return null
    }
    if (v.length > max) {
      fields[name] = `${label(name)} tidak boleh melebihi ${String(max)} aksara.`
      return null
    }
    return v
  }

  const int = (
    name: string,
    min: number,
    max: number,
    isRequired: boolean,
    fallback: number | null,
  ): number | null => {
    const v = b[name]
    if (isBlank(v)) {
      if (isRequired) fields[name] = required(name)
      return fallback
    }
    const n = asInt(v)
    if (n === undefined) {
      fields[name] = name === 'stockQuantity' ? MSG.stockValue : badFormat(name)
      return fallback
    }
    if (n < min || n > max) {
      fields[name] =
        name === 'stockQuantity'
          ? MSG.stockValue
          : `${label(name)} mesti antara ${String(min)} dan ${String(max)}.`
      return fallback
    }
    return n
  }

  /** `denominationRm`: 0.01 to 10000 with at most 2 decimal places (P07-06). */
  const money = (name: string): number | null => {
    const v = b[name]
    if (isBlank(v)) {
      fields[name] = required(name)
      return null
    }
    const n =
      typeof v === 'number'
        ? v
        : typeof v === 'string' && /^\d+(\.\d+)?$/.test(v.trim())
          ? Number(v.trim())
          : Number.NaN
    if (!Number.isFinite(n) || Math.round(n * 100) / 100 !== n) {
      fields[name] = badFormat(name)
      return null
    }
    if (n < 0.01 || n > 10000) {
      fields[name] = `${label(name)} mesti antara 0.01 dan 10000.`
      return null
    }
    return n
  }

  const category = b.category
  if (isBlank(category)) fields.category = MSG.categoryRequired
  else if (!HADIAH_CATEGORIES.includes(category as HadiahCategory)) {
    fields.category = MSG.categoryInvalid
  }
  const delivery = b.deliveryMethod
  if (!isBlank(delivery) && !INPUT_DELIVERY_METHODS.includes(delivery as DeliveryMethod)) {
    fields.deliveryMethod = MSG.deliveryMethodInvalid
  }

  const vendor = text('vendor', 60, true)
  const title = text('title', 100, true)
  const description = text('description', 500, false)
  let iconEmoji = text('iconEmoji', 16, false)
  if (iconEmoji !== null && charCount(iconEmoji.trim()) > 2) {
    fields.iconEmoji = `${label('iconEmoji')} tidak boleh melebihi 2 aksara.`
    iconEmoji = null
  }
  const vendorSku = text('vendorSku', 50, false)
  const termsText = text('termsText', 1000, false)
  let imageUrl = text('imageUrl', 500, false)
  if (imageUrl !== null && !/^https:\/\/\S+$/i.test(imageUrl.trim())) {
    fields.imageUrl = MSG.imageUrlInvalid
    imageUrl = null
  }

  const denominationRm = money('denominationRm')
  const tokenCost = int('tokenCost', 1, 100_000, true, null)
  const stockQuantity = int('stockQuantity', 0, 999_999_999, false, null)
  const maxPerMonth = int('maxPerMonthPerStudent', 1, 100, false, null)
  const validity = int('voucherValidityDays', 1, 3650, false, 365)
  const displayOrder = int('displayOrder', 0, 9999, false, 100)

  // Off by default: the admin activates the catalogue (P07-14, U-OP-09).
  const isActive = asBool(b.isActive, false)
  if (isActive === undefined) fields.isActive = MSG.isActiveInvalid

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
      // No consent status exists (FR-GM-21.3): a posted value is ignored.
      requiresParentConsent: false,
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

/** #5 (BR-M15-11, BR-M15-12): the action, the ids (numbers or digit strings) and the action's value. */
export function parseBulk(body: unknown): ParsedBulk {
  const fields: Fields = {}
  const b: Raw = typeof body === 'object' && body !== null ? (body as Raw) : {}

  const action = b.action
  if (isBlank(action)) fields.action = MSG.actionRequired
  else if (!BULK_ACTIONS.includes(action as BulkAction)) fields.action = MSG.actionInvalid

  const ids: number[] = []
  if (!Array.isArray(b.ids) || b.ids.length === 0) {
    fields.ids = MSG.idsRequired
  } else {
    for (const v of b.ids as unknown[]) {
      const n = asInt(v)
      if (n === undefined || n < 1) {
        fields.ids = MSG.idsInvalid
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
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 999_999_999))) {
        return { ok: false, fields: { stockValue: MSG.stockValue } }
      }
      return { ok: true, change: { action: 'set_stock', value: t === '' ? null : Number(t) }, ids }
    }
    case 'set_max_per_month': {
      const t = rawText(b.maxPerMonthValue)
      if (t === undefined || (t !== '' && (!/^\d+$/.test(t) || Number(t) > 100))) {
        return { ok: false, fields: { maxPerMonthValue: MSG.maxPerMonthValue } }
      }
      const n = t === '' ? 0 : Number(t)
      return { ok: true, change: { action: 'set_max_per_month', value: n === 0 ? null : n }, ids }
    }
    case 'set_token_cost': {
      const t = rawText(b.tokenCostDeltaPct)
      // BR-M15-11: `parseInt(text, 10)` semantics (leading integer; "50%" -> 50, "+50abc" -> 50).
      const pct = t === undefined ? Number.NaN : Number.parseInt(t, 10)
      if (Number.isNaN(pct) || pct === 0 || pct < -90 || pct > 500) {
        return { ok: false, fields: { tokenCostDeltaPct: MSG.tokenCostDeltaPct } }
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
  if (code === '') return { ok: false, fields: { code: MSG.codeRequired } }
  if (code.length > 100) return { ok: false, fields: { code: MSG.codeTooLong } }
  return { ok: true, code }
}
