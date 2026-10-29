import { Inject, Injectable } from '@nestjs/common'

import { startOfMytDay } from '../../../db/clock'
import { idFromString } from '../../../db/ids'
import { CurriculumRepository } from '../../curriculum'
import type { PracticeDayFacts, PracticeFactsProvider, PracticeMasteryFact } from '../../gamification/ports'
import { PracticeRepository } from '../../practice'

const DAY_MS = 24 * 60 * 60 * 1000

/** BR-M14-16: "kuiz" achievements count the practice modes only. */
export const ACHIEVEMENT_PRACTICE_MODES = ['random', 'chapter', 'revision'] as const

/** All modes (share cards count every completed session). */
const ALL_MODES = ['random', 'chapter', 'revision', 'mission', 'remedial', 'question_set', 'past_year', 'latih_tubi', 'ramalan', 'pksk'] as const

/**
 * M14 `PracticeFactsProvider` over the M05 owner's read doorway (`PracticeRepository`; the gamification module never
 * queries the practice tables itself). Plugged into `GamificationPorts` by `BijakIntegrationModule`.
 */
@Injectable()
export class PracticeFactsAdapter implements PracticeFactsProvider {
  constructor(
    @Inject(PracticeRepository) private readonly practice: PracticeRepository,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
  ) {}

  /** `date` is a Malaysia day `YYYY-MM-DD`; the window is [00:00, 24:00) +08:00. */
  async dayFacts(userId: string, date: string): Promise<PracticeDayFacts> {
    const from = startOfMytDay(new Date(`${date}T12:00:00+08:00`))
    const to = new Date(from.getTime() + DAY_MS)
    const facts = await this.practice.dayFacts(userId, from, to)
    return {
      sessions: facts.sessions.map((s) => ({ sessionId: s.id, mode: s.mode, correct: s.correctCount, total: s.questionCount, timeSpent: s.timeSpentSec })),
      chapterIds: facts.chapterIds,
    }
  }

  async mastery(userId: string): Promise<readonly PracticeMasteryFact[]> {
    const rows = await this.practice.mastery(userId)
    if (rows.length === 0) return []
    const subjects = new Map((await this.curriculum.subjects()).map((s, i) => [s.id, { name: s.name, order: i }]))
    return rows.flatMap((m) => {
      const subject = subjects.get(idFromString(m.subjectId))
      return subject ? [{ subjectId: m.subjectId, subjectName: subject.name, subjectOrder: subject.order, correct: m.correct, answered: m.answered }] : []
    })
  }

  async sessionCounts(userId: string): Promise<{ all: number; practice: number }> {
    const [all, practice] = await Promise.all([
      this.practice.historyCount(userId, { modes: ALL_MODES }),
      this.practice.historyCount(userId, { modes: ACHIEVEMENT_PRACTICE_MODES }),
    ])
    return { all, practice }
  }

  async accurateSessions(userId: string, minPct: number): Promise<number> {
    return this.practice.accurateSessionCount(userId, { modes: ACHIEVEMENT_PRACTICE_MODES, minPct })
  }
}
