/**
 * Layer 1 of the six launch blueprints (bijak-spm, BJS-12; architecture section 8): structure and difficulty
 * profile, encoded from the 2025 trial-paper study (`docs/discovery/SPM-paper-patterns.md`, "SPP", sections 4,
 * 10.2 and 8). Format and numbers only; no question text, no person names.
 *
 * Values mirror observation: marks, rules, question counts and durations are printed on the papers (SPP 4,
 * 10.2). The TP bands are [Default] proposals from SPP 5.1 and the S-to-TP relation of SPP 3.2, so they are
 * tagged "inferred" in the blueprint notes and must be re-measured. The Fizik Bahagian C rule ("all") is
 * inferred (SPP 4); the unread items stay unread. Nothing here is tuned to make a total agree.
 *
 * Layer 2 (unit quotas, KBAT marks, marks bands) lives in `docs/reference/blueprints/<code>.json` and is
 * merged by `exam-launch-blueprints.ts`; this file has no quota and no KBAT value.
 */
import type { ProfileKind, SectionRule } from '@pp/exam-core'

export interface Layer1Group {
  from: number
  to: number
  tpMin: number
  tpMax: number
  marksMin?: number
  marksMax?: number
}

export interface Layer1Section {
  label: string
  rule: SectionRule
  /** Slots (offered questions). */
  questionCount: number
  /** Effective marks after choose-N. */
  markBudget: number
  allowedModes: readonly string[]
  kind: ProfileKind
  groups: readonly Layer1Group[]
}

export interface Layer1Blueprint {
  /** Printed paper code, e.g. `3472/2`. */
  code: string
  /** Curriculum subject code (`subjects.code`): MATH, ADDMATH, PHY, SEJ. */
  subject: string
  kertas: number
  durationMin: number
  subPartRamp: boolean
  /** SPP section 8: High where two bodies agree, Medium for a single body. */
  confidence: 'high' | 'medium'
  /** Bodies read, for the notes ("sbp", "selangor_mpsm"). */
  bodies: readonly string[]
  /** Blueprint notes: provenance of the layer-1 values. */
  notes: string
  sections: readonly Layer1Section[]
}

const g = (from: number, to: number, tpMin: number, tpMax: number, marksMin?: number, marksMax?: number): Layer1Group => ({
  from,
  to,
  tpMin,
  tpMax,
  ...(marksMin !== undefined ? { marksMin } : {}),
  ...(marksMax !== undefined ? { marksMax } : {}),
})
const all: SectionRule = { type: 'all' }
const choose = (n: number): SectionRule => ({ type: 'choose', n })

const TP_NOTE = 'Jalur TP ialah cadangan (inferred) daripada kajian kertas percubaan 2025 dan perlu diukur semula.'

export const LAYER1: readonly Layer1Blueprint[] = [
  {
    code: '1449/1', subject: 'MATH', kertas: 1, durationMin: 90, subPartRamp: false, confidence: 'high', bodies: ['sbp', 'selangor_mpsm'],
    notes: `Struktur dan markah (observed): 40 soalan aneka pilihan, jawab semua, 1 markah setiap satu, 90 minit; SBP dan Selangor sepakat. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 40, markBudget: 40, allowedModes: ['mcq'], kind: 'ladder', groups: [g(1, 10, 2, 4), g(11, 20, 2, 4), g(21, 30, 3, 5), g(31, 40, 3, 5)] },
    ],
  },
  {
    code: '1449/2', subject: 'MATH', kertas: 2, durationMin: 150, subPartRamp: false, confidence: 'high', bodies: ['sbp', 'selangor_mpsm'],
    notes: `Struktur dan markah (observed): A 10 soalan 40 markah semua; B 5 soalan 45 markah semua; C 2 soalan 15 markah setiap satu, jawab satu (30 ditawarkan); 150 minit; SBP dan Selangor sepakat. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 10, markBudget: 40, allowedModes: [], kind: 'bahagian', groups: [g(1, 10, 2, 4, 3, 5)] },
      { label: 'Bahagian B', rule: all, questionCount: 5, markBudget: 45, allowedModes: [], kind: 'bahagian', groups: [g(1, 5, 3, 5, 8, 10)] },
      { label: 'Bahagian C', rule: choose(1), questionCount: 2, markBudget: 15, allowedModes: [], kind: 'bahagian', groups: [g(1, 2, 3, 6, 15, 15)] },
    ],
  },
  {
    code: '3472/1', subject: 'ADDMATH', kertas: 1, durationMin: 120, subPartRamp: false, confidence: 'medium', bodies: ['sbp'],
    notes: `Struktur dan markah (observed, satu badan sahaja: SBP): A 12 soalan 64 markah semua; B 3 soalan 8 markah setiap satu, jawab dua (24 ditawarkan); 120 minit; skema mengesahkan jumlah. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 12, markBudget: 64, allowedModes: [], kind: 'bahagian', groups: [g(1, 12, 3, 5)] },
      { label: 'Bahagian B', rule: choose(2), questionCount: 3, markBudget: 16, allowedModes: [], kind: 'bahagian', groups: [g(1, 3, 4, 6, 8, 8)] },
    ],
  },
  {
    code: '3472/2', subject: 'ADDMATH', kertas: 2, durationMin: 150, subPartRamp: false, confidence: 'high', bodies: ['sbp', 'selangor_mpsm'],
    notes: `Struktur dan markah (observed): A 7 soalan 50 markah semua; B 4 soalan 10 markah setiap satu, jawab tiga (40 ditawarkan); C 4 soalan 10 markah setiap satu, jawab dua (40 ditawarkan); 150 minit; SBP dan Selangor sepakat. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 7, markBudget: 50, allowedModes: [], kind: 'bahagian', groups: [g(1, 7, 3, 5)] },
      { label: 'Bahagian B', rule: choose(3), questionCount: 4, markBudget: 30, allowedModes: [], kind: 'bahagian', groups: [g(1, 4, 4, 5)] },
      { label: 'Bahagian C', rule: choose(2), questionCount: 4, markBudget: 20, allowedModes: [], kind: 'bahagian', groups: [g(1, 4, 4, 6)] },
    ],
  },
  {
    code: '4531/2', subject: 'PHY', kertas: 2, durationMin: 150, subPartRamp: false, confidence: 'medium', bodies: ['sbp'],
    notes: `Struktur dan markah (observed, satu badan sahaja: SBP): A 8 soalan 60 markah semua (4, 5, 6, 9, 9, 9, 9, 9); B 2 soalan 20 markah setiap satu, jawab satu (40 ditawarkan); C 1 soalan 20 markah; 150 minit. Peraturan Bahagian C (semua) ialah inferred: baris peraturan tidak dibaca, disokong oleh kulit Biologi 4551/2. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 8, markBudget: 60, allowedModes: [], kind: 'ladder', groups: [g(1, 1, 2, 3, 4, 4), g(2, 2, 2, 3, 5, 5), g(3, 3, 2, 3, 6, 6), g(4, 4, 2, 3, 9, 9), g(5, 6, 3, 4, 9, 9), g(7, 8, 4, 4, 9, 9)] },
      { label: 'Bahagian B', rule: choose(1), questionCount: 2, markBudget: 20, allowedModes: [], kind: 'bahagian', groups: [g(1, 2, 5, 5, 20, 20)] },
      { label: 'Bahagian C', rule: all, questionCount: 1, markBudget: 20, allowedModes: [], kind: 'bahagian', groups: [g(1, 1, 5, 6, 20, 20)] },
    ],
  },
  {
    code: '1249/2', subject: 'SEJ', kertas: 2, durationMin: 90, subPartRamp: true, confidence: 'medium', bodies: ['selangor_mpsm'],
    notes: `Struktur dan markah (observed, satu badan sahaja: Selangor): A 4 soalan 10 markah setiap satu (40) semua; B 5 soalan 20 markah setiap satu, jawab tiga (100 ditawarkan); 90 minit. Sub-bahagian menaik. ${TP_NOTE}`,
    sections: [
      { label: 'Bahagian A', rule: all, questionCount: 4, markBudget: 40, allowedModes: [], kind: 'bahagian', groups: [g(1, 4, 2, 4, 10, 10)] },
      { label: 'Bahagian B', rule: choose(3), questionCount: 5, markBudget: 60, allowedModes: [], kind: 'bahagian', groups: [g(1, 5, 3, 5, 20, 20)] },
    ],
  },
]
