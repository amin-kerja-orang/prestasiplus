/**
 * SRS M09 v1.6 §7 #15 `GET /api/admin/banners` (S9), #16 `GET /api/admin/banners/:id` (S11),
 * #17 `POST /api/admin/banners` (S10), #18 `PUT /api/admin/banners/:id` (S11) and #19
 * `DELETE /api/admin/banners/:id`. Admin only. The codes are stored upper case (BR-M09-12); a
 * banner edit also accepts the stored code of that banner (BR-M09-13, DV-M09-07) so a seeded
 * `FEATURE` / `PROMOTIONAL` banner can be saved unchanged. A saved banner is delivered by
 * #20 `GET /api/banners/active` (BR-M09-14).
 */

import {
  created,
  int,
  notFound,
  ok,
  route,
  unpaged,
  validationError,
  type RouteDef,
} from '@/mock/define'

import { bannersRepo } from '../repository'
import type { BannerRow } from '../types'
import {
  ADMIN_FLASH,
  adminOnly,
  asBool,
  asInt,
  bodyOf,
  clean,
  has,
  isDateKey,
  isUrl,
  MAX_LEN,
  NOT_FOUND,
} from './admin-common'
import { FIELD_INVALID, FIELD_REQUIRED } from './common'

/** FN-M09-4.2.4 / 4.2.5 / 4.2.6 option values (stored upper case). */
export const BANNER_FORM_TYPES = ['HERO', 'PROMO', 'ANNOUNCEMENT', 'EVENT'] as const
export const BANNER_LINK_TYPES = ['NONE', 'SUBJECT', 'QUIZ', 'ARTICLE', 'EXTERNAL'] as const
export const BANNER_AUDIENCES = ['ALL', 'STUDENT', 'TEACHER', 'ADMIN'] as const

type BannerInput = Parameters<typeof bannersRepo.create>[0]

function parse(
  raw: unknown,
  current?: BannerRow,
): { fields: Record<string, string> } | { input: BannerInput } {
  const body = bodyOf(raw)
  const fields: Record<string, string> = {}

  const text = (key: keyof BannerRow, max: number, required: boolean): string | null => {
    if (current && !has(body, key)) return (current[key] as string | null) ?? null
    const v = clean(body[key])
    if (v === null || v === undefined) {
      if (required) fields[key] = FIELD_REQUIRED
      return null
    }
    if (typeof v !== 'string' || v.length > max) {
      fields[key] = FIELD_INVALID
      return null
    }
    return v
  }

  const title = text('title', 255, true)
  const description = text('description', MAX_LEN.description, false)
  const imageUrl = text('imageUrl', 2048, false)
  if (imageUrl !== null && !isUrl(imageUrl)) fields.imageUrl = FIELD_INVALID

  /** An upper-cased code; `storedCode` (edit only) is accepted besides the form values. */
  const code = (
    key: 'bannerType' | 'linkType' | 'targetAudience',
    allowed: readonly string[],
    fallback: string | null,
  ): string => {
    const stored = current?.[key]
    if (current && !has(body, key)) return stored as string
    const v = clean(body[key])
    if (v === null || v === undefined) {
      if (fallback === null) fields[key] = FIELD_REQUIRED
      return fallback ?? ''
    }
    if (typeof v !== 'string') {
      fields[key] = FIELD_INVALID
      return ''
    }
    const upper = v.toUpperCase()
    if (!allowed.includes(upper) && upper !== stored?.toUpperCase()) fields[key] = FIELD_INVALID
    return upper
  }
  const bannerType = code('bannerType', BANNER_FORM_TYPES, null)
  const linkType = code('linkType', BANNER_LINK_TYPES, 'NONE')
  const targetAudience = code('targetAudience', BANNER_AUDIENCES, 'ALL')

  // `externalUrl` is only kept for the `EXTERNAL` link type (FR-M09-55) and is required for it.
  let externalUrl: string | null = null
  if (linkType === 'EXTERNAL') {
    externalUrl = text('externalUrl', 2048, true)
    if (externalUrl === null) fields.externalUrl = FIELD_REQUIRED
    else if (!isUrl(externalUrl)) fields.externalUrl = FIELD_INVALID
  }

  let displayOrder = current?.displayOrder ?? 0
  if (has(body, 'displayOrder')) {
    const v = clean(body.displayOrder)
    if (v === null || v === undefined) displayOrder = 0
    else {
      const n = asInt(v)
      if (n === undefined || n < 0) fields.displayOrder = FIELD_INVALID
      else displayOrder = n
    }
  }

  const date = (key: 'startDate' | 'endDate'): string | null => {
    if (current && !has(body, key)) return current[key]
    const v = clean(body[key])
    if (v === null || v === undefined) return null
    if (typeof v !== 'string' || !isDateKey(v)) {
      fields[key] = FIELD_INVALID
      return null
    }
    return v
  }
  const startDate = date('startDate')
  const endDate = date('endDate')
  if (startDate !== null && endDate !== null && endDate < startDate && !fields.endDate) {
    fields.endDate = FIELD_INVALID
  }

  // The form checkbox is ticked by default (FN-M09-4.2.7).
  let isActive = current?.isActive ?? true
  if (has(body, 'isActive')) {
    const b = asBool(body.isActive)
    if (b === undefined) fields.isActive = FIELD_INVALID
    else isActive = b
  }

  if (Object.keys(fields).length > 0) return { fields }
  return {
    input: {
      title: title as string,
      description,
      imageUrl,
      bannerType,
      linkType,
      externalUrl,
      targetAudience,
      displayOrder,
      startDate,
      endDate,
      isActive,
    },
  }
}

export const adminBannerRoutes: RouteDef[] = [
  route('GET', '/api/admin/banners', [adminOnly], () => unpaged(bannersRepo.all())),

  route(
    'GET',
    '/api/admin/banners/:id',
    [adminOnly],
    (req) => {
      const row = bannersRepo.get(Number(req.params.id))
      return row ? ok(row) : notFound(NOT_FOUND.banner)
    },
    { params: { id: int() } },
  ),

  route('POST', '/api/admin/banners', [adminOnly], (req) => {
    const parsed = parse(req.body)
    if ('fields' in parsed) return validationError(parsed.fields)
    return created(bannersRepo.create(parsed.input), { status: ADMIN_FLASH.banner.created })
  }),

  route(
    'PUT',
    '/api/admin/banners/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      const current = bannersRepo.get(id)
      if (!current) return notFound(NOT_FOUND.banner)
      const parsed = parse(req.body, current)
      if ('fields' in parsed) return validationError(parsed.fields)
      return ok(bannersRepo.update(id, parsed.input), { status: ADMIN_FLASH.banner.updated })
    },
    { params: { id: int() } },
  ),

  route(
    'DELETE',
    '/api/admin/banners/:id',
    [adminOnly],
    (req) => {
      const id = Number(req.params.id)
      if (!bannersRepo.get(id)) return notFound(NOT_FOUND.banner)
      bannersRepo.remove(id)
      return ok({ deleted: 1 }, { status: ADMIN_FLASH.banner.deleted })
    },
    { params: { id: int() } },
  ),
]
