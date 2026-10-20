import { Inject, Injectable } from '@nestjs/common'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { ClassesRepository } from '../../../classes'
import { type AnswerFact, AnalyticsRepository, type QuestionFact } from '../analytics.repository'
import { badgeOf, compareIds, levelLabelOf, percent, round1, severityOf, stripHtml } from '../domain/rules'
import type { StudentAnswerRow, StudentDetail } from '../types'
import { type Ctx, isSchoolForced } from './scope'

const LABELS = ['A', 'B', 'C', 'D'] as const
type Label = (typeof LABELS)[number]
const labelOf = (raw: string | null): Label | null => {
  const l = (raw ?? '').trim().toUpperCase()
  return (LABELS as readonly string[]).includes(l) ? (l as Label) : null
}

const notFound = (): never => {
  throw ApiError.of('NOT_FOUND')
}

interface Tally {
  correct: number
  total: number
}

/** S4 pupil detail (BR-M11-19 to 23): the pupil's answer log joined with the question bank and the curriculum. */
@Injectable()
export class StudentDetailService {
  constructor(
    @Inject(AnalyticsRepository) private readonly repo: AnalyticsRepository,
    @Inject(ClassesRepository) private readonly classes: ClassesRepository,
  ) {}

  /**
   * A forced role must own the school and the pupil; the admin's school segment is not validated against the pupil
   * (BR-M11-29). Unknown ids, a user who is not a T4/T5 pupil and (for a forced role) a pupil of another school are 404.
   * A pupil without answers returns the empty state, never a 404.
   */
  async detail(ctx: Ctx, schoolId: string, userId: string): Promise<StudentDetail> {
    if (isSchoolForced(ctx.role) && ctx.schoolId !== schoolId) return notFound()
    const fact = await this.repo.school(schoolId)
    if (!fact) return notFound()
    const user = await this.repo.user(userId)
    if (!user || !user.isStudent || (user.grade !== 10 && user.grade !== 11)) return notFound()
    if (isSchoolForced(ctx.role) && user.schoolId !== ctx.schoolId) return notFound()
    // A teacher opens only pupils of the own active classes (data minimisation); the same 404 as an unknown id.
    if (ctx.role === 'teacher' && !(await this.classes.teacherStudentIds(ctx.userId)).includes(user.id)) return notFound()

    const answers = await this.repo.answersOf(user.id)
    const facts = await this.repo.questionFacts(
      answers.flatMap((a) => (a.questionId === null ? [] : [{ questionId: a.questionId, versionNo: a.versionNo }])),
    )
    const joined = answers.map((a) => ({ a, q: a.questionId === null ? null : (facts.get(`${a.questionId}:${a.versionNo ?? ''}`) ?? null) }))
    const available = joined.filter((x): x is { a: AnswerFact; q: QuestionFact } => x.q !== null)

    const subjectIds = new Set<string>()
    const chapterIds = new Set<string>()
    const topicIds = new Set<string>()
    for (const { a, q } of joined) {
      const s = a.subjectId ?? q?.subjectId
      if (s) subjectIds.add(s)
      const c = a.chapterId ?? q?.chapterId
      if (c) chapterIds.add(c)
      const t = a.topicId ?? q?.topicId
      if (t) topicIds.add(t)
    }
    const topics = await this.repo.topics([...topicIds])
    for (const t of topics.values()) chapterIds.add(t.chapterId)
    const [subjectNames, chapters, grade] = await Promise.all([
      this.repo.subjectNames([...subjectIds]),
      this.repo.chapters([...chapterIds]),
      this.repo.subjectsOfGrade(user.grade),
    ])
    const subjectName = (id: string | null): string => (id === null ? '' : (subjectNames.get(id) ?? `Subjek ${id}`))
    const chapterLabel = (a: AnswerFact, q: QuestionFact | null): string | null => {
      const id = a.chapterId ?? q?.chapterId ?? null
      const name = id === null ? '' : (chapters.get(id)?.name ?? '')
      return name === '' ? null : name
    }

    const correct = answers.filter((a) => a.isCorrect).length
    const lastMs = answers.reduce((m, a) => Math.max(m, a.answeredAt.getTime()), 0)

    // --- subjects (answers desc, then name) -------------------------------------------------------------------
    const bySubject = new Map<string, Tally>()
    for (const a of answers) {
      if (a.subjectId === null) continue
      const t = bySubject.get(a.subjectId) ?? { correct: 0, total: 0 }
      t.total++
      if (a.isCorrect) t.correct++
      bySubject.set(a.subjectId, t)
    }
    const subjects = [...bySubject.entries()]
      .map(([subjectId, t]) => ({ subjectId, name: subjectName(subjectId), correct: t.correct, total: t.total, pct: round1(percent(t.correct, t.total)) }))
      .sort((x, y) => y.total - x.total || x.name.localeCompare(y.name, 'ms'))

    // --- topics: by subject A to Z; rows by Bab (Umum first), then first answered --------------------------------------
    interface TopicTally extends Tally {
      bab: number | null
      name: string
      first: number
    }
    const topicBySubject = new Map<string, Map<string, TopicTally>>()
    for (const { a, q } of available) {
      if (a.subjectId === null) continue
      const topicId = a.topicId ?? q.topicId
      const topic = topicId === null ? undefined : topics.get(topicId)
      const chapter = topic ? chapters.get(topic.chapterId) : undefined
      const key = topic && topicId !== null ? topicId : 'umum'
      const map = topicBySubject.get(a.subjectId) ?? new Map<string, TopicTally>()
      const t = map.get(key) ?? { correct: 0, total: 0, bab: topic ? (chapter?.number ?? null) : null, name: topic ? topic.name : 'Umum', first: a.answeredAt.getTime() }
      t.total++
      if (a.isCorrect) t.correct++
      t.first = Math.min(t.first, a.answeredAt.getTime())
      map.set(key, t)
      topicBySubject.set(a.subjectId, map)
    }
    const topicsOut = [...topicBySubject.entries()]
      .map(([subjectId, map]) => ({
        subjectId,
        subjectName: subjectName(subjectId),
        rows: [...map.values()]
          .sort((x, y) => (x.bab ?? -1) - (y.bab ?? -1) || x.first - y.first || x.name.localeCompare(y.name))
          .map((t) => ({
            bab: t.bab,
            name: t.name,
            correct: t.correct,
            total: t.total,
            pct: round1(percent(t.correct, t.total)),
            badge: badgeOf(percent(t.correct, t.total)),
          })),
      }))
      .sort((x, y) => x.subjectName.localeCompare(y.subjectName, 'ms'))

    // --- rows (newest first) ----------------------------------------------------------------------------------------
    const newest = [...available].sort((x, y) => y.a.answeredAt.getTime() - x.a.answeredAt.getTime() || compareIds(y.a.id, x.a.id))
    const rows: StudentAnswerRow[] = newest.map(({ a, q }) => ({
      questionId: q.questionId,
      html: q.stem,
      textPlain: stripHtml(q.stem),
      subjectName: subjectName(a.subjectId ?? q.subjectId),
      chapterLabel: chapterLabel(a, q),
      source: q.source,
      difficulty: a.difficulty ?? q.difficulty ?? 0,
      answeredAt: toMytTimestamp(a.answeredAt),
      selectedLabel: labelOf(a.selectedLabel),
      correctLabel: labelOf(q.correctLabel),
      isCorrect: a.isCorrect,
      options: q.options.flatMap((o) => {
        const label = labelOf(o.label)
        return label !== null && o.text !== '' ? [{ label, text: o.text }] : []
      }),
      explanation: q.explanation,
    }))
    const wrongRows = rows.filter((r) => !r.isCorrect)

    // --- gap analysis (BR-M11-19) ---------------------------------------------------------------------------------------
    interface GroupTally extends Tally {
      subjectName: string
      chapterIds: Set<string>
    }
    const groups = new Map<string, GroupTally>()
    for (const { a, q } of available) {
      const label = chapterLabel(a, q)
      if (label === null) continue
      const g = groups.get(label) ?? { correct: 0, total: 0, subjectName: subjectName(a.subjectId ?? q.subjectId), chapterIds: new Set<string>() }
      g.total++
      if (a.isCorrect) g.correct++
      const cid = a.chapterId ?? q.chapterId
      if (cid) g.chapterIds.add(cid)
      groups.set(label, g)
    }
    const weak = [...groups.entries()]
      .map(([group, g]) => ({ group, g, p: percent(g.correct, g.total) }))
      .filter((x) => x.p < 60)
      .sort((x, y) => x.p - y.p || x.group.localeCompare(y.group))
    const availableByChapter = await this.repo.availableByChapter(weak.flatMap((w) => [...w.g.chapterIds]))
    const gapItems = weak.map(({ group, g, p }) => ({
      group,
      subjectName: g.subjectName,
      pct: round1(p),
      correct: g.correct,
      total: g.total,
      severity: severityOf(p),
      availableQuestions: [...g.chapterIds].reduce((n, id) => n + (availableByChapter.get(id) ?? 0), 0),
    }))
    const strong = [...groups.entries()]
      .map(([group, g]) => ({ group, g, p: percent(g.correct, g.total) }))
      .filter((x) => x.p >= 80)
      .sort((x, y) => x.p - y.p || x.group.localeCompare(y.group))
      .slice(0, 3)
      .map(({ group, g, p }) => ({ group, subjectName: g.subjectName, pct: round1(p), answered: g.total }))
    const untried = grade.filter((s) => !bySubject.has(s.id)).map((s) => s.name)

    // --- observations (BR-M11-20) ------------------------------------------------------------------------------------------
    const observations: StudentDetail['observations'] = []
    for (const s of subjects) {
      const p = percent(s.correct, s.total)
      if (p >= 80) observations.push({ kind: 'strong', subjectName: s.name, pct: s.pct, wrong: s.total - s.correct, total: s.total })
      else if (p < 50) observations.push({ kind: 'weak', subjectName: s.name, pct: s.pct, wrong: s.total - s.correct, total: s.total })
    }

    return {
      school: { id: fact.id, name: fact.name },
      student: { id: user.id, name: user.name, email: user.email, level: levelLabelOf(user.grade), lastActivityAt: lastMs > 0 ? toMytTimestamp(new Date(lastMs)) : null },
      cards: { answered: answers.length, correct, wrong: answers.length - correct, accuracy: round1(percent(correct, answers.length)) },
      subjects,
      topics: topicsOut,
      answers: { available: rows.length, total: answers.length, rows },
      wrong: { count: wrongRows.length, unique: new Set(wrongRows.map((r) => r.questionId)).size, rows: wrongRows },
      gaps: { count: gapItems.length, items: gapItems, strong, untried },
      observations,
    }
  }
}
