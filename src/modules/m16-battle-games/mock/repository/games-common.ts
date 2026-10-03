/**
 * Shared pieces of the M16 game repositories (rooms, solo games, spins, Jutawan; SRS M16 v1.6 BR-M16-18,
 * BR-M16-25, BR-M16-28): grade enums, the M14 report (`onGameResult` once per result) and its tier rates,
 * deterministic ids drawn from named streams, and the keyless question views.
 */

import { formatDateKey } from '@/lib/time'
import type { Prng, PrngRegistry } from '@/mock/determinism'
import { gamification, tiers, wallet } from '@/modules/m14-gamification/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { m16Now } from './common'

// --- grades (BR-M16-02) -----------------------------------------------------------------------------

/** `DARJAH_4` / `TINGKATAN_2` → grade 4 / 8; anything else → null. */
export function gradeOfEnum(value: unknown): number | null {
  if (typeof value !== 'string') return null
  const m = /^(DARJAH|TINGKATAN)_(\d)$/.exec(value)
  if (!m) return null
  const n = Number(m[2])
  if (m[1] === 'DARJAH') return n >= 1 && n <= 6 ? n : null
  return n >= 1 && n <= 5 ? n + 6 : null
}

/** Grade 1–11 → `DARJAH_n` / `TINGKATAN_n`; null for no grade. */
export function enumOfGrade(grade: number | null | undefined): string | null {
  if (grade === null || grade === undefined) return null
  if (grade >= 1 && grade <= 6) return `DARJAH_${String(grade)}`
  if (grade >= 7 && grade <= 11) return `TINGKATAN_${String(grade - 6)}`
  return null
}

export const isPrimary = (grade: number): boolean => grade <= 6

// --- ids from streams -----------------------------------------------------------------------------------

const HEX = '0123456789abcdef'
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/** 13 hex characters (session ids, BR-M16-25). */
export function hex13(rng: Prng): string {
  let out = ''
  for (let i = 0; i < 13; i++) out += HEX[Math.floor(rng.next() * 16)] ?? '0'
  return out
}

/** 6 characters from [A-Z0-9] (room codes, BR-M16-18). */
export function roomCodeFrom(rng: Prng): string {
  let out = ''
  for (let i = 0; i < 6; i++) out += ALNUM[Math.floor(rng.next() * ALNUM.length)] ?? 'A'
  return out
}

/** A free id from the stream `<stream>:<n>:<attempt>`, `n` = how many ids are already used. */
export function drawFreeId(
  prng: PrngRegistry,
  stream: string,
  used: number,
  make: (rng: Prng) => string,
  taken: (id: string) => boolean,
): string {
  for (let attempt = 0; attempt < 10_000; attempt++) {
    const id = make(prng.fresh(`${stream}:${String(used)}:${String(attempt)}`))
    if (!taken(id)) return id
  }
  throw new Error(`M16: no free id from stream ${stream}`)
}

// --- time ------------------------------------------------------------------------------------------------

/** MYT calendar day `YYYY-MM-DD` of the mock clock. */
export const todayMyt = (): string => formatDateKey(m16Now())

// --- M14 (BR-M16-28) ---------------------------------------------------------------------------------------

/** M14 `canEarnSyiling` (the setting ∧ the user's `coinsEnabled`). */
export const canEarn = (userId: number): boolean => gamification.canEarnSyiling(userId)

/** The Papan Bijak rates of the user's tier (`board_game_reward_correct`, `board_game_reward_win`). */
export function boardRates(userId: number): { correct: number; win: number } {
  const key = wallet.get(userId)?.tierKey
  const tier = tiers.list().find((t) => t.tierName === key)
  return { correct: tier?.boardGameRewardCorrect ?? 0, win: tier?.boardGameRewardWin ?? 0 }
}

export interface GameReport {
  game: string
  event: string
  coins: number
  correct?: number
  total?: number
  detail?: Record<string, unknown>
}

/** Calls M14 `onGameResult` once (xp 0, BR-M16-28) and returns the syiling actually credited. */
export function reportGame(userId: number, r: GameReport): number {
  const out = gamification.onGameResult(userId, {
    game: r.game,
    event: r.event,
    coins: r.coins,
    xp: 0,
    ...(r.correct === undefined ? {} : { correct: r.correct }),
    ...(r.total === undefined ? {} : { total: r.total }),
    ...(r.detail === undefined ? {} : { detail: r.detail }),
  })
  return out.coinsCredited
}

// --- questions (keyless views, BR-M16-25) -----------------------------------------------------------------

const LABELS = ['A', 'B', 'C', 'D'] as const

export interface KeylessView {
  id: number
  text: string
  options: { id: number; label: string; text: string }[]
}

/** A question as a room serves it: text and options, no key. */
export function keylessView(id: number): KeylessView | null {
  const q = questions.get(id)
  if (!q) return null
  const texts = q.pkskOptions ? q.pkskOptions.map((o) => o.text) : (q.options ?? [])
  return {
    id,
    text: q.questionText,
    options: texts.slice(0, 4).map((text, i) => ({ id: i, label: LABELS[i] ?? '', text })),
  }
}

/** The key of an MCQ as `{index, text}`, or null for a row without a key. */
export function keyOf(id: number): { index: number; text: string } | null {
  const q = questions.get(id)
  if (!q) return null
  if (q.pkskOptions) {
    const i = q.pkskOptions.findIndex((o) => o.isCorrect)
    return i < 0 ? null : { index: i, text: q.pkskOptions[i]?.text ?? '' }
  }
  if (q.options === null || q.correctAnswer === null) return null
  return { index: q.correctAnswer, text: q.options[q.correctAnswer] ?? '' }
}
