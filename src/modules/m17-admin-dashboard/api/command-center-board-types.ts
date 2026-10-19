/**
 * Response types of the Command Center board endpoints (SRS M17 v1.13 §7 #3–#5; M17-T1b): the live board S2
 * (`GET /api/admin/command-center/live-data`), the daily-activity board S3 (`GET /api/command-center/daily-activity`)
 * and its school drill (`…/daily-activity/school/{id}`). One set serves the admin pages and the Admin Sekolah
 * alias (`/admin-sekolah/command-center*`, §3.2): the endpoints are the same and the server scopes them from the
 * session (guard AS), so a school admin gets the same shapes.
 *
 * Datetimes are ISO 8601 with +08:00; accuracies are percentages with 1 decimal (the page prints "82.9%");
 * `time` of a feed row is `HH:MM` in MYT (DV-M17-06).
 *
 * School view additions (documented SRS gap: the shape stays the platform shape): `scope` and `school` say whose
 * figures these are; `dailyTrend` holds the school's own answers per day for the last 7 days ("Engagement",
 * OQ-M17-12, SERVER `PlatformMetrics.php:133-152`) and is empty on the platform view; the five `engagement`
 * buckets are DC-M17-05 on the platform view and 0 on the school view.
 */

/** Mood values (BR-M17-25); the same literals as the F-33 `moodCheckins` store. */
export type CcMood = 'happy' | 'okay' | 'sad' | 'stressed'

export type CcMoodCounts = Record<CcMood, number>

/** The three S3 tabs (FR-M17-35). */
export type CcPeriod = 'today' | 'week' | 'month'

/** `{id, name}` of a school. */
export interface CcBoardSchool {
  id: number
  name: string
}

// --- #3 S2 -------------------------------------------------------------------------------------

export interface CcTopSchool {
  schoolId: number
  schoolName: string
  /** Q-M17-SCH-ENGAGED: pupils of P with at least one answer ("{n} plj"). */
  activeCount: number
  /** Q-M17-SCH-ANS. */
  totalAnswers: number
}

export interface CcTopStudent {
  studentId: number
  name: string
  /** `null` for a pupil without a school. */
  schoolName: string | null
  answersCount: number
  accuracy: number
}

export interface CcFeedRow {
  /** Pupil name (the page escapes it, DV-M17-26). */
  student: string
  /** Short subject name (BR-M17-26). */
  subject: string
  correct: boolean
  /** `HH:MM`, MYT. */
  time: string
  schoolId: number | null
  schoolName: string | null
}

export interface CcKirkpatrick {
  /** M12 Q-M12-T1 satisfaction mean on its 1–5 scale (DV-M17-08). */
  t1: { value: number; scale: 5; count: number }
  /** Accuracy % (T2). */
  t2Accuracy: number
  /** Pupils with an answer in the last 30 days (T3). */
  t3Active: number
  /** SPM subject GPS of the scope (T4, 3 decimals; 0 when the scope has no GPS rows). */
  t4Gps: number
}

export interface CcEngagementBuckets {
  champion: number
  consistent: number
  developing: number
  minimum: number
  disengaged: number
}

export interface CcCorrection {
  total: number
  avgImprovement: number
  improvedCount: number
  /** Never filled in the prototype (no list data). */
  topImprovers: never[]
}

/** One day of the school view's "Engagement" bars. */
export interface CcDailyPoint {
  /** `YYYY-MM-DD` (MYT). */
  date: string
  /** BM weekday abbreviation (PROPOSED: Isn, Sel, Rab, Kha, Jum, Sab, Ahd). */
  label: string
  count: number
}

export type CcBoardScope = 'platform' | 'school'

export interface CcLiveData {
  generatedAt: string
  scope: CcBoardScope
  /** The viewer's school on the school view, else `null`. */
  school: CcBoardSchool | null
  /** Q-M17-SUBSCRIBED (platform) / 1 or 0 (school). */
  totalSchools: number
  /** Q-M17-PUPILS. */
  totalStudents: number
  /** Q-M17-ENGAGED(all) ("{n} aktif menjawab"). */
  activeStudents: number
  /** Q-M17-ANS(all). */
  totalAnswered: number
  answeredToday: number
  answeredWeek: number
  answeredLastWeek: number
  /** BR-M17-07, whole percent. */
  weekChange: number
  accuracy: number
  /** Five rows on the platform view, empty on the school view. */
  topSchools: CcTopSchool[]
  topStudents: CcTopStudent[]
  /** = `kirk.t4Gps` (DV-M17-09). */
  gpsOverall: number
  kirk: CcKirkpatrick
  engagement: CcEngagementBuckets
  /** School view: the last 7 days of the school's own answers; platform: empty. */
  dailyTrend: CcDailyPoint[]
  mood: CcMoodCounts
  recentFeed: CcFeedRow[]
  correction: CcCorrection
}

// --- #4 S3 -------------------------------------------------------------------------------------

export interface CcLoginRow {
  userId: number
  name: string
  role: string
  lastLoginAt: string
  schoolId: number | null
  /** `null` for a user without a school ("Pelajar Luar" for a pupil). */
  schoolName: string | null
  /** BR-M17-24 chip: ADMIN, PARENT, AKTIF, PKSK, SEKOLAH, BEBAS, FREE. */
  package: string
  timeAgo: string
}

export interface CcBadgeRow {
  userId: number
  name: string
  badgeName: string
  icon: string
  awardedAt: string
}

export interface CcSchoolActivity {
  schoolId: number
  schoolName: string
  activeStudents: number
  totalAnswers: number
  /** `null` when the school has no answer in the period ("-%"). */
  accuracy: number | null
  /** Q-M17-SCH-TEACHERS ("{n} GURU"). */
  activeTeachers: number
  /** Users of the school with a login in the period ("{n} LOGIN" on login-only rows). */
  loginCount: number
  /** Latest answer or login of the school in the period. */
  lastActive: string | null
  lastActiveHuman: string
}

export interface CcDailyTopStudent {
  userId: number
  name: string
  schoolId: number | null
  schoolName: string | null
  answers: number
  accuracy: number
}

export interface CcSubjectBar {
  code: string
  shortName: string
  answers: number
}

export interface CcDailyFeedRow extends CcFeedRow {
  studentId: number
}

export interface CcDailyActivity {
  /** The raw `period` of the request (an unknown value is echoed, with today's figures). */
  period: string
  /** "Hari Ini (25 Sep 2026)" / "Minggu Ini" / "Bulan Ini". */
  label: string
  scope: CcBoardScope
  school: CcBoardSchool | null
  logins: {
    total: number
    /** Roles with at least one login, in the order student, teacher, parent, admin, school_admin, others. */
    byRole: Record<string, number>
    /** The 10 latest. */
    recent: CcLoginRow[]
  }
  practice: {
    totalAnswers: number
    correctAnswers: number
    accuracy: number
    activeStudents: number
    sessionsStarted: number
    sessionsCompleted: number
    /** Mean `timeSpent` in seconds (the page prints "{m}m {s}s", floor). */
    avgSessionSeconds: number
  }
  engagement: {
    moodCheckins: number
    moodDist: CcMoodCounts
    missionsCompleted: number
    badgesEarned: number
    recentBadges: CcBadgeRow[]
    quizSetsCreated: number
  }
  summary: {
    activeSchools: number
    /** Q-M17-SCHOOLS (57) on the platform view, 1 on the school view (DV-M17-13). */
    totalSchools: number
    activeStudents: number
    totalStudents: number
    totalLogins: number
  }
  /** Platform view only; omitted for a school admin (FR-M17-116). */
  schools?: CcSchoolActivity[]
  topStudents: CcDailyTopStudent[]
  subjectBreakdown: CcSubjectBar[]
  /** Hour (MYT) → answers for the 24 hours on "today"; empty on the other tabs. */
  hourlyHeatmap: Record<string, number>
  liveFeed: CcDailyFeedRow[]
}

// --- #5 S3 school drill ------------------------------------------------------------------------

export interface CcDrillTeacher {
  userId: number
  name: string
  /** Their answering pupils of the school in the period ("{n} pelajar"). */
  students: number
  accuracy: number
  lastActiveHuman: string
}

export interface CcDrillStudent {
  userId: number
  name: string
  answers: number
  accuracy: number
  lastActiveHuman: string
}

export interface CcDrillLogin {
  userId: number
  name: string
  role: string
  timeAgo: string
}

export interface CcSchoolDrill {
  school: CcBoardSchool
  period: string
  teachers: CcDrillTeacher[]
  students: CcDrillStudent[]
  logins: CcDrillLogin[]
}
