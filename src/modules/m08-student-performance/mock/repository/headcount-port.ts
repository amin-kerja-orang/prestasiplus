/**
 * The headcount read port (SRS M08 v1.11 §6.4, BR-M08-01/07/08). HeadcountConfig and HeadcountEntry are
 * owned by M08-T1b (`headcount*` files), which runs after this task. The S1 / S3 / S6 / S9 figures that
 * depend on headcount entries are computed here through this port, so they switch on the day T1b
 * registers its reader (`registerHeadcountReads`, called from the T1b seed). Until then the port is empty:
 * GPS "—", no On Track / Below pairs, no at-risk rows (documented in the T1 report).
 */

/** One student × config pair (a HeadcountEntry with its config's class, subject and level). */
export interface HeadcountEntryView {
  configId: number
  studentId: number
  classroomKind: 'classroom' | 'school_class'
  classroomId: number
  subjectId: number
  /** 10 = Tingkatan 4, 11 = Tingkatan 5 (BR-M08-22). */
  levelId: number
  /** Config `updatedAt` (ISO). */
  configUpdatedAt: string
  academicYear: number
  activeOtrs: number
  tov: number | null
  /** OTR targets by checkpoint 1…activeOtrs (null = none). */
  targets: readonly (number | null)[]
  /** Actual results (AR) by checkpoint (null = not keyed). */
  actuals: readonly (number | null)[]
  etr: number | null
  rs: number | null
  dropped: boolean
}

export interface HeadcountReads {
  /** Every entry (744 graded platform-wide plus the ungraded ones). */
  entries(): readonly HeadcountEntryView[]
}

const EMPTY: HeadcountReads = { entries: () => [] }

let reader: HeadcountReads = EMPTY
/** Bumped whenever the reader is replaced (a data stamp of the S1 memo). */
let readerGeneration = 0
export const headcountReaderGeneration = (): number => readerGeneration

/**
 * Called by M08-T1b: replaces the reader. The T1 seed does NOT reset it, so a T1b registration is never
 * wiped; T1b registers from its own seed (which runs on every boot and `mock.reset()`), and reads happen
 * at request time only. `resetHeadcountReads` is for tests.
 */
export function registerHeadcountReads(next: HeadcountReads): void {
  reader = next
  readerGeneration++
}

/** Test helper and seed reset: back to the empty reader. */
export function resetHeadcountReads(): void {
  reader = EMPTY
  readerGeneration++
}

export const headcountReads: HeadcountReads = {
  entries: () => reader.entries(),
}

// ---------------------------------------------------------------------------------------------
// Rules over one entry (BR-M08-01, BR-M08-07, BR-M08-08)
// ---------------------------------------------------------------------------------------------

export interface LatestAr {
  /** 1-based checkpoint. */
  n: number
  ar: number
  target: number | null
}

/** The latest checkpoint that has an AR (BR-M08-01 "latest AR"). */
export function latestAr(e: HeadcountEntryView): LatestAr | null {
  for (let i = e.actuals.length - 1; i >= 0; i--) {
    const ar = e.actuals[i]
    if (ar !== null && ar !== undefined) return { n: i + 1, ar, target: e.targets[i] ?? null }
  }
  return null
}

/** BR-M08-01: an entry is graded when it has an AR. */
export const isGraded = (e: HeadcountEntryView): boolean => latestAr(e) !== null

/** BR-M08-07: On Track when the latest AR ≥ its target, otherwise Below (no target or AR counts as Below). */
export function pairIsOn(e: HeadcountEntryView): boolean {
  const l = latestAr(e)
  return l !== null && l.target !== null && l.ar >= l.target
}

/** BR-M08-08 rule (1) with the "no data" bucket (S6 pills, S15, S13). */
export function pairStatus(e: HeadcountEntryView): 'on' | 'below' | 'none' {
  const l = latestAr(e)
  if (l === null || l.target === null) return 'none'
  return l.ar >= l.target ? 'on' : 'below'
}

/** BR-M08-08 rule (2): the ±2 % band (Above > OTR; On Track OTR − 2…OTR; Below < OTR − 2). */
export function bandStatus(
  ar: number | null,
  target: number | null,
): 'above' | 'on' | 'below' | 'na' {
  if (ar === null || target === null) return 'na'
  if (ar > target) return 'above'
  if (ar >= target - 2) return 'on'
  return 'below'
}
