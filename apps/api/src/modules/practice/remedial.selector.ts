import { Inject, Injectable } from '@nestjs/common'

import { PracticePorts, type PracticeQuestion } from './ports'
import { PracticeRepository } from './practice.repository'
import { REVISION_LENGTH } from './rules'

/** A group (topic, else chapter) needs this many answers before it counts as a weak topic (R7). */
export const REMEDIAL_MIN_TOPIC_ATTEMPTS = 2
/** How many candidate ids the top-up reads before the servable filter. */
const TOPUP_CANDIDATES = 400

export interface RemedialDrill {
  /** The questions to serve, in order: the servable wrong questions first, then the top-up. At most `REVISION_LENGTH`. */
  served: PracticeQuestion[]
  /** Servable questions whose latest answer is wrong (the whole queue, not capped). */
  totalWrong: number
}

/**
 * S5-T07 (R1-MUR-12, FR-MUR-12-7): the ONE selection rule of the auto revision drill. The start planner serves it and the
 * remedial suggestions list a subject only when it yields at least one question (FD-MUR-36), so a card and its drill agree.
 * Rule: the pupil's servable wrong questions first (BR-14 order of the revision queue), then, while fewer than 20, a top-up
 * from the subject's weakest topics (never-correct questions first, then the oldest last answer), no duplicates.
 */
@Injectable()
export class RemedialSelector {
  constructor(
    @Inject(PracticeRepository) private readonly repo: PracticeRepository,
    @Inject(PracticePorts) private readonly ports: PracticePorts,
  ) {}

  async select(userId: string, subjectId: string): Promise<RemedialDrill> {
    const queue = await this.repo.queue(userId, { subjectId })
    // XL-19: only questions eligible for practice are served and counted.
    const wrongLive = await this.ports.questions.live(queue.map((q) => q.questionId))
    const wrong = queue.map((q) => wrongLive.get(q.questionId)).filter((q): q is PracticeQuestion => q !== undefined)
    const served = wrong.slice(0, REVISION_LENGTH)
    if (served.length < REVISION_LENGTH) {
      const taken = new Set(wrong.map((q) => q.id))
      const candidates = (await this.repo.weakTopicQuestionIds(userId, subjectId, REMEDIAL_MIN_TOPIC_ATTEMPTS, TOPUP_CANDIDATES)).filter(
        (id) => !taken.has(id),
      )
      if (candidates.length > 0) {
        const live = await this.ports.questions.live(candidates)
        for (const id of candidates) {
          if (served.length >= REVISION_LENGTH) break
          const q = live.get(id)
          if (q && !taken.has(id)) {
            taken.add(id)
            served.push(q)
          }
        }
      }
    }
    return { served, totalWrong: wrong.length }
  }
}
