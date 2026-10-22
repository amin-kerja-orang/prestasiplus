import type { CommandCenterGuruDrill } from '@pp/contract'

import type { CommandCenterGuruDrillType } from '../http/request'
import { percent } from '../shared/math'
import { dateKey, timeOfDay, toMytTimestamp } from '../shared/windows'
import { answerDaysOf, cmpId, type GuruContext, type GuruDeps, sum, tallies } from './context'
import { drillGradeOfGps, engagementBand } from './rules'

const iso = (d: Date | undefined): string | null => (d ? toMytTimestamp(d) : null)
const subjectLabel = (code: string | null, name: string | null): string => name ?? code ?? '-'

/** `type` and `filter` are already validated (422 texts) by `guruDrillQueryOf`. */
export async function buildDrill(deps: GuruDeps, ctx: GuruContext, type: CommandCenterGuruDrillType, filter: string): Promise<CommandCenterGuruDrill> {
  const w = ctx.windows
  switch (type) {
    case 'students': {
      const [all, today] = await Promise.all([tallies(deps, ctx), tallies(deps, ctx, w.today)])
      const rows = ctx.pupils
        .filter((p) => filter !== 'active' || today.has(p.id))
        .map((p) => {
          const t = all.get(p.id)
          return {
            studentId: p.id,
            name: p.name,
            className: p.classNames.join(', '),
            answered: t?.answers ?? 0,
            accuracy: percent(t?.correct ?? 0, t?.answers ?? 0),
            lastActiveAt: iso(t?.lastAt),
            status: today.has(p.id) ? ('Aktif' as const) : ('Login' as const),
          }
        })
      return { title: 'Pelajar Berdaftar', students: rows }
    }
    case 'today': {
      const pairs = await deps.repo.pairTally({ from: w.today.from, to: ctx.now, studentIds: ctx.ids, includeInactive: true })
      const rows = pairs
        .filter((p) => ctx.byId.has(p.userId))
        .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime() || cmpId(a.userId, b.userId))
        .map((p) => ({
          studentId: p.userId,
          time: timeOfDay(p.lastAt),
          student: p.name,
          subject: subjectLabel(p.subjectCode, p.subjectName),
          answered: p.answers,
          correct: p.correct,
          accuracy: percent(p.correct, p.answers),
        }))
      return { title: filter === 'aktiviti' ? 'Aktiviti Hari Ini' : 'Soalan Dijawab', students: rows }
    }
    case 'subjects': {
      const tally = await deps.repo.subjectTally({ to: ctx.now, studentIds: ctx.ids, includeInactive: true })
      const rows = tally.map((t) => ({
        subject: subjectLabel(t.code, t.name),
        answered: t.answers,
        correct: t.correct,
        accuracy: percent(t.correct, t.answers),
        students: t.students,
      }))
      return { title: 'Ketepatan Purata', students: rows }
    }
    case 'gps': {
      const rows = (await deps.headcount.gpsRows(ctx.ids)).map((g) => ({ ...g, grade: drillGradeOfGps(g.gps) }))
      return { title: 'GPS Sekolah', students: rows }
    }
    case 'kirk': {
      const title = `Kirkpatrick ${filter.toUpperCase()}`
      if (filter === 't1') return { title, students: await deps.feedback.rows(ctx.ids) }
      const [now, prev] = await Promise.all([tallies(deps, ctx, w.d30), tallies(deps, ctx, w.prev30, true)])
      const all = await tallies(deps, ctx)
      const sNow = sum(now)
      const sPrev = sum(prev)
      const accuracyNow = percent(sNow.correct, sNow.answers)
      const accuracyPrev = percent(sPrev.correct, sPrev.answers)
      const newStudents = [...all.values()].filter((t) => t.firstAt >= w.d30.from && t.firstAt <= ctx.now).length
      return {
        title,
        students: [],
        extra: {
          accuracyNow,
          accuracyPrev,
          accuracyChange: accuracyNow - accuracyPrev,
          answersNow: sNow.answers,
          answersPrev: sPrev.answers,
          activeNow: now.size,
          activePrev: prev.size,
          newStudents,
        },
        vsLabel: 'Bulan Ini vs Bulan Lepas',
      }
    }
    case 'mood': {
      const rows = (await deps.mood.rows(ctx.ids))
        .filter((m) => (filter === '' || m.mood === filter) && ctx.byId.has(m.studentId))
        .sort((a, b) => b.date.localeCompare(a.date) || cmpId(a.studentId, b.studentId))
        .map((m) => ({ studentId: m.studentId, name: ctx.byId.get(m.studentId)?.name ?? '', mood: m.mood, date: m.date, reason: m.reason }))
      return { title: 'Mood Pelajar', students: rows }
    }
    case 'engagement': {
      const [all, week, days] = await Promise.all([tallies(deps, ctx), tallies(deps, ctx, w.week), answerDaysOf(deps, ctx)])
      const weekFrom = dateKey(w.week.from)
      const rows = ctx.pupils
        .map((p) => {
          const set = days.get(p.id)
          const in7 = set ? [...set].filter((d) => d >= weekFrom).length : 0
          return { p, in7, band: engagementBand(in7, set?.size ?? 0) }
        })
        .filter(({ band }) => filter === '' || band === filter)
        .map(({ p, in7, band }) => {
          const t = all.get(p.id)
          return {
            studentId: p.id,
            name: p.name,
            band,
            days: in7,
            answeredWeek: week.get(p.id)?.answers ?? 0,
            accuracy: percent(t?.correct ?? 0, t?.answers ?? 0),
            lastActiveAt: iso(t?.lastAt),
          }
        })
      return { title: 'Engagement Pelajar', students: rows }
    }
  }
}

