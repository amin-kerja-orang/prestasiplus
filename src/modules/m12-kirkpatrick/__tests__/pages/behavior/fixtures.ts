import type { Behavior } from '../../../api/types'

const heatRow = (seed: number) =>
  Array.from({ length: 18 }, (_, i) => ((i + seed) % 4 === 0 ? 0 : (i + 1) * seed))

export const behavior = (over: Partial<Behavior> = {}): Behavior => ({
  kpi: {
    t4t5: 4158,
    active: 946,
    sessions: 20991,
    answers: 306133,
    accuracy: 82.8,
    teacherPct: 53.1,
    teachersLoggedIn: 277,
    teachers: 522,
  },
  bands: [
    { key: 'champion', count: 513, pct: 12.3 },
    { key: 'konsisten', count: 259, pct: 6.2 },
    { key: 'berkembang', count: 169, pct: 4.1 },
    { key: 'minimum', count: 5, pct: 0.1 },
    { key: 'tidakTerlibat', count: 3212, pct: 77.2 },
  ],
  schools: [
    {
      schoolId: 9681,
      name: 'SMK Demo A',
      code: 'DEMO001',
      students: 2,
      active: 2,
      answers: 220,
      sessions: 40,
      perActive: 110,
      score: 100,
      tahap: 'champion',
    },
    {
      schoolId: 8080,
      name: 'SMK Demo B',
      code: null,
      students: 184,
      active: 53,
      answers: 15007,
      sessions: 1002,
      perActive: 283.2,
      score: 62.4,
      tahap: 'konsisten',
    },
    {
      schoolId: 940,
      name: 'SMK Demo C',
      code: null,
      students: 1,
      active: 0,
      answers: 0,
      sessions: 1,
      perActive: 0,
      score: 2,
      tahap: 'tidakTerlibat',
    },
  ],
  heat: {
    max: 736,
    cells: [heatRow(1), heatRow(2), heatRow(3), heatRow(4), heatRow(5), heatRow(6), heatRow(7)].map(
      (r, d) => r.map((n, c) => (d === 1 && c === 8 ? 736 : d === 0 && c === 0 ? 100 : n)),
    ),
  },
  alerts: [
    { list: 1, schoolId: 940, name: 'SMK Demo C', kind: 'never', n: 1 },
    { list: 2, schoolId: 10220, name: 'SMK Demo D', kind: 'teacher', n: 2 },
    { list: 3, schoolId: 9167, name: 'SMK Demo E', kind: 'good', pct: 62.5 },
    { list: 3, schoolId: 8098, name: 'SMK Demo F', kind: 'good', pct: 100 },
  ],
  moodCount: 0,
  ...over,
})
