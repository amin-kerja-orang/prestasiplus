/**
 * The read models of the Command Center (SRS M10 v1.18 §7 #2, #3, #7–#10; BR-M10-08, 09, 10, 14, 15,
 * 16): live-data, the drills, the prediction, the evaluation and the badges. Every function takes the
 * request's `CcContext` (the viewer's students and their M05 answers) and is read-only (SEC-M10-08).
 *
 * Upstream reads, public entries only (D12): M08 `headcount` (GPS), M12 `feedback` (T1), M17
 * `moodCheckins` (F-33, provisional M26 store), M14 `learnerBadges` (DATA-M14-20), M03 `curriculum`.
 */

import { formatDateKey, formatTime, startOfDay, toIsoMyt, DAY_MS } from '@/lib/time'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type {
  CcAchievements,
  CcBadgeHolders,
  CcDrill,
  CcDrillRowMap,
  CcDrillType,
  CcDrillVs,
  CcEngagement,
  CcEngagementBand,
  CcEvaluation,
  CcEvaluationAlert,
  CcLiveData,
  CcMood,
  CcMoodName,
  CcPrediction,
  CcPredictive,
  CcStudentRank,
} from '../../api/command-center-types'
import { ADMIN_COMMAND_CENTER_GPS, SNAPSHOT_USER_ID } from '../constants/display'
import { classroomsRepo } from '../repository/classrooms'
import {
  activeIn,
  distinctDays,
  inWindow,
  lastAnswer,
  sumTally,
  tally,
  type CcContext,
  type StudentFacts,
} from './command-center-data'
import {
  DRILL_MSG,
  ENGAGEMENT_BANDS,
  PREDICT_MIN_ANSWERS,
  EVALUATION_MSG,
  RARITY_COLOR,
  SPM_GRADES,
  drillGradeOfGps,
  engagementBand,
  evaluationRisk,
  formatCount,
  gradeOfPercent,
  gradePoints,
  percent,
  predictionRisk,
  rarityOfHolders,
  round,
  trendLabel,
  weekChange,
} from './command-center-rules'

const pct = (t: { answered: number; correct: number }): number =>
  round(percent(t.correct, t.answered))

const subjectName = (id: number | null): string =>
  id === null ? '-' : (curriculum.subject(id)?.name ?? `Subjek ${String(id)}`)

const iso = (ms: number | undefined): string | null => (ms === undefined ? null : toIsoMyt(ms))

// --- GPS (BR-M10-08, M08 BR-M08-01) ------------------------------------------------------------------

interface GpsSubject {
  subjectId: number
  gps: number
  entries: number
  students: number
}

/** GPS over the graded headcount entries of the viewer's classes: overall and per subject. */
export function gpsOf(ctx: CcContext): { overall: number | null; subjects: GpsSubject[] } {
  if (ctx.viewerId === SNAPSHOT_USER_ID)
    return { overall: ADMIN_COMMAND_CENTER_GPS.value, subjects: [] }
  let points = 0
  let entries = 0
  const by = new Map<number, { points: number; entries: number; students: Set<number> }>()
  for (const cls of ctx.classes) {
    for (const config of ctx.peers.headcount.configsOfClass(cls.classId)) {
      const detail = ctx.peers.headcount.get(config.id)
      if (!detail) continue
      for (const e of detail.entries) {
        if (e.grade === null) continue
        const p = gradePoints(e.grade)
        if (p < 0) continue
        points += p
        entries++
        const cur = by.get(config.subjectId) ?? {
          points: 0,
          entries: 0,
          students: new Set<number>(),
        }
        cur.points += p
        cur.entries++
        cur.students.add(e.studentId)
        by.set(config.subjectId, cur)
      }
    }
  }
  return {
    overall: entries === 0 ? null : round(points / entries, 2),
    subjects: [...by.entries()]
      .map(([subjectId, v]) => ({
        subjectId,
        gps: round(v.points / v.entries, 2),
        entries: v.entries,
        students: v.students.size,
      }))
      .sort((a, b) => a.gps - b.gps || a.subjectId - b.subjectId),
  }
}

// --- engagement ----------------------------------------------------------------------------------------

function bandOf(ctx: CcContext, s: StudentFacts): CcEngagementBand {
  return engagementBand(
    distinctDays(s.answers, ctx.windows.week),
    distinctDays(s.answers, ctx.windows.d30),
  )
}

function engagementOf(ctx: CcContext): CcEngagement {
  const out: CcEngagement = { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 }
  for (const s of ctx.students) out[bandOf(ctx, s)]++
  return out
}

// --- Kirkpatrick tiles (BR-M10-10) ---------------------------------------------------------------------------

function vsOf(ctx: CcContext): CcDrillVs {
  const { d30, prev30 } = ctx.windows
  const now = sumTally(ctx.students, d30)
  const prev = sumTally(ctx.students, prev30)
  const accuracyNow = pct(now)
  const accuracyPrev = pct(prev)
  return {
    accuracyNow,
    accuracyPrev,
    accuracyChange: accuracyNow - accuracyPrev,
    answersNow: now.answered,
    answersPrev: prev.answered,
    activeNow: activeIn(ctx.students, d30).length,
    activePrev: activeIn(ctx.students, prev30).length,
    newStudents: ctx.students.filter((s) => {
      const first = s.answers[0]
      return first !== undefined && inWindow(first, d30)
    }).length,
  }
}

function feedbackOf(ctx: CcContext) {
  return ctx.students.flatMap((s) => ctx.peers.feedback.forUser(s.id).map((f) => ({ s, f })))
}

function moodOf(ctx: CcContext) {
  return ctx.students.flatMap((s) => ctx.peers.moodCheckins.forUser(s.id).map((m) => ({ s, m })))
}

// --- #2 live-data ----------------------------------------------------------------------------------------------

function rank(s: StudentFacts, w?: Parameters<typeof tally>[1]): CcStudentRank {
  const t = tally(s.answers, w)
  return { studentId: s.id, name: s.name, answered: t.answered, accuracy: pct(t) }
}

export function liveData(ctx: CcContext): CcLiveData {
  const w = ctx.windows
  const all = sumTally(ctx.students)
  const today = sumTally(ctx.students, w.today)
  const week = sumTally(ctx.students, w.week)
  const prevWeek = sumTally(ctx.students, w.prevWeek)
  const active = activeIn(ctx.students, w.today).length
  const gps = gpsOf(ctx).overall

  const classes = ctx.classes.map((c) => {
    const members = classroomsRepo
      .memberIds(c.kind, c.classId)
      .flatMap((id) => ctx.byId.get(id) ?? [])
    return {
      id: c.classId,
      name: c.name,
      educationLevel: c.educationLevel,
      studentCount: classroomsRepo.memberCount(c.kind, c.classId),
      active: activeIn(members, w.week).length,
      accuracy: pct(sumTally(members)),
    }
  })

  const leaderboardWeek = ctx.students
    .map((s) => rank(s, w.week))
    .filter((r) => r.answered > 0)
    .sort((a, b) => b.answered - a.answered || b.accuracy - a.accuracy || a.studentId - b.studentId)
    .slice(0, 10)

  const topStudents = ctx.students
    .map((s) => rank(s))
    .filter((r) => r.answered >= PREDICT_MIN_ANSWERS)
    .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered || a.studentId - b.studentId)
    .slice(0, 5)

  const recentFeed = ctx.students
    .flatMap((s) => s.answers.map((a) => ({ s, a })))
    .sort((x, y) => y.a.atMs - x.a.atMs || y.a.questionId - x.a.questionId || x.s.id - y.s.id)
    .slice(0, 10)
    .map(({ s, a }) => ({
      studentId: s.id,
      time: formatTime(a.atMs),
      student: s.name,
      subject: subjectName(a.subjectId),
      isCorrect: a.isCorrect,
    }))

  const recentBadges = ctx.students
    .flatMap((s) =>
      ctx.peers.learnerBadges.forUser(s.id).map((b) => ({
        studentId: s.id,
        student: s.name,
        badge: b.name,
        icon: b.icon,
        awardedAt: b.awardedAt,
      })),
    )
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt) || a.studentId - b.studentId)
    .slice(0, 5)

  const fb = feedbackOf(ctx)
  const t1 = fb.length === 0 ? 0 : round(fb.reduce((n, { f }) => n + f.nps, 0) / fb.length, 1)
  const accNow = pct(sumTally(ctx.students, w.d30))
  const accPrev = pct(sumTally(ctx.students, w.prev30))
  const activeNow = activeIn(ctx.students, w.d30).length
  const activePrev = activeIn(ctx.students, w.prev30).length

  const mood: CcMood = { happy: 0, okay: 0, sad: 0, stressed: 0 }
  for (const { m } of moodOf(ctx)) mood[m.mood]++

  return {
    teacherName: ctx.teacherName,
    totalStudents: formatCount(ctx.students.length),
    totalStudentsRaw: ctx.students.length,
    activeStudents: formatCount(active),
    activeStudentsRaw: active,
    totalAnswered: formatCount(all.answered),
    totalAnsweredRaw: all.answered,
    answeredToday: formatCount(today.answered),
    answeredTodayRaw: today.answered,
    answeredWeek: formatCount(week.answered),
    answeredWeekRaw: week.answered,
    weekChange: weekChange(week.answered, prevWeek.answered),
    accuracy: pct(all),
    gpsOverall: gps,
    classes,
    topStudents,
    leaderboardWeek,
    recentBadges,
    engagement: engagementOf(ctx),
    recentFeed,
    kirkT1: t1,
    kirkT1Count: fb.length,
    kirkT2Accuracy: accNow,
    kirkT2Delta: accNow - accPrev,
    kirkT2Prev: accPrev,
    kirkT3Active: activeNow,
    kirkT3Delta: activeNow - activePrev,
    kirkT3Prev: activePrev,
    kirkT4Gps: gps ?? 0,
    mood,
    generatedAt: toIsoMyt(ctx.windows.now),
  }
}

// --- #3 drill --------------------------------------------------------------------------------------------------

export type DrillResult =
  { ok: true; body: CcDrill } | { ok: false; field: 'type' | 'filter'; message: string }

const KIRK_FILTERS = ['t1', 't2', 't3', 't4'] as const
const MOODS = ['happy', 'okay', 'sad', 'stressed'] as const

function isType(value: string): value is CcDrillType {
  return ['students', 'today', 'subjects', 'gps', 'kirk', 'mood', 'engagement'].includes(value)
}

const withRows = <T extends CcDrillType>(
  title: string,
  rows: CcDrillRowMap[T][],
  extra?: { extra: CcDrillVs; vsLabel: string },
): DrillResult => ({
  ok: true,
  body: { title, students: rows, ...(extra ?? {}) },
})

export function drill(ctx: CcContext, type: string, filter: string): DrillResult {
  if (!isType(type)) return { ok: false, field: 'type', message: DRILL_MSG.type }
  const w = ctx.windows
  const bad = (): DrillResult => ({ ok: false, field: 'filter', message: DRILL_MSG.filter })

  switch (type) {
    case 'students': {
      if (filter !== '' && filter !== 'active') return bad()
      const rows = ctx.students
        .filter((s) => filter !== 'active' || s.answers.some((a) => inWindow(a, w.today)))
        .map((s): CcDrillRowMap['students'] => {
          const t = tally(s.answers)
          return {
            studentId: s.id,
            name: s.name,
            className: s.classNames.join(', '),
            answered: t.answered,
            accuracy: pct(t),
            lastActiveAt: iso(lastAnswer(s)?.atMs),
            status: s.answers.some((a) => inWindow(a, w.today)) ? 'Aktif' : 'Login',
          }
        })
      return withRows('Pelajar Berdaftar', rows)
    }
    case 'today': {
      if (filter !== '' && filter !== 'aktiviti') return bad()
      const pairs = new Map<
        string,
        { s: StudentFacts; subjectId: number | null; answered: number; correct: number; at: number }
      >()
      for (const s of ctx.students) {
        for (const a of s.answers) {
          if (!inWindow(a, w.today)) continue
          const key = `${String(s.id)}:${String(a.subjectId)}`
          const cur = pairs.get(key) ?? {
            s,
            subjectId: a.subjectId,
            answered: 0,
            correct: 0,
            at: 0,
          }
          cur.answered++
          if (a.isCorrect) cur.correct++
          cur.at = Math.max(cur.at, a.atMs)
          pairs.set(key, cur)
        }
      }
      const rows = [...pairs.values()]
        .sort((a, b) => b.at - a.at || a.s.id - b.s.id)
        .map((p): CcDrillRowMap['today'] => ({
          studentId: p.s.id,
          time: formatTime(p.at),
          student: p.s.name,
          subject: subjectName(p.subjectId),
          answered: p.answered,
          correct: p.correct,
          accuracy: pct(p),
        }))
      return withRows(filter === 'aktiviti' ? 'Aktiviti Hari Ini' : 'Soalan Dijawab', rows)
    }
    case 'subjects': {
      if (filter !== '') return bad()
      const by = new Map<number | null, { answered: number; correct: number; ids: Set<number> }>()
      for (const s of ctx.students) {
        for (const a of s.answers) {
          const cur = by.get(a.subjectId) ?? { answered: 0, correct: 0, ids: new Set<number>() }
          cur.answered++
          if (a.isCorrect) cur.correct++
          cur.ids.add(s.id)
          by.set(a.subjectId, cur)
        }
      }
      const rows = [...by.entries()]
        .sort((a, b) => b[1].answered - a[1].answered || (a[0] ?? 0) - (b[0] ?? 0))
        .map(([id, v]): CcDrillRowMap['subjects'] => ({
          subject: subjectName(id),
          answered: v.answered,
          correct: v.correct,
          accuracy: pct(v),
          students: v.ids.size,
        }))
      return withRows('Ketepatan Purata', rows)
    }
    case 'gps': {
      if (filter !== '') return bad()
      const rows = gpsOf(ctx).subjects.map((g): CcDrillRowMap['gps'] => ({
        subject: subjectName(g.subjectId),
        gps: g.gps,
        grade: drillGradeOfGps(g.gps),
        students: g.students,
        source: 'Anggaran OTR',
      }))
      return withRows('GPS Sekolah', rows)
    }
    case 'kirk': {
      if (!(KIRK_FILTERS as readonly string[]).includes(filter)) return bad()
      const title = `Kirkpatrick ${filter.toUpperCase()}`
      if (filter === 't1') {
        const rows = feedbackOf(ctx)
          .sort((a, b) => b.f.createdAt.localeCompare(a.f.createdAt) || a.s.id - b.s.id)
          .map(({ s, f }): CcDrillRowMap['kirk'] => ({
            studentId: s.id,
            name: s.name,
            average: f.nps,
            satisfaction: f.satisfaction,
            relevance: null,
            usefulness: null,
            date: f.month,
          }))
        return withRows(title, rows)
      }
      return withRows(title, [], { extra: vsOf(ctx), vsLabel: 'Bulan Ini vs Bulan Lepas' })
    }
    case 'mood': {
      if (filter !== '' && !(MOODS as readonly string[]).includes(filter)) return bad()
      const rows = moodOf(ctx)
        .filter(({ m }) => filter === '' || m.mood === (filter as CcMoodName))
        .sort((a, b) => b.m.date.localeCompare(a.m.date) || a.s.id - b.s.id || b.m.id - a.m.id)
        .map(({ s, m }): CcDrillRowMap['mood'] => ({
          studentId: s.id,
          name: s.name,
          mood: m.mood,
          date: m.date,
          reason: m.reason,
        }))
      return withRows('Mood Pelajar', rows)
    }
    case 'engagement': {
      if (filter !== '' && !(ENGAGEMENT_BANDS as readonly string[]).includes(filter)) return bad()
      const rows = ctx.students
        .map((s) => ({ s, band: bandOf(ctx, s) }))
        .filter(({ band }) => filter === '' || band === filter)
        .map(({ s, band }): CcDrillRowMap['engagement'] => {
          const wk = tally(s.answers, w.week)
          return {
            studentId: s.id,
            name: s.name,
            band,
            days: distinctDays(s.answers, w.week),
            answeredWeek: wk.answered,
            accuracy: pct(tally(s.answers)),
            lastActiveAt: iso(lastAnswer(s)?.atMs),
          }
        })
      return withRows('Engagement Pelajar', rows)
    }
  }
}

// --- #7 predictive (BR-M10-14) ---------------------------------------------------------------------------------

/** Accuracy of the last 14 days minus the 14 before; 0 when either window has no answer. */
function trendOf(ctx: CcContext, s: StudentFacts): number {
  const now = tally(s.answers, ctx.windows.d14)
  const prev = tally(s.answers, ctx.windows.prev14)
  if (now.answered === 0 || prev.answered === 0) return 0
  return round(percent(now.correct, now.answered) - percent(prev.correct, prev.answered))
}

export function predictive(ctx: CcContext): CcPredictive {
  const predictions: CcPrediction[] = []
  for (const s of ctx.students) {
    const all = tally(s.answers)
    if (all.answered < PREDICT_MIN_ANSWERS) continue
    const accuracy = percent(all.correct, all.answered)
    const grade = gradeOfPercent(accuracy)
    const trend = trendOf(ctx, s)
    predictions.push({
      studentId: s.id,
      studentName: s.name,
      overallAccuracy: round(accuracy),
      trend,
      trendLabel: trendLabel(trend),
      consistency: round((distinctDays(s.answers, ctx.windows.d30) / 30) * 100),
      predictedGrade: grade,
      predictedGps: gradePoints(grade),
      risk: predictionRisk(grade),
    })
  }
  predictions.sort((a, b) => a.overallAccuracy - b.overallAccuracy || a.studentId - b.studentId)
  const gradeDistribution: Record<string, number> = {}
  for (const g of SPM_GRADES) gradeDistribution[g] = 0
  for (const p of predictions)
    gradeDistribution[p.predictedGrade] = (gradeDistribution[p.predictedGrade] ?? 0) + 1
  return {
    predictions,
    gradeDistribution,
    avgPredictedGps:
      predictions.length === 0
        ? 0
        : round(predictions.reduce((n, p) => n + p.predictedGps, 0) / predictions.length, 2),
    atRiskCount: predictions.filter((p) => p.risk === 'kritikal' || p.risk === 'tinggi').length,
    totalPredicted: predictions.length,
  }
}

// --- #8 evaluate (BR-M10-15) ------------------------------------------------------------------------------------

export function evaluate(ctx: CcContext): CcEvaluation {
  const rows: CcEvaluation['alerts'] = []
  for (const s of ctx.students) {
    const last = lastAnswer(s)
    const alerts: CcEvaluationAlert[] = []
    // A pupil who never answered counts as inactive since the enrolment, at least 7 days (BR-M10-15).
    const since = last?.atMs ?? s.joinedAtMs ?? ctx.windows.todayStart
    const days = Math.floor((ctx.windows.todayStart - startOfDay(since)) / DAY_MS)
    const idle = last ? days : Math.max(7, days)
    if (idle >= 7) {
      alerts.push({
        message: EVALUATION_MSG.inactive(idle),
        suggestion: EVALUATION_MSG.inactiveTip,
      })
    }
    const all = tally(s.answers)
    const accuracy = percent(all.correct, all.answered)
    if (all.answered > 0 && accuracy < 40) {
      alerts.push({
        message: EVALUATION_MSG.lowAccuracy(round(accuracy)),
        suggestion: EVALUATION_MSG.lowAccuracyTip,
      })
    }
    if (trendOf(ctx, s) < -10) {
      alerts.push({ message: EVALUATION_MSG.declining, suggestion: EVALUATION_MSG.decliningTip })
    }
    const risk = evaluationRisk(alerts.length)
    if (risk) rows.push({ studentId: s.id, name: s.name, riskLevel: risk, alerts })
  }
  const order = { critical: 0, high: 1, medium: 2 } as const
  rows.sort((a, b) => order[a.riskLevel] - order[b.riskLevel] || a.studentId - b.studentId)
  return {
    summary: {
      totalStudents: ctx.students.length,
      atRisk: rows.length,
      critical: rows.filter((r) => r.riskLevel === 'critical').length,
      high: rows.filter((r) => r.riskLevel === 'high').length,
      medium: rows.filter((r) => r.riskLevel === 'medium').length,
    },
    alerts: rows,
  }
}

// --- #9 achievements, #10 badge holders (BR-M10-16) ----------------------------------------------------------------

/** The M14 holdings of the viewer's students: badge id → holders (with the award time). */
function holdingsOf(ctx: CcContext) {
  const by = new Map<number, { s: StudentFacts; awardedAt: string }[]>()
  const perStudent = new Map<number, number>()
  for (const s of ctx.students) {
    const held = ctx.peers.learnerBadges.forUser(s.id)
    if (held.length > 0) perStudent.set(s.id, held.length)
    for (const b of held) {
      const list = by.get(b.id) ?? []
      list.push({ s, awardedAt: b.awardedAt })
      by.set(b.id, list)
    }
  }
  return { by, perStudent }
}

export function achievements(ctx: CcContext): CcAchievements {
  const { by, perStudent } = holdingsOf(ctx)
  const today = formatDateKey(ctx.windows.now)
  const catalogue = ctx.peers.learnerBadges.catalogue()
  const newAwards = catalogue
    .flatMap((b) =>
      (by.get(b.id) ?? [])
        .filter((h) => formatDateKey(Date.parse(h.awardedAt)) === today)
        .map((h) => ({
          studentId: h.s.id,
          name: h.s.name,
          badgeName: b.name,
          icon: b.icon,
          awardedAt: h.awardedAt,
        })),
    )
    .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt) || a.studentId - b.studentId)
  return {
    totalStudents: ctx.students.length,
    totalNew: newAwards.length,
    badgeStats: catalogue.map((b) => {
      const holders = by.get(b.id)?.length ?? 0
      return {
        id: b.id,
        name: b.name,
        icon: b.icon,
        color: RARITY_COLOR[rarityOfHolders(holders)],
        holders,
      }
    }),
    topCollectors: ctx.students
      .filter((s) => perStudent.has(s.id))
      .map((s) => ({ name: s.name, count: perStudent.get(s.id) ?? 0, id: s.id }))
      .sort((a, b) => b.count - a.count || a.id - b.id)
      .slice(0, 5)
      .map(({ name, count }) => ({ name, count })),
    newAwards,
  }
}

/** #10: `null` for an unknown badge. */
export function badgeHolders(ctx: CcContext, badgeId: number): CcBadgeHolders | null {
  const badge = ctx.peers.learnerBadges.catalogue().find((b) => b.id === badgeId)
  if (!badge) return null
  const { by } = holdingsOf(ctx)
  return {
    // DATA-M14-20 has no description; the field is kept for the contract and left empty.
    badge: { name: badge.name, description: '' },
    holders: (by.get(badgeId) ?? [])
      .sort((a, b) => a.awardedAt.localeCompare(b.awardedAt) || a.s.id - b.s.id)
      .map((h) => ({
        studentId: h.s.id,
        name: h.s.name,
        accuracy: pct(tally(h.s.answers)),
        awardedAt: h.awardedAt,
      })),
  }
}
