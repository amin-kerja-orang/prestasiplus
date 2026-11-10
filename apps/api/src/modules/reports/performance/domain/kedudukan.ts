import type { KedudukanCandidate } from '../ports/kedudukan.port'
import { firstNameOf } from './ranking'

/** The order chain of 48 GAME-16 for the "Semua Masa" basis: syiling desc, accuracy desc, longest streak desc, name asc, id asc. */
export function compareCandidates(a: KedudukanCandidate, b: KedudukanCandidate): number {
  if (a.syiling !== b.syiling) return b.syiling - a.syiling
  // Accuracy compared unrounded by cross-multiplication; a pupil with no answers ranks last.
  if (a.answered === 0 || b.answered === 0) {
    if (a.answered !== b.answered) return a.answered === 0 ? 1 : -1
  } else {
    const left = a.correct * b.answered
    const right = b.correct * a.answered
    if (left !== right) return right - left
  }
  if (a.bestStreak !== b.bestStreak) return b.bestStreak - a.bestStreak
  const an = firstNameOf(a.name).toLowerCase()
  const bn = firstNameOf(b.name).toLowerCase()
  if (an !== bn) return an < bn ? -1 : 1
  const full = a.name.toLowerCase()
  const fullB = b.name.toLowerCase()
  if (full !== fullB) return full < fullB ? -1 : 1
  const ai = BigInt(a.userId)
  const bi = BigInt(b.userId)
  return ai < bi ? -1 : ai > bi ? 1 : 0
}

/** "Kumpulan {p}% teratas": round half up of rank / total x 100, never below 1 (V2 `max(1, ...)`). */
export function percentileOf(rank: number, total: number): number {
  if (total <= 0) return 100
  return Math.max(1, Math.floor((200 * rank + total) / (2 * total)))
}
