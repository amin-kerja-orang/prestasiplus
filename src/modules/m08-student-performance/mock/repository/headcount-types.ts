/**
 * Row types of the M08-T1b stores (SRS M08 v1.12 §6.4: DATA-M08-02 HeadcountConfig and DATA-M08-03
 * HeadcountEntry). Percentages are 0–100; datetimes ISO 8601 with +08:00; dates `YYYY-MM-DD`.
 */

export type HeadcountMode = 'auto' | 'manual'

/** DATA-M08-02. Unique per class + subject + year + mode (BR-M08-22). */
export interface HeadcountConfigRow {
  id: number
  teacherId: number
  /** Always a `classroom` (school classes own no config). */
  classroomId: number
  subjectId: number
  /** 1–11 (M03 level id): the S14 form allows 10 and 11, Auto-Setup every level. */
  educationLevelId: number
  academicYear: number
  /** 2–5. */
  activeOtrs: number
  mode: HeadcountMode
  status: 'active'
  createdAt: string
  updatedAt: string
}

export type TrendLabel = 'Meningkat' | 'Stabil' | 'Menurun'
export type ConfidenceLabel = 'Tinggi' | 'Sederhana' | 'Rendah'

/** DATA-M08-03. `targets` and `actuals` hold `activeOtrs` slots (null = none / not keyed). */
export interface HeadcountEntryRow {
  id: number
  configId: number
  studentId: number
  tov: number | null
  targets: (number | null)[]
  actuals: (number | null)[]
  etr: number | null
  rs: number | null
  rsRecordedAt: string | null
  dropped: boolean
  /** The observed chips of the class-516 anchors (BR-M08-24); absent = computed. */
  trendOverride?: TrendLabel
  confidenceOverride?: ConfidenceLabel
}
