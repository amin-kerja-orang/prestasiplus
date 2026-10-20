/**
 * Port of the heatmap read model (BE-48): where the per-chapter answer counts come from. Same holder pattern
 * as `PracticePorts` / `CurriculumPorts`: the default reads BE-12's exported `PracticeRepository.answers`
 * (the only doorway to `practice_answers`, dimension columns only, never a join to `questions`) and groups
 * them by `chapter_id` in memory. BE-13 (PR #53, not merged when BE-48 was built) adds the SQL
 * `PracticeAnalyticsRepository.chapterAnswerCounts(userId, minAttempts)`; the LEAD may plug an adapter over
 * it here (`provideAnswerCounts`) once both merge, without touching the service. Registering twice throws.
 */
import { Inject, Injectable } from '@nestjs/common'

import { PracticeRepository } from '../practice'
import type { ChapterCount } from './heatmap.rules'

export interface HeatmapAnswerCounts {
  /**
   * The caller's own answers that have a chapter, grouped by `chapter_id`, chapters with at least
   * `minAttempts` answers, ascending chapter id. `isTest` selects the rows of the caller's mode: real mode
   * reads `is_test = false` only; Mod Pelajar reads its own `is_test = true` rows only (card open question 3).
   */
  chapterAnswerCounts(userId: string, minAttempts: number, isTest: boolean): Promise<ChapterCount[]>
}

/** Default: BE-12 `PracticeRepository.answers`, grouped in memory. */
export class PracticeLogAnswerCounts implements HeatmapAnswerCounts {
  constructor(private readonly practice: PracticeRepository) {}

  async chapterAnswerCounts(userId: string, minAttempts: number, isTest: boolean): Promise<ChapterCount[]> {
    const min = Math.max(1, Math.trunc(minAttempts))
    const rows = await this.practice.answers(userId, { includeTest: isTest })
    const byChapter = new Map<string, ChapterCount>()
    for (const a of rows) {
      if (a.chapterId === null || a.isTest !== isTest) continue
      let row = byChapter.get(a.chapterId)
      if (!row) {
        row = { chapterId: a.chapterId, attempts: 0, correct: 0 }
        byChapter.set(a.chapterId, row)
      }
      row.attempts += 1
      if (a.isCorrect) row.correct += 1
    }
    return [...byChapter.values()]
      .filter((r) => r.attempts >= min)
      .sort((a, b) => {
        const x = BigInt(a.chapterId)
        const y = BigInt(b.chapterId)
        return x < y ? -1 : x > y ? 1 : 0
      })
  }
}

@Injectable()
export class HeatmapPorts {
  private source: HeatmapAnswerCounts
  private provided = false

  constructor(@Inject(PracticeRepository) practice: PracticeRepository) {
    this.source = new PracticeLogAnswerCounts(practice)
  }

  get answerCounts(): HeatmapAnswerCounts {
    return this.source
  }

  provideAnswerCounts(source: HeatmapAnswerCounts): void {
    if (this.provided) throw new Error('HeatmapPorts: answer counts already provided')
    this.source = source
    this.provided = true
  }
}
