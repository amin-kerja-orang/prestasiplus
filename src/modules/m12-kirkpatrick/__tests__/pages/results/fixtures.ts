import type { AlesaRow, Results, SpmGrade } from '../../../api/types'

const GRADES: SpmGrade[] = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']
const COUNTS = [10, 18, 24, 32, 32, 26, 21, 11, 5, 1]

/** 946 prediction rows, accuracy non-increasing; the first row belongs to school 8090. */
function predictions(n: number): Results['predictions'] {
  return Array.from({ length: n }, (_, i) => {
    const accuracy = Math.max(0, Math.round((100 - (i * 100) / n) * 10) / 10)
    const grade: SpmGrade =
      accuracy >= 90
        ? 'A+'
        : accuracy >= 80
          ? 'A'
          : accuracy >= 70
            ? 'A-'
            : accuracy >= 65
              ? 'B+'
              : accuracy >= 60
                ? 'B'
                : accuracy >= 55
                  ? 'C+'
                  : accuracy >= 50
                    ? 'C'
                    : accuracy >= 40
                      ? 'D'
                      : accuracy >= 30
                        ? 'E'
                        : 'G'
    return {
      userId: 1000 + i,
      name: `Pelajar Demo ${String(1000 + i).padStart(6, '0')}`,
      schoolId: i === 0 ? 8090 : 8080,
      schoolName: i === 0 ? 'SMK Demo A' : 'SMK Demo B',
      answers: 300 - (i % 200),
      accuracy,
      grade,
    }
  })
}

const alesaRow = (
  i: number,
  grade: SpmGrade,
  band: AlesaRow['cadanganBand'],
  confidence: AlesaRow['confidence'],
): AlesaRow => ({
  userId: 2000 + i,
  name: `Pelajar Demo ${String(2000 + i).padStart(6, '0')}`,
  schoolName: 'SMK Demo A',
  accuracy: 90 - i,
  grade,
  confidence,
  cadanganBand: band,
  observed: true,
})

export const results = (over: Partial<Results> = {}): Results => ({
  kpi: {
    gps: 4.3,
    gpsYear: 2025,
    recordsLabel: 41,
    passPct: 96.7,
    pass: 174,
    candidates: 180,
    gradeA: 52,
    gradeAPct: 28.9,
    accuracy: 82.8,
    answers: 306133,
    active: 946,
    activePct: 22.8,
    t4t5: 4158,
    records: 4378,
  },
  distribution: {
    year: 2025,
    candidates: 180,
    rows: GRADES.map((grade, i) => ({
      grade,
      n: COUNTS[i] as number,
      pct: Math.round(((COUNTS[i] as number) / 180) * 1000) / 10,
    })),
  },
  subjectGps: {
    year: 2026,
    rows: [
      { name: 'Bahasa Inggeris', gps: 3.2, grade: 'B+', candidates: 30, prev: 4.3 },
      { name: 'Matematik', gps: 2.5, grade: 'A-', candidates: 30, prev: 4.45 },
      { name: 'Bahasa Melayu', gps: 2.8, grade: 'A-', candidates: 30, prev: 4 },
    ],
  },
  trend: {
    years: [2022, 2023, 2024, 2025, 2026],
    rows: [
      { name: 'Keseluruhan', values: [5.2, 4.8, 4.5, 4.3, null] },
      { name: 'Bahasa Melayu', values: [4.8, 4.5, 4.2, 4, 2.8] },
      { name: 'Pendidikan Islam', values: [4.2, 3.9, 3.65, 3.4, null] },
    ],
  },
  schools: [
    {
      schoolId: 9681,
      name: 'SMK Demo A',
      students: 2,
      active: 2,
      accuracy: 66.2,
      answers: 220,
      engagement: 100,
      tahap: 'champion',
      faded: false,
    },
    {
      schoolId: 8765,
      name: 'SMK Demo C',
      students: 6,
      active: 4,
      accuracy: 57.7,
      answers: 150,
      engagement: 57.7,
      tahap: 'berkembang',
      faded: false,
    },
    {
      schoolId: 940,
      name: 'SMK Demo D',
      students: 1,
      active: 0,
      accuracy: null,
      answers: null,
      engagement: 2,
      tahap: 'tidakTerlibat',
      faded: true,
    },
    {
      schoolId: 1014,
      name: 'SMK Demo E',
      students: 4,
      active: 0,
      accuracy: null,
      answers: null,
      engagement: null,
      tahap: 'tidakTerlibat',
      faded: true,
    },
  ],
  predictions: predictions(946),
  alesa: {
    lulus: 48,
    gagal: 2,
    intervensi: 4,
    rows: [
      alesaRow(1, 'A+', 'A', 'rendah'),
      alesaRow(2, 'A', 'A', 'sederhana'),
      alesaRow(3, 'B+', 'B', 'tinggi'),
      alesaRow(4, 'C', 'C', 'rendah'),
      alesaRow(5, 'E', 'D/E', 'rendah'),
    ],
  },
  roi: { active: 946, perStudent: 323.6, accuracy: 82.8, gps: 4.3 },
  insights: {
    active: 946,
    t4t5: 4158,
    pct: 22.8,
    accuracy: 82.8,
    grade: 'A',
    year: 2025,
    gps: 4.3,
  },
  ...over,
})

/** School 9167: no SPM history row (AC-M12-19.3). */
export const resultsNoHistory = (): Results =>
  results({
    kpi: {
      gps: null,
      gpsYear: null,
      recordsLabel: 41,
      passPct: 0,
      pass: 0,
      candidates: 0,
      gradeA: 0,
      gradeAPct: 0,
      accuracy: 62.1,
      answers: 545,
      active: 5,
      activePct: 62.5,
      t4t5: 8,
      records: 4378,
    },
    distribution: null,
    roi: { active: 5, perStudent: 109, accuracy: 62.1, gps: null },
    insights: { active: 5, t4t5: 8, pct: 62.5, accuracy: 62.1, grade: 'C+', year: null, gps: null },
  })

/** School 8880: a GPS and 150 candidates, no grade counts (G4 F5, D9 choice). */
export const resultsNoCounts = (): Results =>
  results({
    kpi: {
      gps: 2.88,
      gpsYear: 2026,
      recordsLabel: 41,
      passPct: null,
      pass: null,
      candidates: 150,
      gradeA: null,
      gradeAPct: null,
      accuracy: 90.1,
      answers: 71408,
      active: 179,
      activePct: 54.7,
      t4t5: 327,
      records: 4378,
    },
    distribution: null,
  })
