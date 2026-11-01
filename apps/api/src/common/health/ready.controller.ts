import { Controller, Get, Header, Logger } from '@nestjs/common'
import type { Timestamp } from '@pp/contract'

import { ApiError } from '../errors/api-error'
import { Public } from '../guards/decorators'
import { ok } from '../http/respond'
import { toMytTimestamp } from '../time/myt'
import { ReadyService } from './ready.service'

@Public()
@Controller('ready')
export class ReadyController {
  private readonly logger = new Logger(ReadyController.name)

  constructor(private readonly ready: ReadyService) {}

  /** No auth. 200 only when the database answers, the migrations are applied and the wallet tiers (reference seed) exist; otherwise 503 SERVER_ERROR with no detail. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async get(): Promise<{ data: { status: 'ready'; db: 'up'; migrations: 'applied'; time: Timestamp } }> {
    const result = await this.ready.check()
    this.logChange(result)
    if (!result.ok) throw new ApiError({ code: 'SERVER_ERROR', status: 503 })
    return ok({ status: 'ready' as const, db: 'up' as const, migrations: 'applied' as const, time: toMytTimestamp() })
  }
  /** What the last poll said: `'ready'` or the not-ready reason. `undefined` = no poll yet. */
  private last: string | undefined

  /**
   * One log line per STATE CHANGE, not per poll: an orchestrator polls /ready every few seconds, and a deploy that waits for the migrations or the
   * reference seed would otherwise write an error line each time (and trip the 5xx / error-rate alert). WARN, not error: not-ready is an expected
   * state while a deploy is in flight, and the 503 itself is the signal. Going back to ready after a not-ready logs ONE info line.
   */
  private logChange(result: { ok: true } | { ok: false; reason: string }): void {
    const now = result.ok ? 'ready' : result.reason
    if (now === this.last) return
    const before = this.last
    this.last = now
    if (!result.ok) this.logger.warn(`not ready: ${result.reason}`)
    else if (before !== undefined) this.logger.log('ready again')
  }
}
