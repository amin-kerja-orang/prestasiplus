/** Pure M06 rules (SRS M06 v1.4 §4 BR-M06-08, -24, §6.12). No store access. */

import type { HeroClass, MockGrade, SetStatus } from '../../api/types'
import { GRADE_BANDS } from '../data/config'

/** BR-M06-08. */
export function setStatus(readyCount: number, bankSource: number | null, size: number): SetStatus {
  if (readyCount < size) return 'belum_cukup'
  if (bankSource !== null && bankSource > size) return 'bank_besar'
  return 'bersih'
}

export const isStartable = (s: SetStatus): boolean => s !== 'belum_cukup'

/** BR-M06-24 (INFERRED bands). */
export function gradeOf(percent: number): MockGrade {
  for (const [floor, grade] of GRADE_BANDS) if (percent >= floor) return grade as MockGrade
  return 'G'
}

export function heroClassOf(grade: MockGrade): HeroClass {
  if (grade === 'G') return 'bad'
  if (grade === 'C' || grade === 'D' || grade === 'E') return 'mid'
  return 'good'
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** §6.12 Paper 2 marker (D4): 0 for an empty answer, else round(max x min(1, words / 60)). */
export function markPaper2(answer: string | null, maxMarks: number): number {
  const words = (answer ?? '').trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.round(maxMarks * Math.min(1, words / 60))
}

export const paper2Feedback = (marks: number, max: number): string =>
  `Jawapan anda merangkumi ${String(marks)} daripada ${String(max)} markah. Rujuk skema.`

export const LETTERS = ['A', 'B', 'C', 'D'] as const

/** BR-M06-24 weak topics: wrong items (mark < max) per topic, count desc then name. */
export function weakTopicsOf(
  items: readonly { topic: string; marks: number | null; maxMarks: number }[],
): { topic: string; wrongCount: number }[] {
  const by = new Map<string, number>()
  for (const it of items) {
    if ((it.marks ?? 0) < it.maxMarks) by.set(it.topic, (by.get(it.topic) ?? 0) + 1)
  }
  return [...by.entries()]
    .map(([topic, wrongCount]) => ({ topic, wrongCount }))
    .sort((a, b) => b.wrongCount - a.wrongCount || a.topic.localeCompare(b.topic, 'ms'))
}
