import { Inject, Injectable } from '@nestjs/common'
import { KIRKPATRICK_MESSAGES } from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { CLOCK, type Clock, mytDay } from '../../../../db/clock'
import { toMytTimestamp } from '../../../../common/time/myt'
import { KirkpatrickRepository } from '../kirkpatrick.repository'
import type { KirkpatrickFeedbackRequest, KirkpatrickFeedbackResponse, KirkpatrickFeedbackStatus } from '../types'
import type { Ctx } from './scope'

const whole = (v: number | string): number => (typeof v === 'number' ? v : Number(v.trim()))

const errorCode = (e: unknown): string | undefined =>
  typeof e === 'object' && e !== null && typeof (e as { code?: unknown }).code === 'string' ? (e as { code: string }).code : undefined

/** Monthly NPS and satisfaction (M12 level 1). Free text is not collected, so nothing here is sensitive. */
@Injectable()
export class FeedbackService {
  constructor(
    @Inject(KirkpatrickRepository) private readonly repo: KirkpatrickRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** The calendar month in Malaysia time, `YYYY-MM`. */
  private month(): string {
    return mytDay(this.clock.now()).slice(0, 7)
  }

  async status(ctx: Ctx): Promise<KirkpatrickFeedbackStatus> {
    const month = this.month()
    return { month, answered: await this.repo.feedbackAnswered(ctx.userId, month, ctx.isTest) }
  }

  /**
   * One response per user per month (BR-M12-32): a second gives 409 CONFLICT. The role and the school are the
   * session's (the school is the account's school at response time), never the body's.
   */
  async submit(ctx: Ctx, body: KirkpatrickFeedbackRequest): Promise<KirkpatrickFeedbackResponse> {
    const month = this.month()
    const conflict = (): ApiError => ApiError.of('CONFLICT', { message: KIRKPATRICK_MESSAGES.feedbackConflict })
    if (await this.repo.feedbackAnswered(ctx.userId, month, ctx.isTest)) throw conflict()
    const schoolId = ctx.schoolId ?? (await this.repo.schoolOfUser(ctx.userId))
    try {
      const row = await this.repo.insertFeedback({
        userId: ctx.userId,
        role: ctx.role,
        schoolId,
        month,
        nps: whole(body.nps),
        satisfaction: whole(body.satisfaction),
        isTest: ctx.isTest,
        now: this.clock.now(),
      })
      return {
        id: row.id,
        userId: row.userId,
        role: row.role,
        schoolId: row.schoolId,
        month: row.month,
        nps: row.nps,
        satisfaction: row.satisfaction,
        createdAt: toMytTimestamp(row.createdAt),
      }
    } catch (e) {
      // Two concurrent submissions: the unique (user_id, month) index decides.
      if (errorCode(e) === 'P2002' || errorCode(e) === '23505') throw conflict()
      throw e
    }
  }
}
