import type {
  AnswerFactRow,
  AnswerFactsPort,
  AnswerFactsQuery,
  SessionCountRow,
  SpInfo,
  WeeklyFactRow,
} from '../../../../src/modules/reports/performance/ports'

/** One stored answer, as the single store holds it (`practice_answers`, with its `mode`). */
export interface AnswerRow {
  userId: string
  subjectId?: string
  questionId?: string
  chapterId?: string | null
  topicId?: string | null
  levelCode?: string
  mode: string
  isCorrect: boolean
  answeredAt: Date
  sessionId?: string | null
  isTest?: boolean
}

export interface AnswerPupil {
  id: string
  schoolId?: string | null
  classroomIds?: readonly string[]
}

const MYT_MS = 8 * 3_600_000
const DAY_MS = 86_400_000
const mytDayOf = (at: Date): string => new Date(at.getTime() + MYT_MS).toISOString().slice(0, 10)
/** Monday of the MYT week of `at` (YYYY-MM-DD). */
function mondayOf(at: Date): string {
  const day = Date.parse(`${mytDayOf(at)}T00:00:00Z`)
  const dow = new Date(day).getUTCDay() // 0 = Sunday
  return new Date(day - ((dow + 6) % 7) * DAY_MS).toISOString().slice(0, 10)
}
const cmp = (a: string, b: string): number => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)

/**
 * In-memory `AnswerFactsPort` with the semantics the SQL adapter must have: test rows never count, one row per
 * (user, subject, question, chapter, topic, mode), Monday weeks in Asia/Kuala_Lumpur, a session is a distinct
 * session id and a sessionless answer is one session per mode per MYT day. Used by the unit specs and the contract suite.
 */
export class InMemoryAnswerFacts implements AnswerFactsPort {
  private readonly pupils = new Map<string, AnswerPupil>()
  private readonly answers: AnswerRow[] = []
  private readonly topics = new Map<string, { name: string; chapterId: string }>()
  private readonly chapters = new Map<string, { name: string | null; dskpCode: string | null; subjectCode: string; levelId: string | null }>()

  addPupil(p: AnswerPupil): this {
    this.pupils.set(p.id, p)
    return this
  }
  addChapter(id: string, c: { name?: string | null; dskpCode?: string | null; subjectCode: string; levelId?: string | null }): this {
    this.chapters.set(id, { name: c.name ?? null, dskpCode: c.dskpCode ?? null, subjectCode: c.subjectCode, levelId: c.levelId ?? null })
    return this
  }
  addTopic(id: string, t: { name: string; chapterId: string }): this {
    this.topics.set(id, t)
    return this
  }
  add(a: AnswerRow): this {
    this.answers.push(a)
    return this
  }
  /** `n` answers of one pupil, `correct` of them right (distinct questions q1.. unless `questionId` is given). */
  addMany(userId: string, n: number, correct: number, over: Partial<AnswerRow> & Pick<AnswerRow, 'mode' | 'answeredAt'>): this {
    for (let i = 0; i < n; i++) this.answers.push({ userId, questionId: `q${String(i + 1)}`, isCorrect: i < correct, ...over })
    return this
  }

  private pick(q: AnswerFactsQuery): AnswerRow[] {
    if (q.modes && q.modes.length === 0) return []
    return this.answers.filter((a) => {
      if (a.isTest === true) return false
      if (q.userIds && !q.userIds.includes(a.userId)) return false
      const p = this.pupils.get(a.userId)
      if (q.schoolIds && (!p?.schoolId || !q.schoolIds.includes(p.schoolId))) return false
      if (q.classroomId !== undefined && !(p?.classroomIds ?? []).includes(q.classroomId)) return false
      if (q.subjectId !== undefined && (a.subjectId ?? '0') !== q.subjectId) return false
      if (q.levelCode !== undefined && (a.levelCode ?? '') !== q.levelCode) return false
      if (q.modes && !q.modes.includes(a.mode)) return false
      if (q.from && a.answeredAt < q.from) return false
      if (q.to && a.answeredAt >= q.to) return false
      return true
    })
  }

  async answerFacts(q: AnswerFactsQuery): Promise<AnswerFactRow[]> {
    const by = new Map<string, AnswerFactRow>()
    for (const a of this.pick(q)) {
      const row = {
        userId: a.userId,
        subjectId: a.subjectId ?? '0',
        questionId: a.questionId ?? '0',
        chapterId: a.chapterId ?? null,
        topicId: a.topicId ?? null,
        mode: a.mode,
      }
      const key = JSON.stringify(row)
      const t = by.get(key) ?? { ...row, attempts: 0, correct: 0, lastAnsweredAt: a.answeredAt }
      t.attempts += 1
      if (a.isCorrect) t.correct += 1
      if (a.answeredAt > t.lastAnsweredAt) t.lastAnsweredAt = a.answeredAt
      by.set(key, t)
    }
    return [...by.values()].sort((x, y) => cmp(x.userId, y.userId) || cmp(x.subjectId, y.subjectId) || cmp(x.questionId, y.questionId))
  }

  async weeklyFacts(q: AnswerFactsQuery): Promise<WeeklyFactRow[]> {
    const by = new Map<string, { userId: string; weekStart: string; attempts: number; correct: number; sessions: Set<string> }>()
    for (const a of this.pick(q)) {
      const weekStart = mondayOf(a.answeredAt)
      const key = `${a.userId}|${weekStart}`
      const t = by.get(key) ?? { userId: a.userId, weekStart, attempts: 0, correct: 0, sessions: new Set<string>() }
      t.attempts += 1
      if (a.isCorrect) t.correct += 1
      t.sessions.add(a.sessionId ? `s:${a.sessionId}` : `n:${a.mode}:${mytDayOf(a.answeredAt)}`)
      by.set(key, t)
    }
    return [...by.values()]
      .map((t) => ({ userId: t.userId, weekStart: t.weekStart, attempts: t.attempts, correct: t.correct, sessions: t.sessions.size }))
      .sort((x, y) => cmp(x.userId, y.userId) || (x.weekStart < y.weekStart ? -1 : 1))
  }

  async sessionCounts(q: AnswerFactsQuery): Promise<SessionCountRow[]> {
    const total = new Map<string, Set<string>>()
    const per = new Map<string, Set<string>>()
    for (const a of this.pick(q)) {
      const k = a.sessionId ? `s:${a.sessionId}` : `n:${a.mode}:${mytDayOf(a.answeredAt)}`
      const add = (m: Map<string, Set<string>>, key: string) => m.set(key, (m.get(key) ?? new Set<string>()).add(k))
      add(total, a.userId)
      add(per, `${a.userId}|${a.subjectId ?? '0'}`)
    }
    return [
      ...[...total].map(([userId, set]) => ({ userId, subjectId: null, sessions: set.size })),
      ...[...per].map(([key, set]) => {
        const [userId, subjectId] = key.split('|') as [string, string]
        return { userId, subjectId, sessions: set.size }
      }),
    ]
  }

  async spInfo(q: { topicIds: readonly string[]; chapterIds: readonly string[] }): Promise<SpInfo[]> {
    const out: SpInfo[] = []
    for (const id of q.topicIds) {
      const t = this.topics.get(id)
      const c = t ? this.chapters.get(t.chapterId) : undefined
      if (t && c) out.push({ id, kind: 'topic', label: t.name, code: c.dskpCode, subjectCode: c.subjectCode, levelId: c.levelId })
    }
    for (const id of q.chapterIds) {
      const c = this.chapters.get(id)
      if (c) out.push({ id, kind: 'chapter', label: c.name ?? '', code: null, subjectCode: c.subjectCode, levelId: c.levelId })
    }
    return out
  }
}
