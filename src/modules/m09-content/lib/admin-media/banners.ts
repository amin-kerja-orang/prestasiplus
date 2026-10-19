/**
 * Banner form options and the DV-M09-07 preselection (SRS M09 FR-M09-54..59, BR-M09-12, BR-M09-13).
 * Option values are the live form values (lower case); the API stores and receives upper-case codes.
 */

import type { AdminBanner, BannerInput } from '../../api/admin-media'

export interface SelectOption {
  value: string
  label: string
}

/** "Jenis Banner": live create set (FN-M09-4.2.4). */
export const BANNER_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'hero', label: 'Hero' },
  { value: 'promo', label: 'Promo' },
  { value: 'announcement', label: 'Pengumuman' },
  { value: 'event', label: 'Acara' },
]

/** "Jenis Pautan" (FN-M09-4.2.5). */
export const LINK_TYPE_OPTIONS: readonly SelectOption[] = [
  { value: 'none', label: 'Tiada Pautan' },
  { value: 'subject', label: 'Subjek' },
  { value: 'quiz', label: 'Kuiz' },
  { value: 'article', label: 'Artikel' },
  { value: 'external', label: 'Pautan Luar' },
]

/** "Sasaran Penonton" (FN-M09-4.2.6). */
export const AUDIENCE_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'Semua' },
  { value: 'student', label: 'Pelajar' },
  { value: 'teacher', label: 'Guru' },
  { value: 'admin', label: 'Admin' },
]

export interface Preselected {
  /** The extra option inserted first for an unmatched stored code (BR-M09-13), else `null`. */
  extra: SelectOption | null
  /** The value to select. */
  value: string
}

/**
 * BR-M09-13 / DV-M09-07: the option whose value equals the stored code ignoring case is selected;
 * with none, an extra option `{value: code, label: code}` is inserted first and selected. An empty
 * stored code selects `fallback`.
 */
export function preselect(
  base: readonly SelectOption[],
  stored: string | null | undefined,
  fallback: string,
): Preselected {
  const code = stored ?? ''
  if (code === '') return { extra: null, value: fallback }
  const match = base.find((option) => option.value.toLowerCase() === code.toLowerCase())
  if (match) return { extra: null, value: match.value }
  return { extra: { value: code, label: code }, value: code }
}

/** The form state of S10 / S11. Dates are `YYYY-MM-DD`; numbers stay editable text. */
export interface BannerFormState {
  title: string
  description: string
  imageUrl: string
  bannerType: string
  linkType: string
  externalUrl: string
  targetAudience: string
  displayOrder: number | string
  startDate: string
  endDate: string
  isActive: boolean
}

export function emptyBannerForm(): BannerFormState {
  return {
    title: '',
    description: '',
    imageUrl: '',
    bannerType: '',
    linkType: 'none',
    externalUrl: '',
    targetAudience: 'all',
    displayOrder: 0,
    startDate: '',
    endDate: '',
    isActive: true,
  }
}

/** The form values of a stored banner (selects resolved by {@link preselect} separately). */
export function bannerToForm(
  banner: AdminBanner,
  selects: { bannerType: string; linkType: string; targetAudience: string },
): BannerFormState {
  return {
    title: banner.title,
    description: banner.description ?? '',
    imageUrl: banner.imageUrl ?? '',
    bannerType: selects.bannerType,
    linkType: selects.linkType,
    externalUrl: banner.externalUrl ?? '',
    targetAudience: selects.targetAudience,
    displayOrder: banner.displayOrder,
    startDate: banner.startDate ?? '',
    endDate: banner.endDate ?? '',
    isActive: banner.isActive,
  }
}

const orNull = (value: string): string | null => (value === '' ? null : value)

/**
 * The #17 / #18 body. Codes go up in upper case (the stored form, BR-M09-12); `externalUrl` is only
 * sent when the link type is "Pautan Luar" (FR-M09-55); empty optional fields go as `null`.
 */
export function bannerPayload(form: BannerFormState): BannerInput {
  const order = form.displayOrder === '' ? 0 : Number(form.displayOrder)
  const external = form.linkType.toLowerCase() === 'external'
  return {
    title: form.title,
    description: orNull(form.description),
    imageUrl: orNull(form.imageUrl),
    bannerType: form.bannerType.toUpperCase(),
    linkType: form.linkType.toUpperCase(),
    ...(external ? { externalUrl: form.externalUrl } : {}),
    targetAudience: form.targetAudience.toUpperCase(),
    displayOrder: Number.isFinite(order) ? order : 0,
    startDate: orNull(form.startDate),
    endDate: orNull(form.endDate),
    isActive: form.isActive,
  }
}
