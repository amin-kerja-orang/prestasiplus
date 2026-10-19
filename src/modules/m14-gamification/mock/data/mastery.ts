/**
 * Subject-mastery stages shown by M14 (S11 "Tahap Penguasaan Subjek", S18 "Kad Penguasaan Subjek";
 * SRS M14 §6.1 "SubjectMastery", FN-M14-2.1.8 / 6.2.4, BR-M14-12 note).
 *
 * The thresholds and labels are the M05 BR-20 scale (M05 §6.10 "Mastery levels"; L4+ are INFERRED
 * placeholders there too). M05 does not export them on its mock entry (`@/modules/m05-practice/mock`
 * carries the `practice.mastery` counters only), and module boundaries forbid reaching into M05's
 * handlers, so M14 keeps this read-only copy. SRS gap reported with the build: M05 should export
 * `masteryLevel` / `MASTERY_*` from its mock entry so the two never diverge.
 */

/** Correct answers needed for L0…L10. */
export const MASTERY_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100, 1500] as const

/** Stage label of L0…L10. */
export const MASTERY_LABELS = [
  'Pemula',
  'Mula Belajar',
  'Aktif',
  'Tekun',
  'Mahir',
  'Pakar Muda',
  'Cemerlang',
  'Master',
  'Grandmaster',
  'Legend',
  'Mythical',
] as const

/** The level reached with `correct` correct answers. */
export function masteryLevel(correct: number): number {
  let level = 0
  for (const [i, t] of MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

/** M05 BR-20: x{1 + 0.05 × (L − 1)} from L2; 1 below (shown only when above 1). */
export function masteryMultiplier(level: number): number {
  return level >= 2 ? Math.round((1 + 0.05 * (level - 1)) * 100) / 100 : 1
}

/** Correct answers of the next level, or null at the top level. */
export function masteryNextTarget(level: number): number | null {
  return level >= MASTERY_THRESHOLDS.length - 1 ? null : (MASTERY_THRESHOLDS[level + 1] as number)
}
