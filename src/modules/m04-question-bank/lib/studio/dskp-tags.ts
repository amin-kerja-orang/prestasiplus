/**
 * DSKP tags of a Studio question (ADR-0031, R1-F03b): the unit and 1 to 3 SP are chosen once for the question, TP and the
 * cognitive level for every LEAF part. Pure helpers: how complete the tags are, and the question TP that follows from them.
 */
export const MAX_SP = 3
export const TP_VALUES = [1, 2, 3, 4, 5, 6] as const

/**
 * "Aras pemikiran" of a leaf: the six levels of Taksonomi Bloom (ADR-0031, T33 `cognitiveLevel`). The four upper levels are
 * KBAT. The Studio also sends `kbat` (the four levels, else `bukan`) so a server without the six-level column still keeps it.
 */
export const COGNITIVE_OPTIONS = [
  { value: 'mengingat', label: 'Mengingat', kbat: false },
  { value: 'memahami', label: 'Memahami', kbat: false },
  { value: 'mengaplikasi', label: 'Mengaplikasi', kbat: true },
  { value: 'menganalisis', label: 'Menganalisis', kbat: true },
  { value: 'menilai', label: 'Menilai', kbat: true },
  { value: 'mencipta', label: 'Mencipta', kbat: true },
] as const

export type CognitiveValue = (typeof COGNITIVE_OPTIONS)[number]['value']

export const isCognitive = (v: unknown): v is CognitiveValue => COGNITIVE_OPTIONS.some((c) => c.value === v)
/** True for the four KBAT levels (Mengaplikasi, Menganalisis, Menilai, Mencipta). */
export const isKbat = (v: CognitiveValue | null): boolean => v !== null && COGNITIVE_OPTIONS.some((c) => c.value === v && c.kbat)

export interface LeafTag {
  label: string
  tp: number | null
  cognitive: CognitiveValue | null
}

export interface QuestionDskp {
  unitId: string | null
  spIds: readonly string[]
  leaves: readonly LeafTag[]
}

/** Gaps in the order the author fixes them: `Belum ditanda DSKP` when any is present. */
export function dskpGaps(d: QuestionDskp): string[] {
  const gaps: string[] = []
  if (d.unitId === null || d.unitId === '') gaps.push('Soalan belum dipautkan kepada topik DSKP.')
  if (d.spIds.length < 1) gaps.push('Sila pilih sekurang-kurangnya satu SP DSKP.')
  for (const leaf of d.leaves) {
    if (leaf.tp === null) gaps.push(`Bahagian (${leaf.label}) belum ada TP.`)
    if (leaf.cognitive === null) gaps.push(`Bahagian (${leaf.label}) belum ada aras pemikiran.`)
  }
  return gaps
}

export const isDskpComplete = (d: QuestionDskp): boolean => dskpGaps(d).length === 0

/** AC-03.6: the question TP is the highest leaf TP; null until a leaf has one. */
export function questionTp(leaves: readonly Pick<LeafTag, 'tp'>[]): number | null {
  const tps = leaves.flatMap((l) => (l.tp === null ? [] : [l.tp]))
  return tps.length === 0 ? null : Math.max(...tps)
}

/** Adds or removes an SP, keeping at most three; returns the same list when nothing can change. */
export function toggleSp(spIds: readonly string[], id: string): string[] {
  if (spIds.includes(id)) return spIds.filter((s) => s !== id)
  return spIds.length >= MAX_SP ? [...spIds] : [...spIds, id]
}
