/**
 * Pure helpers of S10 (structured list, incl. the SPM variants) and Q3 (SRS M05 v1.19 FR-M05-90…97,
 * FR-M05-133…137, BR-23).
 */

import type { LocationQuery } from 'vue-router'

import type { StructuredScope, StructuredTrack } from '../../api/types'

/** S10 "Aras KBAT" options (FR-M05-91). */
export const KBAT_OPTIONS: readonly { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: '1', label: '1. Mengingat' },
  { value: '2', label: '2. Memahami' },
  { value: '3', label: '3. Mengaplikasi' },
  { value: '4', label: '4. Menganalisis' },
  { value: '5', label: '5. Menilai' },
  { value: '6', label: '6. Mencipta' },
]

export interface KbatBadge {
  label: string
  /** Semantic colour (BR-23: 1–2 LOTS green, 3 MOTS amber, 4–6 HOTS red; all OBSERVED). */
  color: 'success' | 'warning' | 'error'
}

export function kbatBadge(level: number): KbatBadge {
  if (level <= 2) return { label: `LOTS ${String(level)}`, color: 'success' }
  if (level === 3) return { label: 'MOTS 3', color: 'warning' }
  return { label: `HOTS ${String(level)}`, color: 'error' }
}

const first = (v: LocationQuery[string] | undefined): string | null => {
  const x = Array.isArray(v) ? v[0] : v
  return typeof x === 'string' ? x : null
}

export interface Variant {
  scope: StructuredScope | null
  track: StructuredTrack | null
}

/** `scope=spm` and `track=bahasa` (the latter only with the former); anything else is the plain list. */
export function parseVariant(query: LocationQuery): Variant {
  const scope = first(query.scope) === 'spm' ? 'spm' : null
  const track = scope === 'spm' && first(query.track) === 'bahasa' ? 'bahasa' : null
  return { scope, track }
}

/** `?scope=spm[&track=bahasa]` suffix (with the leading `?` or `&`). */
export function variantQuery(v: Variant, lead: '?' | '&' = '?'): string {
  if (!v.scope) return ''
  return `${lead}scope=spm${v.track ? '&track=bahasa' : ''}`
}

export function parsePage(query: LocationQuery): number {
  const n = Number.parseInt(first(query.page) ?? '', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function answerUrl(id: number | string, v: Variant): string {
  return `/latihan-berstruktur/${String(id)}/jawab${variantQuery(v)}`
}

/** An image source is only http(s), an internal path or a `blob:` URL (M04 uploads); never `javascript:` or `data:`. */
export function safeImageSrc(url: string | null | undefined): string | null {
  if (!url) return null
  return /^https?:\/\//i.test(url) || /^\/(?![/\\])/.test(url) || /^blob:/i.test(url) ? url : null
}

/** Q3 marks label (PROPOSED COPY, §8.3). */
export const marksLabel = (marks: number): string => `[${String(marks)} markah]`
