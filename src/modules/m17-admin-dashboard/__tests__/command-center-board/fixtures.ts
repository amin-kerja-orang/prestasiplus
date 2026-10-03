/**
 * Fixtures of the S2 / S3 component tests (M17-T3b): the shapes of SRS M17 §7 #3-#5 with fictitious names.
 * The platform board mirrors the E2E anchors of SRS §12 (9 · 3,152 / 1,563 · 477,743 · 82.9 %, today 340, week 2,508,
 * -67 %); the school board is the alias view (no top schools, zero buckets, own 7 days).
 */
import type {
  CcDailyActivity,
  CcLiveData,
  CcSchoolDrill,
} from '../../api/command-center-board-types'

export const platformLive = (over: Partial<CcLiveData> = {}): CcLiveData => ({
  generatedAt: '2026-09-25T15:40:00+08:00',
  scope: 'platform',
  school: null,
  totalSchools: 9,
  totalStudents: 3152,
  activeStudents: 1563,
  totalAnswered: 477743,
  answeredToday: 340,
  answeredWeek: 2508,
  answeredLastWeek: 7556,
  weekChange: -67,
  accuracy: 82.9,
  topSchools: [
    { schoolId: 8082, schoolName: 'SMK CONTOH SATU', activeCount: 393, totalAnswers: 130233 },
    { schoolId: 8078, schoolName: 'SMK CONTOH DUA', activeCount: 345, totalAnswers: 88255 },
    { schoolId: 8081, schoolName: 'SMK CONTOH TIGA', activeCount: 306, totalAnswers: 59086 },
    { schoolId: 8083, schoolName: 'SMK CONTOH EMPAT', activeCount: 174, totalAnswers: 21000 },
    { schoolId: 8084, schoolName: 'SMK CONTOH LIMA', activeCount: 134, totalAnswers: 11000 },
  ],
  topStudents: [
    {
      studentId: 2022,
      name: 'Pelajar Contoh Satu',
      schoolName: 'SMK CONTOH SATU',
      answersCount: 452,
      accuracy: 99.6,
    },
    {
      studentId: 2016,
      name: 'Pelajar Contoh Dua',
      schoolName: 'SMK CONTOH SATU',
      answersCount: 405,
      accuracy: 99,
    },
    {
      studentId: 2018,
      name: 'Pelajar Contoh Tiga',
      schoolName: null,
      answersCount: 234,
      accuracy: 62,
    },
    {
      studentId: 2019,
      name: 'Pelajar Contoh Empat',
      schoolName: null,
      answersCount: 200,
      accuracy: 93.5,
    },
    {
      studentId: 2017,
      name: 'Pelajar Contoh Lima',
      schoolName: null,
      answersCount: 160,
      accuracy: 73.8,
    },
  ],
  gpsOverall: 2.88,
  kirk: {
    t1: { value: 4.6, scale: 5, count: 336 },
    t2Accuracy: 82.9,
    t3Active: 91,
    t4Gps: 2.88,
  },
  engagement: { champion: 29, consistent: 11, developing: 43, minimum: 3, disengaged: 2229 },
  dailyTrend: [],
  mood: { happy: 307, okay: 280, sad: 72, stressed: 91 },
  recentFeed: [
    {
      student: 'Pelajar <b>Contoh</b>',
      subject: 'P.Islam',
      correct: true,
      time: '14:59',
      schoolId: 8082,
      schoolName: 'SEKOLAH MENENGAH KEBANGSAAN CONTOH SATU',
    },
    {
      student: 'Pelajar Contoh Dua',
      subject: 'BM',
      correct: false,
      time: '14:58',
      schoolId: null,
      schoolName: null,
    },
  ],
  correction: { total: 899, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
  ...over,
})

export const schoolLive = (over: Partial<CcLiveData> = {}): CcLiveData =>
  platformLive({
    scope: 'school',
    school: { id: 900001, name: 'SMK DEMO' },
    totalSchools: 1,
    totalStudents: 12,
    activeStudents: 5,
    totalAnswered: 3,
    answeredToday: 3,
    answeredWeek: 3,
    answeredLastWeek: 0,
    weekChange: 0,
    accuracy: 66.7,
    topSchools: [],
    engagement: { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 },
    dailyTrend: [
      { date: '2026-09-19', label: 'Sab', count: 0 },
      { date: '2026-09-20', label: 'Ahd', count: 0 },
      { date: '2026-09-21', label: 'Isn', count: 1 },
      { date: '2026-09-22', label: 'Sel', count: 2 },
      { date: '2026-09-23', label: 'Rab', count: 8 },
      { date: '2026-09-24', label: 'Kha', count: 4 },
      { date: '2026-09-25', label: 'Jum', count: 3 },
    ],
    mood: { happy: 0, okay: 0, sad: 0, stressed: 0 },
    correction: { total: 0, avgImprovement: 0, improvedCount: 0, topImprovers: [] },
    recentFeed: [
      {
        student: 'Pelajar Contoh A1',
        subject: 'Matematik',
        correct: true,
        time: '15:10',
        schoolId: 900001,
        schoolName: 'SMK DEMO',
      },
    ],
    topStudents: [
      {
        studentId: 5001,
        name: 'Pelajar Contoh A1',
        schoolName: 'SMK DEMO',
        answersCount: 3,
        accuracy: 66.7,
      },
    ],
    ...over,
  })

export const platformDaily = (over: Partial<CcDailyActivity> = {}): CcDailyActivity => ({
  period: 'today',
  label: 'Hari Ini (25 Sep 2026)',
  scope: 'platform',
  school: null,
  logins: {
    total: 2,
    byRole: { student: 1, admin: 1 },
    recent: [
      {
        userId: 1,
        name: 'Admin Contoh',
        role: 'admin',
        lastLoginAt: '2026-09-25T15:10:00+08:00',
        schoolId: null,
        schoolName: null,
        package: 'ADMIN',
        timeAgo: '30 minit yang lepas',
      },
      {
        userId: 2017,
        name: 'Pelajar Contoh Lima',
        role: 'student',
        lastLoginAt: '2026-09-25T13:40:00+08:00',
        schoolId: 8080,
        schoolName: 'SMK CONTOH EMPAT',
        package: 'SEKOLAH',
        timeAgo: '2 jam yang lepas',
      },
      {
        userId: 2030,
        name: 'Pelajar Luar Contoh',
        role: 'student',
        lastLoginAt: '2026-09-25T12:40:00+08:00',
        schoolId: null,
        schoolName: null,
        package: 'FREE',
        timeAgo: '3 jam yang lepas',
      },
      {
        userId: 1919,
        name: 'Cikgu Contoh',
        role: 'teacher',
        lastLoginAt: '2026-09-25T11:40:00+08:00',
        schoolId: 8080,
        schoolName: 'SMK CONTOH EMPAT',
        package: 'SEKOLAH',
        timeAgo: '4 jam yang lepas',
      },
    ],
  },
  practice: {
    totalAnswers: 60,
    correctAnswers: 57,
    accuracy: 95,
    activeStudents: 1,
    sessionsStarted: 3,
    sessionsCompleted: 3,
    avgSessionSeconds: 60,
  },
  engagement: {
    moodCheckins: 0,
    moodDist: { happy: 0, okay: 0, sad: 0, stressed: 0 },
    missionsCompleted: 0,
    badgesEarned: 0,
    recentBadges: [],
    quizSetsCreated: 0,
  },
  summary: {
    activeSchools: 1,
    totalSchools: 9,
    activeStudents: 1,
    totalStudents: 3152,
    totalLogins: 2,
  },
  schools: [
    {
      schoolId: 8082,
      schoolName: 'SMK CONTOH SATU',
      activeStudents: 1,
      totalAnswers: 60,
      accuracy: 95,
      activeTeachers: 11,
      loginCount: 0,
      lastActive: '2026-09-25T14:59:00+08:00',
      lastActiveHuman: '41 minit yang lepas',
    },
    {
      schoolId: 8080,
      schoolName: 'SMK CONTOH EMPAT',
      activeStudents: 0,
      totalAnswers: 0,
      accuracy: null,
      activeTeachers: 0,
      loginCount: 1,
      lastActive: '2026-09-25T13:40:00+08:00',
      lastActiveHuman: '2 jam yang lepas',
    },
  ],
  topStudents: [
    {
      userId: 2022,
      name: 'Pelajar Contoh Satu',
      schoolId: 8082,
      schoolName: 'SMK CONTOH SATU',
      answers: 60,
      accuracy: 95,
    },
  ],
  subjectBreakdown: [
    { code: 'MATEMATIK', shortName: 'Matematik', answers: 40 },
    { code: 'BAHASA_MELAYU', shortName: 'BM', answers: 20 },
  ],
  hourlyHeatmap: Object.fromEntries(
    Array.from({ length: 24 }, (_, h) => [String(h), h === 14 ? 60 : 0]),
  ),
  liveFeed: [
    {
      studentId: 2022,
      student: 'Pelajar Contoh Satu',
      subject: 'Matematik',
      correct: true,
      time: '14:59',
      schoolId: 8082,
      schoolName: 'SMK CONTOH SATU',
    },
  ],
  ...over,
})

export const schoolDaily = (over: Partial<CcDailyActivity> = {}): CcDailyActivity =>
  platformDaily({
    scope: 'school',
    school: { id: 900001, name: 'SMK DEMO' },
    summary: {
      activeSchools: 1,
      totalSchools: 1,
      activeStudents: 1,
      totalStudents: 12,
      totalLogins: 1,
    },
    schools: undefined as unknown as CcDailyActivity['schools'],
    ...over,
  })

export const drillData = (over: Partial<CcSchoolDrill> = {}): CcSchoolDrill => ({
  school: { id: 8082, name: 'SMK CONTOH SATU' },
  period: 'today',
  teachers: [
    {
      userId: 1919,
      name: 'Cikgu Contoh',
      students: 9,
      accuracy: 80.2,
      lastActiveHuman: '2 hari yang lepas',
    },
  ],
  students: [
    {
      userId: 2022,
      name: 'Pelajar Contoh Satu',
      answers: 60,
      accuracy: 95,
      lastActiveHuman: '41 minit yang lepas',
    },
  ],
  logins: [
    { userId: 2022, name: 'Pelajar Contoh Satu', role: 'student', timeAgo: '2 jam yang lepas' },
  ],
  ...over,
})
