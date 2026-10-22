/**
 * Types of the M08 headcount endpoints (SRS M08 v1.12 §7 #12–#17, #24–#29; build-plan M08-T1b).
 * Percentages are 0–100; `null` = no value. Grades are the SPM grades of BR-M08-02.
 */

export type HeadcountMode = 'auto' | 'manual'
export type HeadcountGrade = 'A+' | 'A' | 'A-' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'E' | 'G'

/** #12 one card of S12 (the viewer's own configs, newest first). */
export interface HeadcountListItem {
  id: number
  className: string
  subjectName: string
  levelName: string
  year: number
  mode: HeadcountMode
  activeOtrs: number
  students: number
}

/** #13 one config of S13. `chart` holds the class means per OTR (labels OTR1…OTRn). */
export interface HeadcountDashboardConfig {
  id: number
  level: number
  levelName: string
  /** Additive to the contract: titles for the per-config chart cards (FR-M08-86). */
  className: string
  subjectName: string
  year: number
  onTrack: number
  offTrack: number
  noData: number
  totalStudents: number
  chart: { labels: string[]; target: (number | null)[]; actual: (number | null)[] }
}

export interface HeadcountDashboard {
  configs: HeadcountDashboardConfig[]
}

/** #14 S14 select options. */
export interface HeadcountFormOptions {
  classes: { id: number; name: string }[]
  subjects: { id: number; name: string; code: string }[]
  levels: { id: number; name: string }[]
  defaultYear: number
}

/** #15 `POST /api/headcounts`. */
export interface CreateHeadcountInput {
  /** The real API takes string ids (BE-19); mock mode sends numbers. */
  classroomId: number | string
  subjectId: number | string
  educationLevelId: number | string
  academicYear: number
  activeOtrs: number
  mode: HeadcountMode
}

/** #16 `POST /api/headcounts/auto-setup`: level ids 1–11 (D1–D6 = 1–6, T1–T5 = 7–11) or 'T1'…'T5'. */
export interface AutoSetupInput {
  levels: (number | string)[]
}

export type ProjectionVariant = 'green' | 'amber' | 'red'
export type TrendLabel = 'Meningkat' | 'Stabil' | 'Menurun'
export type ConfidenceLabel = 'Tinggi' | 'Sederhana' | 'Rendah'
export type PairStatus = 'on' | 'below' | 'none'
/** S15 table row tone (FR-M08-96). */
export type RowTone = 'on' | 'below' | 'noAr' | 'noTarget'
export type PredictionVerdict = 'Ramalan Tepat' | 'Hampir Tepat' | 'Selisih Besar'

export interface HeadcountSectionRow {
  checkpoint: number
  target: number | null
  targetGrade: HeadcountGrade | null
  ar: number | null
  arGrade: HeadcountGrade | null
  tone: RowTone
}

/** #17 one S15 section (one config that holds an entry of the pupil). */
export interface HeadcountSection {
  configId: number
  subject: string
  school: string | null
  levelName: string
  className: string
  year: number
  status: PairStatus
  tov: number | null
  etr: number | null
  rs: { value: number; recordedAt: string | null } | null
  projection: {
    value: number
    variant: ProjectionVariant
    trend: TrendLabel
    confidence: ConfidenceLabel
  } | null
  rows: HeadcountSectionRow[]
  prediction: { etr: number; rs: number; diff: number; verdict: PredictionVerdict } | null
  /**
   * Chart series over `labels` = TOV, OTR1…OTRn, ETR (+ RS when the entry has an RS): `target` and
   * `actual` per label, `projection` from the last AR point to ETR, `rs` the RS value (INFERRED shape).
   */
  chart: {
    labels: string[]
    target: (number | null)[]
    actual: (number | null)[]
    projection: (number | null)[]
    rs: number | null
  }
}

export interface HeadcountStudent {
  student: { id: number; name: string; school: string | null }
  sections: HeadcountSection[]
}

/** #24 S22 "Ringkasan Kelas". */
export interface HeadcountSummary {
  config: {
    id: number
    subject: string
    className: string
    levelName: string
    year: number
    activeOtrs: number
  }
  students: number
  avgTov: number | null
  avgEtr: number | null
  otrs: { n: number; above: number; onTrack: number; below: number; na: number }[]
}

export type CellTone = 'above' | 'on' | 'below' | 'na'

export interface HeadcountCell {
  target: number | null
  targetGrade: HeadcountGrade | null
  ar: number | null
  arGrade: HeadcountGrade | null
  tone: CellTone
}

export interface HeadcountRow {
  userId: number
  name: string
  tov: number | null
  tovGrade: HeadcountGrade | null
  cells: HeadcountCell[]
  etr: number | null
  etrGrade: HeadcountGrade | null
  dropped: boolean
}

/** #25 S23 table; `averages` are 1-decimal means over the shown (not dropped) rows. */
export interface HeadcountDetail {
  config: {
    id: number
    subject: string
    className: string
    levelName: string
    year: number
    teacherName: string
    status: 'active'
    activeOtrs: number
  }
  chips: { onTrack: number; below: number; empty: number; total: number }
  rows: HeadcountRow[]
  averages: {
    tov: number | null
    otrs: (number | null)[]
    ars: (number | null)[]
    etr: number | null
  }
}

export type DropAction = 'drop' | 'restore'

export interface DropStudentsInput {
  action: DropAction
  /** String ids on the real API (BE-19); mock mode sends numbers. */
  studentIds: (number | string)[]
}

export type HeadcountSort = 'ranking' | 'name'
