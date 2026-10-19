/**
 * Student Audio KBAT constants and helpers (SRS M09 FR-M09-72..75, BR-M09-16; S21 and the
 * provisional player, L-3).
 */

import type { AudioAttemptRequest, AudioSetDetail } from '../api/types'

export const AUDIO_KBAT_PATH = '/audio-kbat'
export const AUDIO_KBAT_ROUTES = {
  list: 'm09-audio-kbat',
  player: 'm09-audio-kbat-player',
} as const

export const CHOICES = ['A', 'B', 'C', 'D'] as const
export type Choice = (typeof CHOICES)[number]

/** FN-M09-5.3.2 / 5.3.4: exact live copy. */
export const LIST_COPY = {
  pill: 'Ujian Mendengar',
  title: 'Audio KBAT',
  intro:
    'Dengar audio mengikut bahagian dan jawab soalan yang dipaparkan serentak. Set ini tidak dirawak supaya audio kekal selari dengan nombor soalan.',
  empty: 'Belum ada set Audio KBAT yang approved.',
} as const

/** Provisional player copy (L-3). "Hantar" is PROPOSED COPY (OQ-M09-11); the rest is UNVERIFIED COPY. */
export const PLAYER_COPY = {
  back: 'Kembali',
  submit: 'Hantar',
  sectionPrefix: 'Bahagian',
  questionPrefix: 'Soalan',
  noAudio: 'Audio tidak tersedia.',
  resultTitle: 'Skor anda',
} as const

/** Positive integer from a query value, else `undefined` (an unknown value filters nothing). */
export function queryId(value: unknown): number | undefined {
  const first: unknown = Array.isArray(value) ? (value as unknown[])[0] : value
  if (typeof first !== 'string' || !/^\d+$/.test(first)) return undefined
  const n = Number(first)
  return n > 0 ? n : undefined
}

export function queryString(value: unknown): string {
  const first: unknown = Array.isArray(value) ? (value as unknown[])[0] : value
  return typeof first === 'string' ? first : ''
}

/** Subjects A–Z by name (FN-M09-5.3.3), a copy. */
export function sortByName<T extends { name: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, 'ms'))
}

/** "Soalan a-b" range of a section from its questions. */
export function sectionRange(questions: readonly { no: number }[]): string {
  if (questions.length === 0) return ''
  const nos = questions.map((q) => q.no)
  return `${String(Math.min(...nos))}-${String(Math.max(...nos))}`
}

/** The request body: answered questions only, in question order. */
export function attemptBody(
  answers: Readonly<Record<number, Choice | undefined>>,
): AudioAttemptRequest {
  const list: AudioAttemptRequest['answers'] = []
  for (const [key, choice] of Object.entries(answers)) {
    if (choice !== undefined) list.push({ no: Number(key), choice })
  }
  list.sort((a, b) => a.no - b.no)
  return { answers: list }
}

export function totalQuestions(set: AudioSetDetail): number {
  return set.sections.reduce((n, s) => n + s.questions.length, 0)
}
