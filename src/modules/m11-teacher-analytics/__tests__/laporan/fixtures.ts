import type { StudentLite, TeacherReport } from '../../api/types'

export const student = (
  id: number,
  name: string,
  over: Partial<StudentLite> = {},
): StudentLite => ({
  id,
  name,
  email: `murid${id}@demo.test`,
  avatarUrl: null,
  neverLoggedIn: false,
  ...over,
})

/** The admin zero state (empty population, SRS §6 / E2E-M11-09). */
export function emptyReport(over: Partial<TeacherReport> = {}): TeacherReport {
  return {
    range: 30,
    classroomId: null,
    options: { classes: [] },
    population: { total: 0, loggedIn: 0, practised: 0 },
    activity: {
      total: 0,
      byType: { kuiz: 0, struktur: 0, latihTubi: 0, trackingA: 0, battle: 0, permainan: 0 },
    },
    score: {
      overall: null,
      byType: { kuiz: null, struktur: null, latihTubi: null, trackingA: null, battle: null },
    },
    trend: Array.from({ length: 30 }, (_, i) => ({
      date: `${String((i % 28) + 1).padStart(2, '0')}/09`,
      count: 0,
    })),
    notLoggedIn: [],
    notPractised: [],
    notPractisedAll: [],
    mostActive: [],
    ...over,
  }
}

/** The designed teacher view (SRS §6.8): 8 students, 14 activities, 46 %. */
export function teacherReport(over: Partial<TeacherReport> = {}): TeacherReport {
  return emptyReport({
    options: {
      classes: [
        { id: 2001, name: '5 MARIKH - Kimia' },
        { id: 2002, name: '5 MARIKH - Sejarah' },
      ],
    },
    population: { total: 8, loggedIn: 8, practised: 8 },
    activity: {
      total: 14,
      byType: { kuiz: 14, struktur: 0, latihTubi: 0, trackingA: 0, battle: 0, permainan: 0 },
    },
    score: {
      overall: 46,
      byType: { kuiz: 46, struktur: null, latihTubi: null, trackingA: null, battle: null },
    },
    mostActive: [
      { ...student(3001, 'Murid Demo 01'), activities: 3 },
      { ...student(3002, 'Murid Demo 02'), activities: 3 },
    ],
    ...over,
  })
}
