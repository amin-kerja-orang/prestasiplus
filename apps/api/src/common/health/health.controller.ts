import { Controller, Get, Logger } from '@nestjs/common'
import type { Timestamp } from '@pp/contract'

import { PrismaService } from '../../db/prisma.service'
import { ApiError } from '../errors/api-error'
import { ok } from '../http/respond'
import { toMytTimestamp } from '../time/myt'

const DB_CHECK_TIMEOUT_MS = 3_000

@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name)

  constructor(private readonly prisma: PrismaService) {}

  /** No auth, no cookie. Checks the database with `select 1`; database down gives 503 SERVER_ERROR. */
  @Get()
  async get(): Promise<{ data: { status: 'ok'; db: 'up'; time: Timestamp } }> {
    let timer: NodeJS.Timeout | undefined
    try {
      await Promise.race([
        this.prisma.$queryRaw`select 1`,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('database check timed out')), DB_CHECK_TIMEOUT_MS)
        }),
      ])
    } catch (err) {
      this.logger.error(`database check failed: ${err instanceof Error ? err.message : 'unknown'}`)
      throw new ApiError({ code: 'SERVER_ERROR', status: 503 })
    } finally {
      clearTimeout(timer)
    }
    return ok({ status: 'ok' as const, db: 'up' as const, time: toMytTimestamp() })
  }
}
