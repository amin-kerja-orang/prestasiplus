/**
 * Study evidence of the six launch blueprints (bijak-spm, BJS-12; architecture section 8 "Evidence (study)"):
 * one `blueprint_evidence` row per body actually read, `origin = 'study'`, values from SPP section 4 (papers) and
 * 10.2 (skema), `sourceRef` = "Kajian kertas percubaan 2025". No file, no question text, no person name.
 * Body ids are lowercase snake_case: `sbp`, `selangor_mpsm`.
 *
 * Only what was read is stated. A skema prints per-question totals but never the choose-N rule (SPP 10.3), so a
 * skema row carries `offeredMarks` (and `markBudget` where the section is "all"), never `rule`. Fizik Bahagian C
 * has no rule value (the rule line was not read). Sejarah K2 has no skema row: its skema was read only in part
 * (Q5(b) unresolved). No `verification` row is seeded and a single-body paper stays `tidak_disahkan`.
 */
import type { EvidenceKind, EvidenceValues } from '@pp/exam-core'

export const EVIDENCE_YEAR = 2025
export const EVIDENCE_SOURCE_REF = 'Kajian kertas percubaan 2025'

export interface EvidenceSeedRow {
  kind: EvidenceKind
  /** Lowercase snake_case id of the issuing body. */
  body: string
  values: EvidenceValues
  note?: string
}

type Sec = NonNullable<EvidenceValues['sections']>[number]
const all = { type: 'all' } as const
const choose = (n: number) => ({ type: 'choose', n }) as const

const sec = (position: number, label: string, markBudget: number, offeredMarks: number, rule: Sec['rule'], questionCount: number): Sec => ({
  position,
  label,
  markBudget,
  offeredMarks,
  ...(rule ? { rule } : {}),
  questionCount,
})
/** Skema section: totals only. `markBudget` only when the section is "all" (offered = counted). */
const skemaSec = (position: number, offeredMarks: number, markBudget?: number): Sec => ({
  position,
  offeredMarks,
  ...(markBudget !== undefined ? { markBudget } : {}),
})

const paper = (body: string, values: EvidenceValues, note?: string): EvidenceSeedRow => ({ kind: 'trial_paper', body, values, ...(note ? { note } : {}) })
const skema = (body: string, values: EvidenceValues, note?: string): EvidenceSeedRow => ({ kind: 'skema', body, values, ...(note ? { note } : {}) })

const MAT_K1: EvidenceValues = { durationMin: 90, totalMarks: 40, sections: [sec(1, 'Bahagian A', 40, 40, all, 40)] }
const MAT_K2: EvidenceValues = {
  durationMin: 150,
  totalMarks: 100,
  sections: [sec(1, 'Bahagian A', 40, 40, all, 10), sec(2, 'Bahagian B', 45, 45, all, 5), sec(3, 'Bahagian C', 15, 30, choose(1), 2)],
}
const ADD_K2: EvidenceValues = {
  durationMin: 150,
  totalMarks: 100,
  sections: [sec(1, 'Bahagian A', 50, 50, all, 7), sec(2, 'Bahagian B', 30, 40, choose(3), 4), sec(3, 'Bahagian C', 20, 40, choose(2), 4)],
}

export const EVIDENCE: Readonly<Record<string, readonly EvidenceSeedRow[]>> = {
  '1449/1': [
    paper('sbp', MAT_K1, '39 daripada 40 item dibaca (satu halaman tidak jelas).'),
    paper('selangor_mpsm', MAT_K1, '15 daripada 40 item dibaca (sampel).'),
    skema('sbp', { totalMarks: 40 }, 'Skema SBP mencetak penukaran (K1 + K2) / 140, iaitu K1 dikira 40.'),
  ],
  '1449/2': [
    paper('sbp', MAT_K2),
    paper('selangor_mpsm', MAT_K2),
    skema('sbp', { totalMarks: 100, sections: [skemaSec(1, 40, 40), skemaSec(2, 45, 45), skemaSec(3, 30)] }, 'Semua 17 soalan dan jumlah sub-bahagian disahkan.'),
    skema('selangor_mpsm', { sections: [skemaSec(1, 40, 40), skemaSec(2, 45, 45), skemaSec(3, 30)] }, 'Jumlah disahkan untuk Q1-Q17.'),
  ],
  '3472/1': [
    paper('sbp', { durationMin: 120, totalMarks: 80, sections: [sec(1, 'Bahagian A', 64, 64, all, 12), sec(2, 'Bahagian B', 16, 24, choose(2), 3)] }, 'Q1-Q15 dibaca; Selangor K1 tidak dibaca.'),
    skema('sbp', { sections: [skemaSec(1, 64, 64), skemaSec(2, 24)] }, 'Semua 15 jumlah disahkan.'),
  ],
  '3472/2': [
    paper('sbp', ADD_K2),
    paper('selangor_mpsm', ADD_K2),
    skema('sbp', { sections: [skemaSec(1, 50, 50), skemaSec(2, 40), skemaSec(3, 40)] }, 'Semua 15 jumlah disahkan.'),
    skema('selangor_mpsm', { sections: [skemaSec(1, 50, 50), skemaSec(2, 40), skemaSec(3, 40)] }, 'Semua 15 jumlah disahkan.'),
  ],
  '4531/2': [
    paper(
      'sbp',
      {
        durationMin: 150,
        totalMarks: 100,
        sections: [sec(1, 'Bahagian A', 60, 60, all, 8), sec(2, 'Bahagian B', 20, 40, choose(1), 2), { position: 3, label: 'Bahagian C', markBudget: 20, offeredMarks: 20, questionCount: 1 }],
      },
      'Q1-Q11 dibaca (32 daripada 41 halaman); baris peraturan Bahagian C tidak dibaca.',
    ),
    skema('sbp', { sections: [skemaSec(1, 60, 60), skemaSec(2, 40), skemaSec(3, 20)] }, 'Semua 11 jumlah disahkan.'),
  ],
  '1249/2': [
    paper('selangor_mpsm', { durationMin: 90, totalMarks: 100, sections: [sec(1, 'Bahagian A', 40, 40, all, 4), sec(2, 'Bahagian B', 60, 100, choose(3), 5)] }, 'Q1-Q9 dibaca; satu badan sahaja.'),
  ],
}
