import type { BankCell } from './overview.repository'
import { DIFFICULTY_LEVELS, difficultyLevelOfTp, round } from './rules'

export type DifficultyCounts = Record<'1' | '2' | '3' | '4' | '5', number>

const emptyCounts = (): DifficultyCounts => ({ '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 })

/**
 * The named counts of the M04 bank the overview screens show (M04 section 4.1), derived in memory from the
 * grouped cells of `OverviewRepository.bankMatrix`. A question with no TP reads as difficulty 1 (the
 * projection default); a question without a subject or level never enters a subject or level figure.
 */
export class BankFacts {
  constructor(private readonly cells: readonly BankCell[]) {}

  /** Q-ACTIVE and Q-ELIGIBLE (the same set in v2), optionally narrowed. */
  count(where: { subjectId?: string; levelId?: string; mcq?: boolean } = {}): number {
    let n = 0
    for (const c of this.cells) {
      if (where.subjectId !== undefined && c.subjectId !== where.subjectId) continue
      if (where.levelId !== undefined && c.levelId !== where.levelId) continue
      if (where.mcq !== undefined && c.mcq !== where.mcq) continue
      n += c.n
    }
    return n
  }

  /** Q-PRACTICE: eligible objective questions of a subject over the given levels. */
  practice(subjectId: string, levelIds: readonly string[]): number {
    const set = new Set(levelIds)
    return this.cells.reduce((n, c) => (c.mcq && c.subjectId === subjectId && c.levelId !== null && set.has(c.levelId) ? n + c.n : n), 0)
  }

  /** Q-PRACTICE split by difficulty 1 to 5 (TP 6 counts as 5) over the given levels (BR-12). */
  practiceByDifficulty(subjectId: string, levelIds: readonly string[]): DifficultyCounts {
    const set = new Set(levelIds)
    const out = emptyCounts()
    for (const c of this.cells) {
      if (!c.mcq || c.subjectId !== subjectId || c.levelId === null || !set.has(c.levelId)) continue
      out[String(difficultyLevelOfTp(c.tp ?? 1)) as keyof DifficultyCounts] += c.n
    }
    return out
  }

  /** Q-DIFFICULTY(d) over the whole bank, d = 1 to 5. */
  difficultyChart(): { level: number; count: number }[] {
    const out = emptyCounts()
    for (const c of this.cells) out[String(difficultyLevelOfTp(c.tp ?? 1)) as keyof DifficultyCounts] += c.n
    return DIFFICULTY_LEVELS.map((level) => ({ level, count: out[String(level) as keyof DifficultyCounts] }))
  }

  /** BR-29: mean difficulty level of a subject's questions, 2 decimals (0 when none). */
  averageDifficulty(subjectId: string): number {
    let n = 0
    let sum = 0
    for (const c of this.cells) {
      if (c.subjectId !== subjectId) continue
      n += c.n
      sum += c.n * difficultyLevelOfTp(c.tp ?? 1)
    }
    return n === 0 ? 0 : round(sum / n, 2)
  }
}
