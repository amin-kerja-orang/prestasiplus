/**
 * The data behind the Command Center endpoints (SRS M10 v1.18 §7 #2–#10, BR-M10-04, BR-M10-08).
 *
 * One request builds one `CcContext`: the viewer's students S (BR-M10-04: distinct students with an
 * active enrolment in an active class the viewer owns), their answers from the M05 log, and the day
 * windows of the mock clock (Asia/Kuala_Lumpur calendar days). Every aggregate of the endpoints is a
 * function of that context, so the figures of live-data, the drills, the prediction and the
 * evaluation agree with each other.
 *
 * Windows (ms, `now` = the mock clock; "today" starts at the MYT midnight):
 * - week = the 7 calendar days ending today; previous week = the 7 before;
 * - last 14 days and the 14 before (BR-M10-14, BR-M10-15);
 * - last 30 days and the 30 before (BR-M10-09, BR-M10-10).
 */

import { DAY_MS, formatDateKey, startOfDay } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { classroomsRepo } from '../repository/classrooms'

import type { ClassroomRow } from '../repository/types'
import type { Peers } from './command-center-peers'

export interface AnswerFact {
  atMs: number
  /** MYT calendar day, `YYYY-MM-DD`. */
  day: string
  isCorrect: boolean
  subjectId: number | null
  questionId: number
  chapterId: number | null
}

export interface StudentFacts {
  id: number
  name: string
  /** M01 grade 1–11 (null when the user has none). */
  grade: number | null
  /** The viewer's active classes the student is in. */
  classNames: string[]
  /** Earliest active enrolment in the viewer's classes (ms); `null` when unknown. */
  joinedAtMs: number | null
  /** Oldest first. */
  answers: AnswerFact[]
}

export interface Window {
  /** Inclusive. */
  from: number
  /** Exclusive. */
  to: number
}

export interface Windows {
  now: number
  todayStart: number
  today: Window
  week: Window
  prevWeek: Window
  d14: Window
  prev14: Window
  d30: Window
  prev30: Window
}

export interface CcContext {
  /** The call-time peer repositories (M05, M08, M12, M14, M17). */
  peers: Peers
  viewerId: number
  teacherName: string
  windows: Windows
  /** Ordered by name A→Z, then id. */
  students: StudentFacts[]
  byId: ReadonlyMap<number, StudentFacts>
  /** The viewer's active classes. */
  classes: ClassroomRow[]
}

/** The day windows of the clock. */
export function windowsAt(now: number): Windows {
  const todayStart = startOfDay(now)
  const to = now + 1
  return {
    now,
    todayStart,
    today: { from: todayStart, to },
    week: { from: todayStart - 6 * DAY_MS, to },
    prevWeek: { from: todayStart - 13 * DAY_MS, to: todayStart - 6 * DAY_MS },
    d14: { from: todayStart - 13 * DAY_MS, to },
    prev14: { from: todayStart - 27 * DAY_MS, to: todayStart - 13 * DAY_MS },
    d30: { from: todayStart - 29 * DAY_MS, to },
    prev30: { from: todayStart - 59 * DAY_MS, to: todayStart - 29 * DAY_MS },
  }
}

/**
 * The viewer's context. `peers` are the call-time repositories (`command-center-peers.ts`).
 */
export function buildContext(viewerId: number, now: number, peers: Peers): CcContext {
  const ids = classroomsRepo.teacherStudentIds(viewerId)
  const rows = new Map(users.getMany(ids).map((u) => [u.id, u]))
  const classes = classroomsRepo.forTeacher(viewerId).filter((c) => c.isActive)
  const classNames = new Map<number, string[]>()
  const joined = new Map<number, number>()
  for (const c of classes) {
    for (const e of classroomsRepo.members(c.kind, c.classId)) {
      const sid = e.studentId
      const at = Date.parse(e.joinedAt)
      const prev = joined.get(sid)
      if (Number.isFinite(at) && (prev === undefined || at < prev)) joined.set(sid, at)
      const list = classNames.get(sid)
      if (list) list.push(c.name)
      else classNames.set(sid, [c.name])
    }
  }
  const students: StudentFacts[] = ids.map((id) => {
    const row = rows.get(id)
    return {
      id,
      name: row?.name ?? `Murid ${String(id)}`,
      grade: row?.grade ?? null,
      classNames: classNames.get(id) ?? [],
      joinedAtMs: joined.get(id) ?? null,
      answers: peers.practice.answers(id).map((a) => ({
        atMs: a.answeredAtMs,
        day: formatDateKey(a.answeredAtMs),
        isCorrect: a.isCorrect,
        subjectId: a.subjectId,
        questionId: a.questionId,
        chapterId: a.chapterId,
      })),
    }
  })
  students.sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
  return {
    peers,
    viewerId,
    teacherName: users.get(viewerId)?.name ?? '',
    windows: windowsAt(now),
    students,
    byId: new Map(students.map((s) => [s.id, s])),
    classes,
  }
}

// --- aggregates ----------------------------------------------------------------------------------

export const inWindow = (a: AnswerFact, w: Window): boolean => a.atMs >= w.from && a.atMs < w.to

export interface Tally {
  answered: number
  correct: number
}

/** Answers and correct answers of `answers` inside `w` (all answers when omitted). */
export function tally(answers: readonly AnswerFact[], w?: Window): Tally {
  let answered = 0
  let correct = 0
  for (const a of answers) {
    if (w && !inWindow(a, w)) continue
    answered++
    if (a.isCorrect) correct++
  }
  return { answered, correct }
}

/** Distinct MYT answer days inside `w`. */
export function distinctDays(answers: readonly AnswerFact[], w: Window): number {
  const days = new Set<string>()
  for (const a of answers) if (inWindow(a, w)) days.add(a.day)
  return days.size
}

export function sumTally(students: readonly StudentFacts[], w?: Window): Tally {
  let answered = 0
  let correct = 0
  for (const s of students) {
    const t = tally(s.answers, w)
    answered += t.answered
    correct += t.correct
  }
  return { answered, correct }
}

/** Students with at least one answer inside `w`. */
export const activeIn = (students: readonly StudentFacts[], w: Window): StudentFacts[] =>
  students.filter((s) => s.answers.some((a) => inWindow(a, w)))

/** The last answer of a student, or `undefined`. */
export const lastAnswer = (s: StudentFacts): AnswerFact | undefined =>
  s.answers[s.answers.length - 1]
