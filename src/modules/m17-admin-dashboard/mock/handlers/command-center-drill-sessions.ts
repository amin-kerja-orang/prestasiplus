/**
 * Builders of the S7 modals (SRS M17 v1.12 §7 #10–#13, FR-M17-56…58, BR-M17-15, BR-M17-16,
 * BR-M17-17): session lists of a week / all time / one subject, one session with its questions, and
 * one headcount config. Reads only (M05 `practice`, M04 `questions`, M03, M08 `headcount`, M01).
 */

import { DAY_MS, toEpochMs } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practice, type SessionRow } from '@/modules/m05-practice/mock'
import { headcount } from '@/modules/m08-student-performance/mock'

import type {
  CcHeadcountDetail,
  CcSessionAnswer,
  CcSessionDetail,
  CcSessionList,
  CcSessionRow,
} from '../../api/command-center-types'
import { percent, round1, round2 } from './command-center-drill-data'
import type { DrillScope } from './command-center-drill-scope'
import { FREE_PRACTICE, isPass, subjectOf } from './command-center-drill-views'

/** "YYYY-MM-DD" that is a real calendar date, as epoch ms of its MYT midnight; `null` otherwise. */
export function dateKeyMs(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  try {
    return toEpochMs(value)
  } catch {
    return null
  }
}

/** The completed sessions' subject label of the week table ("Umum" for free practice, as observed). */
const tableSubject = (subjectId: number | null): string =>
  subjectId === null ? 'Umum' : subjectOf(subjectId).label

/** Chapter name when the session has one, "Latihan Bebas" for free practice, else `null`. */
function topicOf(subjectId: number | null, chapterId: number | null): string | null {
  if (chapterId !== null) {
    const chapter = curriculum.chapter(chapterId)
    if (chapter?.name) return chapter.name
  }
  return subjectId === null ? FREE_PRACTICE.label : null
}

type Summary = ReturnType<typeof practice.history>[number]

function listOf(sessions: readonly Summary[], order: 'asc' | 'desc'): CcSessionList {
  const ordered = [...sessions].sort(
    (a, b) =>
      (a.completedAtMs - b.completedAtMs || (a.id < b.id ? -1 : 1)) * (order === 'asc' ? 1 : -1),
  )
  let answers = 0
  let correct = 0
  let seconds = 0
  const rows: CcSessionRow[] = ordered.map((s) => {
    answers += s.questionCount
    correct += s.correctCount
    seconds += s.timeSpent
    return {
      id: s.id,
      completedAt: s.completedAt ?? '',
      subjectLabel: tableSubject(s.subjectId),
      topic: topicOf(s.subjectId, s.chapterId),
      total: s.questionCount,
      correct: s.correctCount,
      accuracy: round2(percent(s.correctCount, s.questionCount)),
      minutes: Math.floor(s.timeSpent / 60),
    }
  })
  return {
    totalAnswers: answers,
    totalSessions: rows.length,
    accuracy: round1(percent(correct, answers)),
    timeSpentMinutes: Math.floor(seconds / 60),
    sessions: rows,
  }
}

/** #10: completed sessions finished in `[start 00:00, end 24:00)` MYT, oldest first (BR-M17-16). */
export function sessionsBetween(userId: number, startMs: number, endMs: number): CcSessionList {
  const sessions = practice.history(userId, { from: startMs, to: endMs + DAY_MS })
  return listOf(sessions, 'asc')
}

/** #11: completed sessions of one subject (`UMUM` = free practice), newest first (BR-M17-16). */
export function sessionsOfSubject(userId: number, code: string): CcSessionList {
  const wanted: number | null | undefined =
    code === FREE_PRACTICE.code ? null : curriculum.subjectByCode(code)?.id
  if (wanted === undefined) return listOf([], 'desc')
  return listOf(
    practice.history(userId).filter((s) => s.subjectId === wanted),
    'desc',
  )
}

const cut = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)}...` : text

const letter = (index: number): string => String.fromCharCode(65 + index)

/** #12: one completed session of a pupil the viewer may open (`null` → 404). */
export function buildSession(sessionId: string, scope: DrillScope): CcSessionDetail | null {
  const session: SessionRow | undefined = practice.session(sessionId)
  if (!session || session.status !== 'completed' || session.completedAt === null) return null
  if (!scope.mayOpenStudent(session.userId)) return null

  const rows = practice.sessionAnswers(sessionId)
  const bank = new Map(
    questions.getMany([...new Set(rows.map((a) => a.questionId))]).map((q) => [q.id, q]),
  )
  const answers: CcSessionAnswer[] = rows.map((a, i) => {
    const q = bank.get(a.questionId)
    const options = q?.options ?? null
    const option = (index: number | null): string | null => {
      if (index === null || options === null) return null
      const text = options[index]
      return text === undefined ? null : `${letter(index)}) ${text}`
    }
    return {
      no: i + 1,
      correct: a.isCorrect,
      questionText: cut(q?.questionText ?? '', 150),
      selectedAnswer: option(a.selectedOptionId),
      correctAnswer: option(q?.correctAnswer ?? null) ?? q?.correctAnswerText ?? null,
      answeredAt: a.answeredAt,
    }
  })
  const subject = subjectOf(session.subjectId)
  const total = session.questionCount
  return {
    subjectLabel: subject.label,
    topic: topicOf(session.subjectId, session.chapterId),
    completedAt: session.completedAt,
    total,
    correctCount: session.correctCount,
    wrongCount: total - session.correctCount,
    accuracy: round2(percent(session.correctCount, total)),
    timeSpent: { m: Math.floor(session.timeSpent / 60), s: session.timeSpent % 60 },
    difficulty: session.difficulty,
    answers,
  }
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? 0 : round1(values.reduce((a, b) => a + b, 0) / values.length)

/** #13: one headcount config of a class the viewer may open (`null` → 404). */
export function buildHeadcount(configId: number, scope: DrillScope): CcHeadcountDetail | null {
  const detail = headcount.get(configId)
  if (!detail || !scope.mayOpenConfig(detail.config.classroomId)) return null
  const entries = detail.entries
  const graded = entries.filter((e) => e.grade !== null)
  return {
    subject: curriculum.subject(detail.config.subjectId)?.name ?? '',
    totalStudents: entries.length,
    avgTov: mean(entries.flatMap((e) => (e.tov === null ? [] : [e.tov]))),
    avgEtr: mean(entries.flatMap((e) => (e.etr === null ? [] : [e.etr]))),
    passRate:
      graded.length === 0
        ? 0
        : Math.round((graded.filter((e) => isPass(e.grade)).length / graded.length) * 100),
    students: entries.map((e) => ({
      userId: e.studentId,
      name: users.get(e.studentId)?.name ?? '',
      tov: e.tov,
      etr: e.etr,
      rs: e.rs,
      grade: e.grade,
    })),
  }
}
