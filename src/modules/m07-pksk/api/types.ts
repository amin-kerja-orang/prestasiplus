/** M07 student API types (SRS M07 v1.7 §7 #1-#6, #21-#23). */

export type PkskLevel = 'T1' | 'T4'
export type Bahagian = 'A' | 'B' | 'C'
export type PkskGrade = 'A' | 'B' | 'C' | 'D' | 'E'

/** #1. */
export interface PkskAccess {
  T1: boolean
  T4: boolean
}

/** #2 (shipped as live, `nameEn` included). */
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

export interface PkskDomainRef {
  id: number
  code: string
  name: string
  icon: string
  color: string
}

/** #3. */
export interface PkskDashboard {
  level: PkskLevel
  readiness: { scorePct: number; grade: PkskGrade }
  examCount: number
  bahagianBAvgPct: number
  domains: (PkskDomainRef & { masteryPct: number })[]
}

/** #4. */
export interface PkskDomainSection {
  bahagian: Bahagian
  name: string
  subtitle: string
  domains: (PkskDomainRef & { questionCount: number; masteryPct: number })[]
}

/** A served question: never carries `isCorrect` (SEC-M07-07). */
export interface PkskServedQuestion {
  id: number
  questionText: string
  /** Empty for Bahagian C (essay). */
  options: { text: string }[]
}

/** #5 (provisional, L-2). */
export interface PkskPractice {
  domain: { id: number; code: string; name: string; bahagian: Bahagian }
  questions: PkskServedQuestion[]
}

/** #6 and #23. */
export interface PkskExamAttempt {
  id: number
  completedAt: string
  scorePct: number
  grade: PkskGrade
}

export interface PkskAnswer {
  questionId: number
  optionIndex?: number
  text?: string
}

/** #21 (provisional, L-2). */
export interface PkskPracticeResult {
  masteryPct: number
  sessionId: string
  gamification: {
    coinsEarned: number
    pointsEarned: number
    streakCount: number
    totalBalance: number
  }
}

/** #22 (provisional, L-3). */
export interface PkskExam {
  sections: { bahagian: Bahagian; weightPct: number; questions: PkskServedQuestion[] }[]
}
