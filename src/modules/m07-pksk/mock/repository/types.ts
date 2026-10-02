/** Row types of the M07 stores (SRS M07 v1.7 §6). */

export type Bahagian = 'A' | 'B' | 'C'
export type PkskLevel = 'T1' | 'T4'
export type PackageLevel = PkskLevel | 'ALL'
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E'

/** DATA-M07-01. */
export interface PkskDomain {
  id: number
  bahagian: Bahagian
  name: string
  nameEn: string
  code: string
  icon: string
  color: string
  order: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

/** DATA-M07-03 (owner M19, provisional here). */
export interface PkskPackage {
  id: number
  name: string
  level: PackageLevel
}

/** DATA-M07-04. `expiresAt` is a `YYYY-MM-DD` date. */
export interface PkskAccessRow {
  id: number
  userId: number
  packageId: number
  grantedById: number | null
  grantedAt: string
  expiresAt: string | null
  status: 'active' | 'revoked'
  revokedAt: string | null
}

/** DATA-M07-05 (only completed attempts are stored). */
export interface PkskExamAttemptRow {
  id: number
  userId: number
  level: PkskLevel
  completedAt: string
  scorePct: number
  bahagianAPct: number
  bahagianBPct: number
  bahagianCPct: number
  grade: Grade
}

/** DATA-M07-06; absent = 0. */
export interface PkskMasteryRow {
  id: number
  userId: number
  level: PkskLevel
  domainId: number
  masteryPct: number
}

/** When a user opened a practice page (#5); `timeSpent` of the session (BR-M07-26 (1), PROPOSED). */
export interface PkskPracticeLoadRow {
  id: number
  userId: number
  level: PkskLevel
  domainId: number
  loadedAtMs: number
}
