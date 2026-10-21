import type {
  LeaderboardFact,
  LeaderboardQuery,
  LeaderboardResult,
  PracticeReadPort,
  PracticeScopeQuery,
  PracticeUserTotals,
  RankingFact,
  RankingQuery,
  RankingResult,
} from '../../../../src/modules/reports/performance/ports'

export interface PracticePupil {
  id: string
  name: string
  schoolId: string | null
  schoolName: string
  state: string
  district: string
  isActive?: boolean
}

export interface PracticeSessionRow {
  userId: string
  completedAt: Date
  questionCount: number
  correctCount: number
  coins: number
  mode?: string
  subjectId?: string
  levelCode?: string
  isTest?: boolean
}

export interface PracticeAnswerRow {
  userId: string
  subjectId: string
  levelCode: string
  isCorrect: boolean
  isTest?: boolean
}

const MYT_MS = 8 * 3_600_000
const cmpId = (a: string, b: string): number => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0)

/**
 * In-memory `PracticeReadPort` with the semantics the SQL adapter must have: test rows never count, only
 * active pupils, ordering by the documented keys. Used by the unit specs and by the port-contract suite.
 */
export class InMemoryPracticeRead implements PracticeReadPort {
  private readonly pupils = new Map<string, PracticePupil>()
  private readonly sessions: PracticeSessionRow[] = []
  private readonly answers: PracticeAnswerRow[] = []

  addPupil(p: Partial<PracticePupil> & Pick<PracticePupil, 'id'>): this {
    this.pupils.set(p.id, { name: `Murid ${p.id}`, schoolId: 's1', schoolName: 'Sekolah Satu', state: 'Negeri A', district: 'Daerah A', ...p })
    return this
  }
  addSession(s: PracticeSessionRow): this {
    this.sessions.push(s)
    return this
  }
  /** `n` answers of a pupil, `correct` of them right. */
  addAnswers(userId: string, n: number, correct: number, over: Partial<PracticeAnswerRow> = {}): this {
    for (let i = 0; i < n; i++) this.answers.push({ userId, subjectId: '1', levelCode: 't4', isCorrect: i < correct, ...over })
    return this
  }

  private active(userId: string): PracticePupil | null {
    const p = this.pupils.get(userId)
    return p && p.isActive !== false ? p : null
  }

  private geoOk(p: PracticePupil, q: PracticeScopeQuery): boolean {
    if (q.userIds && !q.userIds.includes(p.id)) return false
    if (q.schoolIds && (p.schoolId === null || !q.schoolIds.includes(p.schoolId))) return false
    if (q.state !== undefined && p.state !== q.state) return false
    if (q.district !== undefined && p.district !== q.district) return false
    return true
  }

  async userTotals(q: PracticeScopeQuery): Promise<PracticeUserTotals[]> {
    const by = new Map<string, PracticeUserTotals>()
    for (const s of this.sessions) {
      const p = this.active(s.userId)
      if (!p || s.isTest === true || !this.geoOk(p, q)) continue
      if (q.subjectId !== undefined && s.subjectId !== q.subjectId) continue
      if (q.levelCode !== undefined && s.levelCode !== q.levelCode) continue
      if (q.modes && q.modes.length > 0 && !q.modes.includes(s.mode ?? '')) continue
      if (q.from && s.completedAt < q.from) continue
      if (q.to && s.completedAt >= q.to) continue
      const t = by.get(s.userId) ?? { userId: s.userId, sessions: 0, questions: 0, correct: 0, coins: 0 }
      t.sessions += 1
      t.questions += s.questionCount
      t.correct += s.correctCount
      t.coins += s.coins
      by.set(s.userId, t)
    }
    return [...by.values()].sort((a, b) => cmpId(a.userId, b.userId))
  }

  async practiceDays(userId: string): Promise<string[]> {
    const days = new Set<string>()
    for (const s of this.sessions) {
      if (s.userId === userId && s.isTest !== true && this.active(userId)) days.add(new Date(s.completedAt.getTime() + MYT_MS).toISOString().slice(0, 10))
    }
    return [...days].sort()
  }

  private ranked(q: RankingQuery, geo: boolean, dims: boolean): RankingFact[] {
    const by = new Map<string, { correct: number; answered: number }>()
    for (const a of this.answers) {
      const p = this.active(a.userId)
      if (!p || a.isTest === true) continue
      if (geo && !this.geoOk(p, q)) continue
      if (dims && q.subjectId !== undefined && a.subjectId !== q.subjectId) continue
      if (dims && q.levelCode !== undefined && a.levelCode !== q.levelCode) continue
      const t = by.get(a.userId) ?? { correct: 0, answered: 0 }
      t.answered += 1
      if (a.isCorrect) t.correct += 1
      by.set(a.userId, t)
    }
    return [...by.entries()]
      .filter(([, t]) => t.answered >= q.minAnswers)
      .map(([userId, t]) => {
        const p = this.pupils.get(userId) as PracticePupil
        return { userId, name: p.name, schoolId: p.schoolId, schoolName: p.schoolName, state: p.state, correct: t.correct, answered: t.answered }
      })
      .sort((a, b) => b.correct - a.correct || b.correct / b.answered - a.correct / a.answered || cmpId(a.userId, b.userId))
  }

  async rankingRows(q: RankingQuery): Promise<RankingResult> {
    const all = this.ranked(q, true, true)
    const states = new Map<string, number>()
    for (const r of this.ranked(q, false, true)) states.set(r.state, (states.get(r.state) ?? 0) + 1)
    return {
      rows: all.slice(0, Math.max(0, q.limit)),
      total: all.length,
      states: [...states].map(([state, pupils]) => ({ state, pupils })).sort((a, b) => a.state.localeCompare(b.state)),
      scopePupils: this.ranked(q, true, false).length,
    }
  }

  async leaderboard(q: LeaderboardQuery): Promise<LeaderboardResult> {
    const by = new Map<string, { coins: number; sessions: number; acc: number[] }>()
    for (const s of this.sessions) {
      if (s.isTest === true || !this.active(s.userId)) continue
      if (s.completedAt >= q.to || (q.from && s.completedAt < q.from)) continue
      const t = by.get(s.userId) ?? { coins: 0, sessions: 0, acc: [] }
      t.coins += s.coins
      t.sessions += 1
      if (s.questionCount > 0) t.acc.push((s.correctCount / s.questionCount) * 100)
      by.set(s.userId, t)
    }
    const facts: LeaderboardFact[] = [...by.entries()]
      .map(([userId, t]) => ({
        userId,
        name: (this.pupils.get(userId) as PracticePupil).name,
        coins: t.coins,
        sessions: t.sessions,
        accuracy: t.acc.length === 0 ? 0 : t.acc.reduce((a, b) => a + b, 0) / t.acc.length,
      }))
      .sort((a, b) => b.coins - a.coins || b.accuracy - a.accuracy || cmpId(a.userId, b.userId))
    const idx = facts.findIndex((f) => f.userId === q.viewerId)
    const mine = idx === -1 ? undefined : (facts[idx] as LeaderboardFact)
    return { rows: facts.slice(0, q.limit), me: mine ? { ...mine, rank: idx + 1 } : null }
  }
}
