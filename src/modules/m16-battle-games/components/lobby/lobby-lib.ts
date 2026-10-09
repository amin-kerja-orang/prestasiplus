/**
 * Small pure helpers of the lobbies and rooms (SRS M16 v1.6 §5, §8): error lines, the S7 / S8–S12 create
 * body, the Top 10 pill colours (BR-M16-22), team labels and the elapsed-time text.
 */

import { isApiError } from '@/api'

import type { MatchMode, RoomCreateBody, RoomGame, RoomSubject } from '../../api'

/** Shown when a failed call carries no usable message (INFERRED copy, as M04's `GENERIC_ERROR`). */
export const GENERIC_ERROR = 'Ralat berlaku. Sila cuba lagi.'

/** Red-alert lines of a failed request: server field messages first, else the message. */
export function errorLines(err: unknown): string[] {
  if (!isApiError(err)) return [GENERIC_ERROR]
  if (err.status === 0 || err.code === 'NETWORK_ERROR') return [GENERIC_ERROR]
  const fieldTexts = err.fields ? Object.values(err.fields) : []
  if (fieldTexts.length > 0) return [...new Set(fieldTexts)]
  if (err.message === '' || /^HTTP \d+$/.test(err.message)) return [GENERIC_ERROR]
  return [err.message]
}

export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.status === 404
}

export interface CreateFormValues {
  subject: RoomSubject
  gradeLevel: string
  matchMode: MatchMode
  gradeMin: number
  gradeMax: number
  maxPlayers: number
}

/** The #24 body: S7 sends every field (the range only for `custom`), S8–S12 three fields. */
export function buildCreateBody(game: RoomGame, v: CreateFormValues): RoomCreateBody {
  const body: RoomCreateBody = {
    subject: v.subject,
    grade_level: v.gradeLevel,
    match_mode: v.matchMode,
  }
  if (game === 'papan-bijak') {
    body.max_players = v.maxPlayers
    if (v.matchMode === 'custom') {
      body.grade_min = v.gradeMin
      body.grade_max = v.gradeMax
    }
  }
  return body
}

/** Kadar pill classes (BR-M16-22): green at 70 % and above, amber 40–69 %, red below 40 %. */
export function kadarClass(kadar: number): string {
  if (kadar >= 70) return 'bg-emerald-100 text-emerald-800'
  if (kadar >= 40) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

/** Top 10 row styling for ranks 1–3 (gold / silver / bronze); other ranks are plain. */
export function topRowClass(rank: number): string {
  if (rank === 1) return 'bg-linear-to-r from-amber-100 to-amber-200 border-l-4 border-amber-400'
  if (rank === 2) return 'bg-linear-to-r from-slate-100 to-slate-200 border-l-4 border-slate-400'
  if (rank === 3) return 'bg-linear-to-r from-orange-100 to-orange-200 border-l-4 border-orange-400'
  return ''
}

/** "m:ss" of a number of seconds (0 or more). */
export function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`
}

/** Initials (first letters of the first two words) for the room player chips. */
export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => (w[0] ?? '').toUpperCase())
    .join('')
}

/** Kuiz Relay team label: team 1 is "A", team 2 is "B". */
export const teamLabel = (team: number): string => (team === 1 ? 'A' : 'B')
