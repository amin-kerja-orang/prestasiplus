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

  /** No auth. 200 only when the database answers and the migrations are applied; otherwise 503 SERVER_ERROR with no detail. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async get(): Promise<{ data: { status: 'ready'; db: 'up'; migrations: 'applied'; time: Timestamp } }> {
    const result = await this.ready.check()
    if (!result.ok) {
      this.logger.error(`not ready: ${result.reason}`)
      throw new ApiError({ code: 'SERVER_ERROR', status: 503 })
    }
    return ok({ status: 'ready' as const, db: 'up' as const, migrations: 'applied' as const, time: toMytTimestamp() })
  }
}
