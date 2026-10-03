/** Fixtures of the S2 component tests (fictitious names only). */

import type {
  CcAchievements,
  CcEvaluation,
  CcLiveData,
  CcPredictive,
  CcRemedialScan,
} from '../../api/command-center-types'
import { EMPTY_LIVE } from '../../components/command-center/copy'

export function live(extra: Partial<CcLiveData> = {}): CcLiveData {
  return { ...EMPTY_LIVE, teacherName: 'Guru Demo', ...extra }
}

/** The teacher 5 look of the mock (8 pupils, 83 answers, two classes). */
export const TEACHER_LIVE = live({
  totalStudents: '8',
  totalStudentsRaw: 8,
  activeStudents: '0',
  activeStudentsRaw: 0,
  totalAnswered: '1,283',
  totalAnsweredRaw: 1283,
  answeredToday: '0',
  answeredTodayRaw: 0,
  answeredWeek: '36',
  answeredWeekRaw: 36,
  weekChange: -23,
  accuracy: 46,
  gpsOverall: 4.69,
  kirkT1: 7.5,
  kirkT2Accuracy: 46,
  kirkT3Active: 8,
  kirkT4Gps: 4.69,
  classes: [
    {
      id: 2001,
      name: 'Kimia 5 Alpha',
      educationLevel: 'tingkatan-5',
      studentCount: 8,
      active: 6,
      accuracy: 46,
    },
    {
      id: 2002,
      name: 'Sejarah 5 Beta',
      educationLevel: 'tingkatan-5',
      studentCount: 8,
      active: 2,
      accuracy: 61,
    },
  ],
  leaderboardWeek: [
    { studentId: 3007, name: 'Murid Demo 07', answered: 20, accuracy: 85 },
    { studentId: 3002, name: 'Murid Demo 02', answered: 16, accuracy: 55 },
    { studentId: 3003, name: 'Murid Demo 03', answered: 12, accuracy: 38 },
    { studentId: 3004, name: 'Murid Demo 04', answered: 4, accuracy: 50 },
  ],
  recentFeed: [
    { studentId: 3002, time: '15:31', student: 'Murid Demo 02', subject: 'Kimia', isCorrect: true },
    {
      studentId: 3003,
      time: '15:30',
      student: 'Murid Demo 03',
      subject: 'Sejarah',
      isCorrect: false,
    },
  ],
  recentBadges: [
    {
      studentId: 3002,
      student: 'Murid Demo 02',
      badge: 'Pemula Rajin',
      icon: 'fa-seedling',
      awardedAt: '2026-09-24T10:00:00+08:00',
    },
  ],
  engagement: { champion: 0, consistent: 1, developing: 5, minimum: 2, disengaged: 0 },
  mood: { happy: 1, okay: 2, sad: 0, stressed: 3 },
})

export const SCAN: CcRemedialScan = {
  weakStudents: [
    {
      studentId: 3002,
      name: 'Murid Demo 02',
      weakTopics: [
        { subject: 'Kimia', topicName: 'Polimer', accuracy: 12.5 },
        { subject: 'Kimia', topicName: 'Getah Asli', accuracy: 30 },
      ],
      weakestAccuracy: 12.5,
    },
    {
      studentId: 3008,
      name: 'Murid Demo 08',
      weakTopics: [{ subject: 'Kimia', topicName: 'Siri Homolog', accuracy: 20 }],
      weakestAccuracy: 20,
    },
  ],
  existingRemedials: [
    { id: 7601, studentId: 3008, status: 'active', totalQuestions: 5, afterAccuracy: null },
  ],
}

export const EVALUATION: CcEvaluation = {
  summary: { totalStudents: 8, atRisk: 2, critical: 0, high: 1, medium: 1 },
  alerts: [
    {
      studentId: 3003,
      name: 'Murid Demo 03',
      riskLevel: 'high',
      alerts: [
        { message: 'Tiada aktiviti 7 hari', suggestion: 'Hubungi pelajar' },
        { message: 'Ketepatan rendah (38%)', suggestion: 'Beri latihan tambahan' },
      ],
    },
    {
      studentId: 3004,
      name: 'Murid Demo 04',
      riskLevel: 'medium',
      alerts: [{ message: 'Prestasi menurun', suggestion: 'Semak topik terkini' }],
    },
  ],
}

export const PREDICTIVE: CcPredictive = {
  predictions: [
    {
      studentId: 3003,
      studentName: 'Murid Demo 03',
      overallAccuracy: 38,
      trend: -8,
      trendLabel: 'Turun',
      consistency: 30,
      predictedGrade: 'G',
      predictedGps: 9,
      risk: 'kritikal',
    },
    {
      studentId: 3001,
      studentName: 'Murid Demo 01',
      overallAccuracy: 86,
      trend: 7,
      trendLabel: 'Naik',
      consistency: 50,
      predictedGrade: 'A',
      predictedGps: 1,
      risk: 'rendah',
    },
  ],
  gradeDistribution: {
    'A+': 0,
    A: 1,
    'A-': 0,
    'B+': 0,
    B: 0,
    'C+': 0,
    C: 0,
    D: 0,
    E: 0,
    G: 1,
  },
  avgPredictedGps: 5,
  atRiskCount: 1,
  totalPredicted: 2,
}

export const EMPTY_PREDICTIVE: CcPredictive = {
  predictions: [],
  gradeDistribution: Object.fromEntries(
    ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G'].map((g) => [g, 0]),
  ),
  avgPredictedGps: 0,
  atRiskCount: 0,
  totalPredicted: 0,
}

export const ACHIEVEMENTS: CcAchievements = {
  totalStudents: 8,
  totalNew: 1,
  badgeStats: [
    { id: 1, name: 'Pemula Rajin', icon: 'fa-seedling', color: '#10b981', holders: 1 },
    { id: 2, name: 'Pelajar Aktif', icon: 'fa-running', color: '#3b82f6', holders: 0 },
  ],
  topCollectors: [{ name: 'Murid Demo 02', count: 1 }],
  newAwards: [
    {
      studentId: 3002,
      name: 'Murid Demo 02',
      badgeName: 'Pemula Rajin',
      icon: 'fa-seedling',
      awardedAt: '2026-09-25T09:00:00+08:00',
    },
  ],
}
