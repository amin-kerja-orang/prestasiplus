/**
 * #5 S4 student detail (SRS M11 v1.10 §6.4 StudentDetail; BR-M11-19…23; FN-M11-4.2.x). The rows are the
 * pupil's M05 answers (Q-ANS-USER) joined with M04 `questions.get`; subjects, topics and chapter labels
 * come from M03 and the question rows (D12). A pupil with no answer gets the FN-M11-4.2.11 state
 * (PROPOSED), never a 404.
 */

import { toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions, type Question } from '@/modules/m04-question-bank/mock'
import { practice, type AnswerRow } from '@/modules/m05-practice/mock'

import type {
  GapSeverity,
  StudentAnswerOption,
  StudentAnswerRow,
  StudentDetail,
  TopicBadge,
} from '../../api/types'
import { levelLabelOf, percent, round1, stripHtml } from './rules'
import { schoolFact } from './segment'

const LETTERS = ['A', 'B', 'C', 'D'] as const
const letterOf = (i: number | null): StudentAnswerRow['selectedLabel'] =>
  i === null ? null : (LETTERS[i] ?? null)

/** BR-M11-23. */
const badgeOf = (p: number): TopicBadge => (p >= 80 ? 'Kuat' : p >= 50 ? 'Sederhana' : 'Lemah')

/** BR-M11-19 severity of a gap group (accuracy < 60%). */
const severityOf = (p: number): GapSeverity =>
  p < 30 ? 'Kritikal' : p < 50 ? 'Lemah' : 'Perlu Perhatian'

const subjectName = (id: number | null): string =>
  id === null ? '' : (curriculum.subject(id)?.name ?? `Subjek ${String(id)}`)

function answerRowOf(a: AnswerRow, q: Question): StudentAnswerRow {
  const options: StudentAnswerOption[] = (q.options ?? []).flatMap((text, i) =>
    LETTERS[i] !== undefined && text !== '' ? [{ label: LETTERS[i], text }] : [],
  )
  return {
    questionId: q.id,
    html: q.questionText,
    textPlain: stripHtml(q.questionText),
    subjectName: subjectName(a.subjectId ?? q.subjectId),
    chapterLabel: q.chapterLabel,
    source: q.sourceSet,
    difficulty: q.difficultyLevel,
    answeredAt: a.answeredAt,
    selectedLabel: letterOf(a.selectedOptionId),
    correctLabel: letterOf(q.correctAnswer),
    isCorrect: a.isCorrect,
    options,
    explanation: q.explanation === '' ? null : q.explanation,
  }
}

interface Tally {
  correct: number
  total: number
}

/** #5: null for an unknown school, or a user who is not a T4/T5 pupil (the school is not checked, BR-M11-29). */
export function studentDetail(schoolId: number, userId: number): StudentDetail | null {
  const fact = schoolFact(schoolId)
  const user = users.get(userId)
  if (!fact || !user || user.role !== 'student' || (user.grade !== 10 && user.grade !== 11)) {
    return null
  }
  // Oldest first from M05; the first-answered order drives the topic row order (see below).
  const answers = practice.answers(userId)
  const joined = answers.map((a) => ({ a, q: questions.get(a.questionId) ?? null }))
  const available = joined.filter((x): x is { a: AnswerRow; q: Question } => x.q !== null)
  const newest = [...available].sort(
    (x, y) => y.a.answeredAtMs - x.a.answeredAtMs || y.a.id - x.a.id,
  )
  const correct = answers.filter((a) => a.isCorrect).length
  const lastMs = answers.reduce((m, a) => Math.max(m, a.answeredAtMs), 0)

  // --- subjects (by answers desc, then name) ------------------------------------------------------
  const bySubject = new Map<number, Tally>()
  for (const a of answers) {
    if (a.subjectId === null) continue
    const t = bySubject.get(a.subjectId) ?? { correct: 0, total: 0 }
    t.total++
    if (a.isCorrect) t.correct++
    bySubject.set(a.subjectId, t)
  }
  const subjects = [...bySubject.entries()]
    .map(([subjectId, t]) => ({
      subjectId,
      name: subjectName(subjectId),
      correct: t.correct,
      total: t.total,
      pct: round1(percent(t.correct, t.total)),
    }))
    .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, 'ms'))

  // --- topics: by subject A→Z; rows by Bab (Umum first), then first answered ---------------------------
  interface TopicTally extends Tally {
    bab: number | null
    name: string
    first: number
  }
  const topicBySubject = new Map<number, Map<string, TopicTally>>()
  for (const { a, q } of available) {
    if (a.subjectId === null) continue
    const topic = q.curriculumTopicId === null ? undefined : curriculum.topic(q.curriculumTopicId)
    const chapter = topic ? curriculum.chapter(topic.chapterId) : undefined
    const key = topic ? String(topic.id) : 'umum'
    const subjectMap = topicBySubject.get(a.subjectId) ?? new Map<string, TopicTally>()
    const t = subjectMap.get(key) ?? {
      correct: 0,
      total: 0,
      bab: topic ? (chapter?.chapterNumber ?? null) : null,
      name: topic ? topic.name : 'Umum',
      first: a.answeredAtMs,
    }
    t.total++
    if (a.isCorrect) t.correct++
    t.first = Math.min(t.first, a.answeredAtMs)
    subjectMap.set(key, t)
    topicBySubject.set(a.subjectId, subjectMap)
  }
  const topics = [...topicBySubject.entries()]
    .map(([subjectId, map]) => ({
      subjectId,
      subjectName: subjectName(subjectId),
      rows: [...map.values()]
        .sort(
          (x, y) =>
            (x.bab ?? -1) - (y.bab ?? -1) || x.first - y.first || x.name.localeCompare(y.name),
        )
        .map((t) => {
          const pct = round1(percent(t.correct, t.total))
          return {
            bab: t.bab,
            name: t.name,
            correct: t.correct,
            total: t.total,
            pct,
            badge: badgeOf(percent(t.correct, t.total)),
          }
        }),
    }))
    .sort((x, y) => x.subjectName.localeCompare(y.subjectName, 'ms'))

  // --- rows ------------------------------------------------------------------------------------------------
  const rows = newest.map(({ a, q }) => answerRowOf(a, q))
  const wrongRows = rows.filter((r) => !r.isCorrect)

  // --- gap analysis (BR-M11-19) --------------------------------------------------------------------------
  interface GroupTally extends Tally {
    subjectName: string
  }
  const groups = new Map<string, GroupTally>()
  for (const { a, q } of available) {
    if (q.chapterLabel === null) continue
    const g = groups.get(q.chapterLabel) ?? {
      correct: 0,
      total: 0,
      subjectName: subjectName(a.subjectId ?? q.subjectId),
    }
    g.total++
    if (a.isCorrect) g.correct++
    groups.set(q.chapterLabel, g)
  }
  const gapItems = [...groups.entries()]
    .map(([group, g]) => ({ group, g, p: percent(g.correct, g.total) }))
    .filter((x) => x.p < 60)
    .sort((x, y) => x.p - y.p || x.group.localeCompare(y.group))
    .map(({ group, g, p }) => ({
      group,
      subjectName: g.subjectName,
      pct: round1(p),
      correct: g.correct,
      total: g.total,
      severity: severityOf(p),
      availableQuestions: questions.countWhere({
        chapterLabel: group,
        status: 'approved',
        isActive: true,
        pkskDomainId: null,
      }),
    }))
  const strong = [...groups.entries()]
    .map(([group, g]) => ({ group, g, p: percent(g.correct, g.total) }))
    .filter((x) => x.p >= 80)
    .sort((x, y) => x.p - y.p || x.group.localeCompare(y.group))
    .slice(0, 3)
    .map(({ group, g, p }) => ({
      group,
      subjectName: g.subjectName,
      pct: round1(p),
      answered: g.total,
    }))
  const level = curriculum.levelForGrade(user.grade)
  const untried = (level ? curriculum.subjects({ active: true, educationLevelId: level.id }) : [])
    .filter((s) => !bySubject.has(s.id))
    .map((s) => s.name)

  // --- observations (BR-M11-20) ---------------------------------------------------------------------------
  const observations: StudentDetail['observations'] = []
  for (const s of subjects) {
    const p = percent(s.correct, s.total)
    if (p >= 80) {
      observations.push({
        kind: 'strong',
        subjectName: s.name,
        pct: s.pct,
        wrong: s.total - s.correct,
        total: s.total,
      })
    } else if (p < 50) {
      observations.push({
        kind: 'weak',
        subjectName: s.name,
        pct: s.pct,
        wrong: s.total - s.correct,
        total: s.total,
      })
    }
  }

  return {
    school: { id: fact.id, name: fact.name },
    student: {
      id: user.id,
      name: user.name,
      email: user.email,
      level: levelLabelOf(user.grade),
      lastActivityAt: lastMs > 0 ? toIsoMyt(lastMs) : null,
    },
    cards: {
      answered: answers.length,
      correct,
      wrong: answers.length - correct,
      accuracy: round1(percent(correct, answers.length)),
    },
    subjects,
    topics,
    answers: { available: rows.length, total: answers.length, rows },
    wrong: {
      count: wrongRows.length,
      unique: new Set(wrongRows.map((r) => r.questionId)).size,
      rows: wrongRows,
    },
    gaps: { count: gapItems.length, items: gapItems, strong, untried },
    observations,
  }
}
