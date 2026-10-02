/**
 * #10 Student detail (S8), #11 My Kirkpatrick (S9) and #14 filter options (SRS M12 v1.6 BR-M12-28 ... BR-M12-31,
 * Q-M12-SCH-OPTIONS). Headcount rows come from the M08 `headcountEntries` contract; practice figures from the
 * M05 `kirkpatrick` segment (S8) and the answer log (S9 squares).
 */

import { DAY_MS, mytParts, startOfDay } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice, kirkpatrick } from '@/modules/m05-practice/mock'
import { headcountEntries } from '@/modules/m08-student-performance/mock'

import type { FilterOptions, MyKirkpatrick, StudentKirkpatrick } from '../../../api/types'
import { consistencyRepo } from '../consistency'
import { dayKey, pct1, pctTenths } from '../common'
import { schoolName } from '../scope'

const subjectName = (id: number): string => curriculum.subject(id)?.name ?? `Subjek ${String(id)}`

/** BR-M12-30: the pupil's headcount entries of `year`, one row per subject, A -> Z (TOV as stored). */
function headcountRows(
  userId: number,
  year: number,
): { subjectName: string; tov: number | null }[] {
  const seen = new Set<number>()
  const rows: { subjectName: string; tov: number | null }[] = []
  for (const e of headcountEntries(userId, year)) {
    if (seen.has(e.subjectId)) continue
    seen.add(e.subjectId)
    rows.push({ subjectName: subjectName(e.subjectId), tov: e.tov })
  }
  return rows.sort((a, b) => a.subjectName.localeCompare(b.subjectName, 'ms'))
}

/**
 * The S8 read model of a student, or `null` when `userId` is not a student user (the 403 of FR-M12-17, one
 * uniform answer for "not allowed" and "not found", SEC-M12-02). A student without a session gets the zero
 * state of FN-9.5.1 (provisional).
 */
/**
 * DV-M12-25 (permanent mechanism, M02 owner decision "Option D"): 5571 and 5551 are the live second ids of Students
 * A and B (4664 / 4644, one id per person in the rebuild). They stay ordinary generated users in M01/M02, so S8
 * refuses them explicitly with the same 403 as an id that is not a user, as live does.
 */
const LIVE_SECOND_IDS: ReadonlySet<number> = new Set([5571, 5551])

export function studentOf(userId: number, nowMs: number): StudentKirkpatrick | null {
  const user = users.get(userId)
  if (LIVE_SECOND_IDS.has(userId) || !user || user.role !== 'student') return null
  const detail = kirkpatrick.student(userId)
  const year = mytParts(nowMs).year

  const subjects = (detail?.subjects ?? [])
    .filter((x) => x.answered > 0)
    .map((x) => ({
      subjectId: x.subjectId,
      subjectName: subjectName(x.subjectId),
      answers: x.answered,
      tenths: pctTenths(x.correct, x.answered),
    }))
  const strongest = [...subjects].sort(
    (a, b) => b.tenths - a.tenths || b.answers - a.answers || a.subjectId - b.subjectId,
  )[0]
  const weakest = [...subjects].sort(
    (a, b) => a.tenths - b.tenths || b.answers - a.answers || a.subjectId - b.subjectId,
  )[0]
  const ref = (s: typeof strongest) =>
    s ? { subjectName: s.subjectName, accuracy: s.tenths / 10 } : null

  return {
    student: {
      id: user.id,
      name: user.name,
      schoolName: schoolName(user.schoolId),
      grade: user.grade,
    },
    activeDays: detail?.days.length ?? 0,
    answers: detail?.answered ?? 0,
    accuracy: detail ? pct1(detail.correct, detail.answered) : 0,
    konsistensi: detail ? consistencyRepo.konsistensiOf(userId) : 0,
    streak: detail?.streak ?? 0,
    strongest: ref(strongest),
    weakest: ref(weakest),
    headcount: { year, rows: headcountRows(userId, year) },
    platform: [...subjects]
      .sort((a, b) => b.tenths - a.tenths || b.answers - a.answers || a.subjectId - b.subjectId)
      .map((x) => ({ subjectName: x.subjectName, accuracy: x.tenths / 10, answers: x.answers })),
  }
}

const pad2 = (n: number): string => String(n).padStart(2, '0')

/** #11: the viewer's headcount (null without a TOV this year) and the 30 squares today - 29 ... today. */
export function myOf(userId: number, nowMs: number): MyKirkpatrick {
  const year = mytParts(nowMs).year
  const rows = headcountRows(userId, year)
  const today = startOfDay(nowMs)
  const first = today - 29 * DAY_MS
  const perDay = new Map<string, number>()
  for (const a of practice.answers(userId, { from: first, to: today + DAY_MS })) {
    const key = dayKey(a.answeredAtMs)
    perDay.set(key, (perDay.get(key) ?? 0) + 1)
  }
  const days: MyKirkpatrick['days'] = []
  for (let i = 0; i < 30; i++) {
    const ms = first + i * DAY_MS
    const p = mytParts(ms)
    days.push({ date: `${pad2(p.day)}/${pad2(p.month)}`, answers: perDay.get(dayKey(ms)) ?? 0 })
  }
  return {
    headcount: rows.some((r) => r.tov !== null) ? { year, rows } : null,
    days,
  }
}

/**
 * #14: the S1 / S4 selects, "Semua Sekolah" excluded: the non-fixture schools with >= 1 user, A -> Z (57), and the
 * states of those schools. `onlySchoolId` (the school administrator, INFERRED) keeps that school alone.
 */
export function filterOptionsOf(onlySchoolId: number | null = null): FilterOptions {
  const ids = users.schoolsWithUsers({ excludeFixtures: true })
  const rows = ids
    .map((id) => schools.get(id))
    .filter((s): s is NonNullable<typeof s> => s !== undefined)
    .filter((s) => onlySchoolId === null || s.id === onlySchoolId)
  rows.sort((a, b) => a.name.localeCompare(b.name, 'ms'))
  const states = [...new Set(rows.map((s) => s.state))].sort((a, b) => a.localeCompare(b, 'ms'))
  return { schools: rows.map((s) => ({ id: s.id, name: s.name })), states }
}
