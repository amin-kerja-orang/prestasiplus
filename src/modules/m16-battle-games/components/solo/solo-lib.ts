/**
 * Pure rules and copy of the single-player games (SRS M16 v1.6 BR-M16-26, URS FT-M16-6.x / 7.x). No Vue
 * and no I/O, so the scoring is unit-tested without mounting a page.
 */

/** Darjah choices the picker offers (DV-M16-19: the list stays 1-4, `?darjah=5…11` also works). */
export const PICKER_DARJAH = [1, 2, 3, 4] as const

/** `?darjah=` accepted by the games: an integer 1-11, else `null` (the picker shows). */
export function parseDarjah(raw: unknown): number | null {
  const v = Array.isArray(raw) ? raw[0] : raw
  if (typeof v !== 'string' || !/^\d{1,2}$/.test(v)) return null
  const n = Number(v)
  return n >= 1 && n <= 11 ? n : null
}

/** Syiling counted for one answer, before the M14 setting decides what is credited (DV-M16-23). */
export interface Gain {
  points: number
  coins: number
}

/** Betul atau Salah: `streak` is the streak after the correct answer. */
export function betulSalahGain(streak: number): Gain {
  return { points: 10 + Math.min(streak, 10) * 2, coins: Math.min(streak, 5) }
}

/** Cabaran Kilat: `combo` is the combo after the correct answer. */
export function cabaranGain(combo: number): Gain {
  const mult = Math.min(combo, 10)
  return { points: 10 * mult, coins: mult }
}

/** Tembak Jawapan: a correct tap at `level`. */
export function tembakGain(level: number): Gain {
  return { points: 10 * level, coins: level }
}

/** Susun Jawapan: a solved puzzle worth `points`. */
export function susunGain(points: number): Gain {
  return { points, coins: Math.ceil(points / 3) }
}

/** Tembak Jawapan: level 1 and +1 every 5 correct answers. */
export function tembakLevel(correct: number): number {
  return 1 + Math.floor(correct / 5)
}

export interface ResultTitle {
  emoji: string
  text: string
}

/** The result titles of URS FN-M16-6.2.3 / 6.3.3 / 6.4.3 / 6.5.4 (the whole string is one text node). */
export function betulSalahTitle(score: number): string {
  if (score >= 300) return '🏆 LEGENDA!'
  if (score >= 150) return '🔥 LUAR BIASA!'
  if (score >= 80) return '✅ HEBAT!'
  return '💪 TERUSKAN!'
}

export function cabaranKilatTitle(score: number): string {
  if (score >= 500) return '🏆 LEGENDA!'
  if (score >= 300) return '🔥 LUAR BIASA!'
  if (score >= 150) return '⚡ PANTAS!'
  return '💪 TERUSKAN!'
}

export function tembakTitle(score: number): string {
  if (score >= 500) return '🏆 PENEMBAK TEPAT!'
  if (score >= 200) return '🎯 TAJAM!'
  if (score >= 80) return '💪 BAGUS!'
  return '🔄 CUBA LAGI!'
}

export function susunTitle(solved: number, total: number): string {
  const ratio = total > 0 ? solved / total : 0
  if (ratio >= 0.9) return '🏆 GENIUS!'
  if (ratio >= 0.6) return '🧩 BIJAK!'
  if (ratio >= 0.3) return '💪 BAGUS!'
  return '📚 TERUSKAN!'
}

/** Cabaran Kilat difficulty chip: ≤ 2 "Mudah" (green), 3 "Sederhana" (amber), else "Sukar" (red). */
export function difficultyChip(difficulty: number): {
  label: string
  tone: 'green' | 'amber' | 'red'
} {
  if (difficulty <= 2) return { label: 'Mudah', tone: 'green' }
  if (difficulty === 3) return { label: 'Sederhana', tone: 'amber' }
  return { label: 'Sukar', tone: 'red' }
}

/** Tembak Jawapan: the base fall time of a tile (seconds). */
export function fallBaseSeconds(level: number): number {
  return Math.max(5, 15 - (level - 1) * 0.7)
}

/** Deterministic 0-1 jitter of a tile (the live page uses `Math.random()`; the rebuild is reproducible). */
export function tileJitter(questionId: number, optionIndex: number): number {
  const h = Math.imul(questionId + 1, 2654435761) ^ Math.imul(optionIndex + 7, 40503)
  return ((h >>> 0) % 1000) / 1000
}

/** Fall time of one tile: the base plus 0-2 s. */
export function tileFallSeconds(level: number, questionId: number, optionIndex: number): number {
  return fallBaseSeconds(level) + tileJitter(questionId, optionIndex) * 2
}

/** Tiles of one question start 1.8 s apart. */
export const TILE_GAP_MS = 1800

/** A question with no correct tap by this time costs a life: `base + 6 + options × 2` seconds. */
export function missDeadlineSeconds(level: number, optionCount: number): number {
  return fallBaseSeconds(level) + 6 + optionCount * 2
}

/** Fall progress 0-1 of a tile that started `startMs` ago and takes `fallSeconds`. */
export function fallProgress(elapsedMs: number, startMs: number, fallSeconds: number): number {
  if (elapsedMs <= startMs) return 0
  return Math.min(1, (elapsedMs - startMs) / (fallSeconds * 1000))
}

/** Horizontal lane (0-3) of an option, rotated by the question so the correct tile moves around. */
export function laneOf(questionId: number, optionIndex: number, lanes = 4): number {
  return (optionIndex + questionId) % lanes
}

/** Susun Jawapan: the typed answer of the placed tiles is compared trimmed and case-insensitive. */
export function susunMatches(tiles: string[], type: 'letters' | 'words', answer: string): boolean {
  const built = tiles.join(type === 'words' ? ' ' : '')
  return built.trim().toLowerCase() === answer.trim().toLowerCase()
}

/** `m:ss` of the Kad Memori clock and result tile. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${String(Math.floor(s / 60))}:${String(s % 60).padStart(2, '0')}`
}

/** `{betul}/{jawab}` of the "Ketepatan" tile. */
export function ratio(correct: number, answered: number): string {
  return `${String(correct)}/${String(answered)}`
}

// --- Roda Nasib ------------------------------------------------------------------------------------------

export const WHEEL_SEGMENTS = 8
export const WHEEL_SPIN_MS = 4200

/** Segment `i` is drawn from `i × 45`° clockwise from 3 o'clock (as live), so its centre is at `i × 45 + 22.5`°. */
export function wheelSegmentCenterDeg(segmentIndex: number): number {
  return segmentIndex * 45 + 22.5
}

/** The pointer is at 12 o'clock = 270° clockwise from 3 o'clock. */
export const WHEEL_POINTER_DEG = 270

/**
 * The landing rotation: the SRS `360 − (segment_index × 45 + 22.5)` (BR-M16-29) plus a constant −90°
 * for the live drawing that starts at 3 o'clock, so the segment centre lands under the 12 o'clock pointer.
 */
export function wheelLandingDeg(segmentIndex: number): number {
  return (((360 - (segmentIndex * 45 + 22.5) - 90) % 360) + 360) % 360
}

/** Whole turns of a spin (5-8, deterministic per segment). */
export function wheelTurns(segmentIndex: number): number {
  return 5 + (segmentIndex % 4)
}

/** The next absolute rotation so that the wheel makes `turns` turns and ends on the landing angle. */
export function nextWheelRotation(current: number, segmentIndex: number): number {
  const land = wheelLandingDeg(segmentIndex)
  const mod = ((current % 360) + 360) % 360
  const delta = (land - mod + 360) % 360
  return current + wheelTurns(segmentIndex) * 360 + delta
}

// --- Jutawan Ilmu ------------------------------------------------------------------------------------------

export const JUTAWAN_LEVELS = 15

/** "(DARJAH n)" / "(TINGKATAN n−6)" heading, used when the server did not send one. */
export function jutawanHeading(darjah: number): string {
  return darjah <= 6 ? `DARJAH ${String(darjah)}` : `TINGKATAN ${String(darjah - 6)}`
}

/** `1077` shown as the live page prints it: plain digits followed by "soalan". */
export function questionCountLabel(count: number): string {
  return `${String(count)} soalan`
}

/** Option letters A-D. */
export const OPTION_LETTERS = ['A', 'B', 'C', 'D'] as const
