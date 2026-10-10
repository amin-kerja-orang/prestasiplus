/**
 * Types of the M17 S11 "Laporan Statistik" report (SRS M17 §7 #18 `StatsReport`; M27 XR-M27-15).
 * The shape follows the SRS (`overview`, `trend`, `breakdown`, `topPupils`, `teachersNeverLogged`, `schools`,
 * `teachers`, `pupils`, `tiles`) with the school restriction of XR-M27-15: in the school scope `schools` is
 * empty and `overview.score` / `overview.structuredScore` are `null` (the platform display constant DC-M17-06
 * is never shown to a school admin, BR-M27-26).
 */

/** The S11 range pills: 7 Hari, 30 Hari (default), 3 Bulan. */
export type StatsRange = 7 | 30 | 90

export interface StatsOverview {
  /** Q-M17-PUPILS: active pupils of P (platform) or of the school. */
  pupils: number
  /** P with `lastLoginAt` not null. */
  pupilsLogged: number
  teachers: number
  teachersLogged: number
  /** Q-M17-PRACTISED: P with at least one completed session or structured attempt (all time). */
  practised: number
  /** "Jumlah Aktiviti" = Σ breakdown of the range (DV-M17-16). */
  activity: number
  /** DC-M17-06 "Skor Purata" (platform only; `null` for a school). */
  score: number | null
  /** DC-M17-06 chip "Struktur" (platform only; `null` for a school). */
  structuredScore: number | null
}

export interface StatsTrendPoint {
  /** `dd/mm` (MYT). */
  label: string
  value: number
}

export interface StatsBreakdown {
  /** "Kuiz Objektif": completed practice sessions of the range. */
  quiz: number
  /** "Soalan Berstruktur". */
  structured: number
  /** "Battle Arena". */
  battle: number
  /** "Permainan". */
  game: number
}

export interface StatsTopPupil {
  userId: number
  name: string
  /** All-time activities (sessions + structured + battles + games). */
  activities: number
}

export interface StatsNeverLoggedTeacher {
  userId: number
  name: string
  email: string
}

export type StatsSchoolStatus = 'aktif' | 'kurang' | 'tidak'

export interface StatsSchoolRow {
  schoolId: number
  name: string
  teachersLogged: number
  teachers: number
  pupilsLogged: number
  /** Every student of the school, active or not (BR-M17-03 Q-M17-SCH-PUPILS). */
  pupils: number
  sessions: number
  questions: { total: number; mcq: number; structured: number }
  subscription: 'Aktif' | 'Tiada'
  status: StatsSchoolStatus
  lastLoginAt: string | null
}

export interface StatsTeacherRow {
  userId: number
  name: string
  email: string
  schoolName: string | null
  loggedIn: boolean
  mcq: number
  structured: number
  /** M14 teacher wallet balance. */
  coins: number
  hasHeadcount: boolean
  lastLoginAt: string | null
}

export interface StatsPupilRow {
  userId: number
  name: string
  schoolName: string | null
  className: string | null
  sessions: number
  /** correct ÷ answered × 100, one decimal, never above 100 (DV-M17-19). */
  accuracy: number
  seconds: number
  /** M14 wallet `currentSyiling` (DC-M17-08 observed per-row values are not reproducible, see report). */
  coins: number
  lastLoginAt: string | null
}

export interface StatsPupilLists {
  /** Pill "Semua": every pupil of P, sessions desc, top 200. */
  semua: StatsPupilRow[]
  /** Pill "Aktif": practised pupils, sessions desc, top 200. */
  aktif: StatsPupilRow[]
  /** Pill "Login Sahaja": logged in without practice, latest login first, up to 200. */
  loginSahaja: StatsPupilRow[]
  /** Pill "Belum Login": never logged in, name A to Z, up to 200. */
  belumLogin: StatsPupilRow[]
}

export interface StatsReportTiles {
  schools: { aktif: number; kurang: number; tidak: number }
  teachers: {
    /** "Jumlah Guru". */
    total: number
    /** "Pernah Login". */
    logged: number
    /** "Jumlah Soalan": M04 Q-TEACHER-CONTRIB for the scope (platform total or the school). */
    questions: number
    /** "Jumlah Syiling": Σ teacher wallet balances over the listed teachers. */
    coins: number
  }
  pupils: {
    /** "Jumlah Murid". */
    total: number
    /** "Pernah Latihan": rows of the Aktif list. */
    practised: number
    /** "Jumlah Sesi": Σ sessions over the Aktif rows. */
    sessions: number
    /** "Purata Ketepatan": Σ correct ÷ Σ answered over the Aktif rows, one decimal. */
    accuracy: number
  }
}

export interface StatsReport {
  range: StatsRange
  /** The school of a school-scoped report, `null` on the platform. */
  schoolId: number | null
  /** Request clock, ISO +08:00. */
  generatedAt: string
  overview: StatsOverview
  trend: StatsTrendPoint[]
  breakdown: StatsBreakdown
  /** At most 10. */
  topPupils: StatsTopPupil[]
  /** At most 20, name A to Z. */
  teachersNeverLogged: StatsNeverLoggedTeacher[]
  /** Platform only; empty for a school. */
  schools: StatsSchoolRow[]
  teachers: StatsTeacherRow[]
  pupils: StatsPupilLists
  tiles: StatsReportTiles
}

export interface StatsReportOptions {
  /** Omitted / `null` / `undefined` = the platform; a number = the school restriction (XR-M27-15). */
  schoolId?: number | null
  /** Epoch ms; defaults to the project clock anchor (ADR-0006). */
  now?: number
  /**
   * School scope only (ignored for the platform): count every pupil and teacher of the school, active or
   * not (M27 BR-M27-26). Default `false` keeps the M17 behaviour (active only).
   */
  includeInactive?: boolean
}
