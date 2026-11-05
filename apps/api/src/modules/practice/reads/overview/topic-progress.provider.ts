import { Inject, Injectable } from '@nestjs/common'

import type { TopicProgress, TopicProgressProvider } from '../../../curriculum'
import { OverviewRepository } from './overview.repository'
import { topicProgressPercent } from './rules'

/**
 * M03 topic progress (BR-19, DATA-M03-07), derived on read from the answer log's dimension columns. Registered
 * with `CurriculumPorts.provideTopicProgress` in `PracticeOverviewReadsModule.onModuleInit`.
 *
 * The learner topic is the chapter itself (S4-T06: Topik and Peta Belajar read chapters), keyed by chapter id.
 * Its figures are every answer row whose `chapter_id` is that chapter:
 * `questionsAnswered` = rows, `sessions` = distinct sessions, `progress` = min(100, round(100 x correct / 20)).
 * No join to `questions`, so a historical row without a question link counts the same (card AC2). The
 * island states (BR-14) are computed by M03 from these numbers.
 */
@Injectable()
export class OverviewTopicProgress implements TopicProgressProvider {
  constructor(
    @Inject(OverviewRepository) private readonly repo: OverviewRepository,
  ) {}

  async topicProgress(userId: string): Promise<ReadonlyMap<string, TopicProgress>> {
    const totals = await this.repo.chapterTotals(userId)
    const out = new Map<string, TopicProgress>()
    // S4-T06: the learner topic IS the chapter (Topik / Peta Belajar read chapters), so the key is the chapter id.
    for (const [chapterId, stats] of totals) {
      out.set(chapterId, { sessions: stats.sessions, questionsAnswered: stats.answered, progress: topicProgressPercent(stats.correct) })
    }
    return out
  }
}
