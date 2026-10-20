/**
 * S19 `/ranking` "Kedudukan" helpers (SRS M08 FR-M08-108..112, BR-M08-27; DV-22): the query string is
 * the state (a GET form on live), the scope pills keep the other filters, and the hero subtitle / tab
 * title say which scope is shown.
 */

import { isHttpMode } from '@/api/mode'

import type { RankingScope } from '../api/types'

export const RANKING_PATH = '/ranking'

export interface ScopePill {
  id: RankingScope
  label: string
}

/** The four scope pills, in the live order. */
export const SCOPE_PILLS: readonly ScopePill[] = [
  { id: 'nasional', label: 'Nasional' },
  { id: 'negeri', label: 'Negeri' },
  { id: 'daerah', label: 'Daerah' },
  { id: 'sekolah', label: 'Sekolah' },
]

export const TINGKATAN_OPTIONS = [
  { value: '', label: 'Semua' },
  { value: 'T4', label: 'Tingkatan 4' },
  { value: 'T5', label: 'Tingkatan 5' },
] as const

/** The URL filters of S19 (`subject_id`, `tingkatan`, `negeri`; empty = not set). */
export interface RankingFilters {
  subjectId: string
  tingkatan: string
  negeri: string
}

export interface RankingState extends RankingFilters {
  /** The raw `scope` of the URL ('' when absent). */
  scope: string
}

type QueryValue = string | null | (string | null)[] | undefined

const text = (v: QueryValue): string => {
  const first = Array.isArray(v) ? v[0] : v
  return first ?? ''
}

export function readRankingState(query: Record<string, QueryValue>): RankingState {
  return {
    scope: text(query.scope),
    subjectId: text(query.subject_id),
    tingkatan: text(query.tingkatan),
    negeri: text(query.negeri),
  }
}

/** The known scope of a raw value, or `null` (an unknown scope activates no pill, FR-M08-109). */
export function knownScope(scope: string): RankingScope | null {
  return SCOPE_PILLS.find((p) => p.id === scope)?.id ?? null
}

/** An absent `scope` is the nasional list with the nasional pill active (BR-M08-27). */
export function activeScope(scope: string): RankingScope | null {
  return scope === '' ? 'nasional' : knownScope(scope)
}

/** FR-M08-108 (DV-22): the negeri value on the negeri scope when set, else the active pill label. */
export function scopeLabel(state: RankingState): string {
  const scope = activeScope(state.scope)
  if (scope === null) return 'Nasional'
  if (scope === 'negeri' && state.negeri !== '') return state.negeri
  return SCOPE_PILLS.find((p) => p.id === scope)?.label ?? 'Nasional'
}

/** Hero subtitle is the label; the tab title is "Kedudukan {x}" (FR-M08-108). */
export const tabTitle = (state: RankingState): string => `Kedudukan ${scopeLabel(state)}`

/** Non-empty filters in the order the live pills write them. */
function filterParams(f: RankingFilters): [string, string][] {
  const out: [string, string][] = []
  if (f.subjectId !== '') out.push(['subject_id', f.subjectId])
  if (f.tingkatan !== '') out.push(['tingkatan', f.tingkatan])
  if (f.negeri !== '') out.push(['negeri', f.negeri])
  return out
}

/** `{current non-empty filters}&scope={scope}` as a vue-router query object (FR-M08-109). */
export function scopeQuery(f: RankingFilters, scope: string): Record<string, string> {
  return Object.fromEntries([...filterParams(f), ['scope', scope]])
}

/** The form submit: the same URL the GET form builds (hidden `scope` + the non-empty selects). */
export function formQuery(f: RankingFilters, scope: string): Record<string, string> {
  return Object.fromEntries([['scope', scope], ...filterParams(f)])
}

/** The `fetchRankings` query for the URL state (absent values are not sent). */
export function apiQuery(state: RankingState): {
  scope?: string
  subjectId?: number | string
  tingkatan?: string
  negeri?: string
} {
  const q: { scope?: string; subjectId?: number | string; tingkatan?: string; negeri?: string } = {}
  if (state.scope !== '') q.scope = state.scope
  // The real API takes the opaque id string as it is (BE-19 `subjectId`); mock mode keeps the number.
  if (isHttpMode()) {
    if (state.subjectId !== '') q.subjectId = state.subjectId
  } else {
    const subject = Number.parseInt(state.subjectId, 10)
    if (Number.isFinite(subject)) q.subjectId = subject
  }
  if (state.tingkatan !== '') q.tingkatan = state.tingkatan
  if (state.negeri !== '') q.negeri = state.negeri
  return q
}

export const MEDALS: Record<number, { emoji: string; cls: string }> = {
  1: { emoji: '🥇', cls: 'text-highlighted' },
  2: { emoji: '🥈', cls: 'text-highlighted' },
  3: { emoji: '🥉', cls: 'text-highlighted' },
}

/** "Tepat" colour: success from 50 %, error below (INFERRED threshold, FR-M08-112). */
export const accuracyClass = (accuracy: number): string =>
  accuracy >= 50 ? 'text-success' : 'text-error'
