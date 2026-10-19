/** Pure helpers of the M13 teacher screens (SRS M13 v1.1 BR-M13-18, BR-M13-19). */

import { isApiError } from '@/api'

import { rubricOf } from '../../api'

/** `?page=` as a positive integer (a bad value is page 1). */
export function pageOf(value: unknown): number {
  const first = Array.isArray(value) ? (value[0] as unknown) : value
  const n = typeof first === 'string' ? Number.parseInt(first, 10) : Number.NaN
  return Number.isFinite(n) && n >= 1 ? n : 1
}

/** `YYYY-MM-DD` to `dd/mm/yyyy` (BR-M13-19). */
export function dmy(dateKey: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : dateKey
}

/** The rubric label without its trailing "(n markah)" (FR-M13-50). */
export function rubricShort(key: string): string {
  return rubricOf(key)
    .label.replace(/\s*\(\d+ markah\)\s*$/, '')
    .trim()
}

/** An empty free-text value shows "-". */
export function orDash(value: string | null | undefined): string {
  const t = (value ?? '').trim()
  return t === '' ? '-' : t
}

/** "T5" / "D3" from a class level slug `tingkatan-5` / `tahun-3` (BR-M13-18). */
export function levelCodeOfSlug(slug: string): string {
  const m = /^(tingkatan|tahun)-(\d)$/.exec(slug)
  if (!m) return ''
  return `${m[1] === 'tingkatan' ? 'T' : 'D'}${m[2]}`
}

/** `ApiError` field messages, else its message, else the fallback: the lines of an alert box. */
export function errorLines(err: unknown, fallback: string): string[] {
  if (isApiError(err)) {
    const fields = err.fields ? Object.values(err.fields).filter((v) => v !== '') : []
    if (fields.length > 0) return fields
    if (err.message !== '') return [err.message]
  }
  return [fallback]
}

/** Number of `\S+` runs (FR-M13-52). */
export function wordCount(text: string): number {
  return text.match(/\S+/g)?.length ?? 0
}

/** The S1 hand-off query (FR-M13-54): form encoding, all six keys, empty values kept. */
export function handoffQuery(fields: {
  rubric: string
  subject: string
  level: string
  student: string
  title: string
}): string {
  return new URLSearchParams({ action: 'mark_essay', ...fields }).toString()
}
