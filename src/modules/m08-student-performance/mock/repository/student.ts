/**
 * The Prestasi 360 read model (S6; SRS M08 v1.11 §7 #6; BR-M08-11, -12, -13). Sessions counted are the
 * practice modes and, for a learner account since D54 (v2 = Tingkatan 4-5 / SPM only), the SPM modes
 * too (DV-M08-40; it supersedes the rejected DV-20 for learners: their SPM work is their practice and
 * /practice/progress counts it; the admin's observed S6 keeps DV-20). Coins, streak and badges are M14's,
 * read at request time (XL3-06); SP records come from the M08 store.
 */

import { addDays, formatDateKey, startOfDay } from '@/lib/time'
import type { UserRow } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms, dskp } from '@/modules/m10-teacher-class/mock'
import { learnerBadges, streak, wallet } from '@/modules/m14-gamification/mock'

import type { StudentPerformance, WeakTopic } from '../../api/types'
import { headcountReads, latestAr, pairStatus, type HeadcountEntryView } from './headcount-port'
import { modesOfUser } from './reads'
import { capPercent, pct, round } from './rules'
import { activityRepo, spRecordsRepo } from './stores'

const DAY = 86_400_000

/** Up to 1 decimal without a trailing ".0". */
const num1 = (v: number): string => String(round(v, 1))

/**
 * BR-M08-12: the student's weak SPs (accuracy < 50), lowest first, ties in record order. Only `log` records
 * count: they are derived from the user's own answers (the admin's observed S7 set is not, so /prestasi/1
 * shows "Tiada topik lemah!", AC-M08-16.1).
 */
export function weakTopicsOf(userId: number): WeakTopic[] {
  const out: WeakTopic[] = []
  for (const r of spRecordsRepo.forUser(userId, 'log')) {
    if (r.answered === 0) continue
    const accuracy = pct(r.correct, r.answered)
    if (accuracy >= 50) continue
    const path = dskp.spPath(r.dskpSpId)
    if (!path) continue
    const subject = curriculum.subject(r.subjectId)
    if (!subject) continue
    const available = questions.spAvailable(r.dskpSpId, { levelId: path.bidang.educationLevelId })
    out.push({
      spId: r.dskpSpId,
      label: `${path.sp.code} — ${path.sp.description}`,
      code: path.sp.code,
      subjectCode: subject.code,
      levelId: path.bidang.educationLevelId,
      attempts: r.answered,
      accuracy: round(accuracy, 1),
      focusCount: Math.min(available, 25),
    })
  }
  // Stable: equal accuracies keep the record order.
  return out.sort((a, b) => a.accuracy - b.accuracy)
}

function headcountCards(entries: readonly HeadcountEntryView[]): StudentPerformance['headcount'] {
  return [...entries]
    .sort((a, b) => b.configUpdatedAt.localeCompare(a.configUpdatedAt) || b.configId - a.configId)
    .map((e) => {
      const chips: StudentPerformance['headcount'][number]['chips'] = [
        { label: 'TOV', value: e.tov, tone: 'none' },
      ]
      e.actuals.forEach((ar, i) => {
        if (ar === null) return
        const target = e.targets[i] ?? null
        chips.push({
          label: `OTR${String(i + 1)}`,
          value: ar,
          tone: target !== null && ar >= target ? 'on' : 'below',
        })
      })
      chips.push({ label: 'ETR', value: e.etr, tone: 'none' })
      return {
        configId: e.configId,
        subject: curriculum.subject(e.subjectId)?.name ?? `Subjek ${String(e.subjectId)}`,
        className: classrooms.get(e.classroomKind, e.classroomId)?.name ?? '',
        year: e.academicYear,
        status: pairStatus(e),
        tov: e.tov,
        chips,
        etr: e.etr,
      }
    })
}

/** BR-M08-13: the Cadangan sentences, in the documented order. */
function suggestionsOf(
  now: number,
  practiced: { hasPractised: boolean; lastAtMs: number; answered: number },
  subjects: StudentPerformance['mastery'],
  weak: WeakTopic[],
  entries: readonly HeadcountEntryView[],
): StudentPerformance['suggestions'] {
  const out: StudentPerformance['suggestions'] = []
  if (practiced.hasPractised) {
    // Calendar days (MYT): 2026-05-21 → 2026-09-25 is 127 (AC-M08-16.1).
    const days = Math.round((startOfDay(now) - startOfDay(practiced.lastAtMs)) / DAY)
    if (days >= 7) {
      out.push({
        kind: 'inactive',
        text: `Sudah ${String(days)} hari tiada latihan. Mulakan semula dengan 10 soalan mudah untuk pemanasan.`,
      })
    }
  } else if (entries.length > 0) {
    out.push({
      kind: 'no-sessions',
      text: 'Belum ada sesi latihan lagi. Mulakan dengan subjek yang paling kamu minati!',
    })
  }
  for (const s of [...subjects]
    .filter((x) => x.accuracy < 70)
    .sort((a, b) => a.accuracy - b.accuracy)) {
    out.push({
      kind: 'subject',
      text: `Tingkatkan prestasi ${s.subjectName} (purata ${num1(s.accuracy)}%) dengan 3 sesi latihan fokus minggu ini.`,
    })
  }
  const top = weak[0]
  if (top) {
    out.push({
      kind: 'topic',
      text: `Topik '${top.label}' (${num1(top.accuracy)}% ketepatan) adalah titik lemah utama — buat latihan tertumpu untuk topik ini.`,
    })
  }
  const below = entries
    .flatMap((e) => {
      const l = latestAr(e)
      if (l === null || l.target === null || l.ar >= l.target) return []
      return [{ e, l, gap: l.ar - l.target }]
    })
    .sort((a, b) => a.gap - b.gap)
  for (const { e, l, gap } of below) {
    out.push({
      kind: 'headcount',
      text: `${curriculum.subject(e.subjectId)?.name ?? 'Subjek'} OTR${String(l.n)}: markah sebenar (${l.ar.toFixed(2)}) masih ${num1(-gap)} mata di bawah sasaran (${(l.target as number).toFixed(2)}). Fokus latihan untuk kejar target.`,
    })
  }
  if (practiced.answered === 0 && entries.length === 0) {
    out.push({
      kind: 'start',
      text: 'Mulakan perjalanan belajar kamu — setiap sesi latihan membina asas yang kukuh!',
    })
  }
  return out
}

export function studentPerformance(pupil: UserRow, now: number): StudentPerformance {
  // D54 / DV-M08-40: a learner account (role student) counts its SPM-mode sessions too; the admin's
  // own S6 keeps the OBSERVED practice-modes-only figures (0 sessions, DV-20 as live; the admin is
  // not a learner account).
  const modes = modesOfUser(pupil.role)
  const sessions = practice.history(pupil.id).filter((s) => modes.has(s.mode))
  let questionsTotal = 0
  let correct = 0
  let seconds = 0
  let lastAtMs = 0
  const bySubject = new Map<number, { sessions: number; n: number; c: number }>()
  const perDay = new Map<string, number>()
  for (const s of sessions) {
    questionsTotal += s.questionCount
    correct += s.correctCount
    seconds += s.timeSpent
    if (s.completedAtMs > lastAtMs) lastAtMs = s.completedAtMs
    if (s.subjectId !== null) {
      const b = bySubject.get(s.subjectId) ?? { sessions: 0, n: 0, c: 0 }
      b.sessions++
      b.n += s.questionCount
      b.c += s.correctCount
      bySubject.set(s.subjectId, b)
    }
    const day = formatDateKey(s.completedAtMs)
    perDay.set(day, (perDay.get(day) ?? 0) + 1)
  }
  const accuracy = questionsTotal === 0 ? 0 : (correct / questionsTotal) * 100

  const mastery: StudentPerformance['mastery'] = [...bySubject.entries()]
    .flatMap(([subjectId, b]) => {
      const subject = curriculum.subject(subjectId)
      return subject
        ? [
            {
              subjectCode: subject.code,
              subjectName: subject.name,
              color: subject.color,
              accuracy: round(capPercent(pct(b.c, b.n)), 1),
              sessions: b.sessions,
              answered: b.n,
              order: b.n,
            },
          ]
        : []
    })
    // INFERRED order (the live order is unobserved): most questions first, then the subject code.
    .sort((a, b) => b.order - a.order || a.subjectCode.localeCompare(b.subjectCode))
    .map((m) => ({
      subjectCode: m.subjectCode,
      subjectName: m.subjectName,
      color: m.color,
      accuracy: m.accuracy,
      sessions: m.sessions,
      answered: m.answered,
    }))

  const start = startOfDay(now)
  const heatmap: StudentPerformance['heatmap'] = Array.from({ length: 90 }, (_, i) => {
    const date = formatDateKey(addDays(start, i - 89))
    return { date, sessions: perDay.get(date) ?? 0 }
  })

  const stored = activityRepo.get(pupil.id)
  const entries = headcountReads.entries().filter((e) => e.studentId === pupil.id)
  const weak = weakTopicsOf(pupil.id)
  const streakView = streak.get(pupil.id)
  const w = wallet.summary(pupil.id)

  return {
    user: { id: pupil.id, name: pupil.name, initial: (pupil.name.trim()[0] ?? '?').toUpperCase() },
    heroAccuracy: Math.round(capPercent(accuracy)),
    streak: streakView.current,
    stats: {
      sessions: sessions.length,
      accuracy: round(capPercent(accuracy), 1),
      answered: questionsTotal,
      seconds,
    },
    headcount: headcountCards(entries),
    mastery,
    activity: {
      streakCurrent: streakView.current,
      streakBest: streakView.best,
      koinTotal: w.currentSyiling,
      practiceDays: activityRepo.get(pupil.id)?.practiceDays ?? 0,
    },
    badges: learnerBadges.forUser(pupil.id).map((b) => ({ icon: b.icon, name: b.name })),
    heatmap,
    weakTopics: weak,
    suggestions: suggestionsOf(
      now,
      // BR-M08-13 (1): "has practised" includes the stored LearnerActivityStats (the admin: 13 practice days,
      // last 2026-05-21, "Sudah 127 hari…" although the log holds no practice-mode session).
      {
        hasPractised: sessions.length > 0 || (stored?.practiceDays ?? 0) > 0,
        lastAtMs: Math.max(
          lastAtMs,
          stored?.lastPracticeAt ? Date.parse(stored.lastPracticeAt) : 0,
        ),
        answered: questionsTotal,
      },
      mastery,
      weak,
      entries,
    ),
  }
}
