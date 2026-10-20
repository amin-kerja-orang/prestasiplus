import type { CommandCenterGuruLiveData } from '@pp/contract'

import { formatCount, percent, round, round1, weekChange } from '../shared/math'
import { dateKey, timeOfDay, toMytTimestamp } from '../shared/windows'
import { answerDaysOf, type GuruContext, type GuruDeps, sum, tallies, cmpId } from './context'
import { PREDICT_MIN_ANSWERS, engagementBand, gradeCode } from './rules'

const rank = (id: string, name: string, c: { answers: number; correct: number }) => ({ studentId: id, name, answered: c.answers, accuracy: percent(c.correct, c.answers) })

export async function buildLiveData(deps: GuruDeps, ctx: GuruContext): Promise<CommandCenterGuruLiveData> {
  const w = ctx.windows
  const [all, today, week, prevWeek, d30, prev30] = await Promise.all([
    tallies(deps, ctx),
    tallies(deps, ctx, w.today),
    tallies(deps, ctx, w.week),
    tallies(deps, ctx, w.prevWeek, true),
    tallies(deps, ctx, w.d30),
    tallies(deps, ctx, w.prev30, true),
  ])
  const days = await answerDaysOf(deps, ctx)
  const [feedRows, moodCounts, gps, t1, awards, catalogue] = await Promise.all([
    deps.repo.latestAnswers({ to: ctx.now, studentIds: ctx.ids, includeInactive: true }, 10),
    deps.mood.counts(ctx.ids),
    deps.headcount.gpsOverall(ctx.ids),
    deps.feedback.t1(ctx.ids),
    deps.badges.awards(ctx.ids),
    deps.badges.catalogue(),
  ])

  const sAll = sum(all)
  const sToday = sum(today)
  const sWeek = sum(week)
  const sPrevWeek = sum(prevWeek)
  const active = today.size
  const sNow30 = sum(d30)
  const sPrev30 = sum(prev30)
  const accNow = percent(sNow30.correct, sNow30.answers)
  const accPrev = percent(sPrev30.correct, sPrev30.answers)

  const classes = ctx.classes.flatMap((c) => {
    const educationLevel = gradeCode(c.educationGrade)
    if (educationLevel === null) return []
    const members = ctx.members.get(c.id) ?? []
    const total = sum(all, members)
    return [
      {
        id: c.id,
        name: c.name,
        educationLevel,
        studentCount: members.length,
        active: members.filter((id) => (week.get(id)?.answers ?? 0) > 0).length,
        accuracy: percent(total.correct, total.answers),
      },
    ]
  })

  const ranks = ctx.pupils.map((p) => rank(p.id, p.name, all.get(p.id) ?? { answers: 0, correct: 0 }))
  const topStudents = ranks
    .filter((r) => r.answered >= PREDICT_MIN_ANSWERS)
    .sort((a, b) => b.accuracy - a.accuracy || b.answered - a.answered || cmpId(a.studentId, b.studentId))
    .slice(0, 5)
  const leaderboardWeek = ctx.pupils
    .map((p) => rank(p.id, p.name, week.get(p.id) ?? { answers: 0, correct: 0 }))
    .filter((r) => r.answered > 0)
    .sort((a, b) => b.answered - a.answered || b.accuracy - a.accuracy || cmpId(a.studentId, b.studentId))
    .slice(0, 10)

  const weekFrom = dateKey(w.week.from)
  const band = { champion: 0, consistent: 0, developing: 0, minimum: 0, disengaged: 0 }
  for (const p of ctx.pupils) {
    const set = days.get(p.id)
    const in30 = set?.size ?? 0
    const in7 = set ? [...set].filter((d) => d >= weekFrom).length : 0
    band[engagementBand(in7, in30)]++
  }

  const byBadge = new Map(catalogue.map((b) => [b.id, b]))
  const recentBadges = awards
    .flatMap((a) => {
      const b = byBadge.get(a.badgeId)
      const p = ctx.byId.get(a.userId)
      return b && p ? [{ studentId: a.userId, student: p.name, badge: b.name, icon: b.icon, at: a.awardedAt }] : []
    })
    .sort((a, b) => b.at.getTime() - a.at.getTime() || cmpId(a.studentId, b.studentId))
    .slice(0, 5)
    .map(({ at, ...rest }) => ({ ...rest, awardedAt: toMytTimestamp(at) }))

  // The feedback port reports a 0-5 mean; the contract field is the 0-10 reaction score.
  const kirkT1 = t1.count === 0 ? 0 : round1((t1.value * 10) / t1.scale)

  return {
    teacherName: ctx.teacherName,
    totalStudents: formatCount(ctx.ids.length),
    totalStudentsRaw: ctx.ids.length,
    activeStudents: formatCount(active),
    activeStudentsRaw: active,
    totalAnswered: formatCount(sAll.answers),
    totalAnsweredRaw: sAll.answers,
    answeredToday: formatCount(sToday.answers),
    answeredTodayRaw: sToday.answers,
    answeredWeek: formatCount(sWeek.answers),
    answeredWeekRaw: sWeek.answers,
    weekChange: weekChange(sWeek.answers, sPrevWeek.answers),
    accuracy: percent(sAll.correct, sAll.answers),
    gpsOverall: gps,
    classes,
    topStudents,
    leaderboardWeek,
    recentBadges,
    engagement: band,
    recentFeed: feedRows.map((r) => ({
      studentId: r.userId,
      time: timeOfDay(r.answeredAt),
      student: r.studentName,
      subject: r.subjectName ?? r.subjectCode ?? '-',
      isCorrect: r.isCorrect,
    })),
    kirkT1,
    kirkT1Count: t1.count,
    kirkT2Accuracy: accNow,
    kirkT2Delta: round(accNow - accPrev),
    kirkT2Prev: accPrev,
    kirkT3Active: d30.size,
    kirkT3Delta: d30.size - prev30.size,
    kirkT3Prev: prev30.size,
    kirkT4Gps: gps ?? 0,
    mood: moodCounts,
    generatedAt: toMytTimestamp(ctx.now),
  }
}
