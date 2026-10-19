import { Controller, Get } from '@nestjs/common'
import type { Timestamp } from '@pp/contract'

import { ok } from '../http/respond'
import { toMytTimestamp } from '../time/myt'

@Controller('health')
export class HealthController {
  /** Liveness only: no auth, no cookie, no DB check yet. */
  @Get()
  get(): { data: { status: 'ok'; time: Timestamp } } {
    return ok({ status: 'ok' as const, time: toMytTimestamp() })
  }
}
