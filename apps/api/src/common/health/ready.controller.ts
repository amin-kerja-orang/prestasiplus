import { Controller, Get, Header, Logger } from '@nestjs/common'
import type { Timestamp } from '@pp/contract'

import { ApiError } from '../errors/api-error'
import { Public } from '../guards/decorators'
import { ok } from '../http/respond'
import { toMytTimestamp } from '../time/myt'
import { JobsConfig } from '../../modules/jobs/jobs.config'
import { VirusScanService, type ScannerHealth } from '../../modules/files/virus-scan'
import { getWorkerHealth, type WorkerHealth } from '../../modules/jobs/jobs.health'
import { ReadyService } from './ready.service'

@Public()
@Controller('ready')
export class ReadyController {
  private readonly logger = new Logger(ReadyController.name)

  constructor(
    private readonly ready: ReadyService,
    private readonly jobsConfig: JobsConfig,
    private readonly scanner: VirusScanService,
  ) {}

  /** No auth. 200 only when the database answers and the migrations are applied; otherwise 503 SERVER_ERROR with no detail.
   * `worker` (ok | down | disabled) and `scanner` (ok | down | disabled: the ClamAV upload scanner, backlog #78) are informational and never change the status. */
  @Get()
  @Header('Cache-Control', 'no-store')
  async get(): Promise<{ data: { status: 'ready'; db: 'up'; migrations: 'applied'; worker: WorkerHealth; scanner: ScannerHealth; time: Timestamp } }> {
    const result = await this.ready.check()
    if (!result.ok) {
      this.logger.error(`not ready: ${result.reason}`)
      throw new ApiError({ code: 'SERVER_ERROR', status: 503 })
    }
    return ok({
      status: 'ready' as const,
      db: 'up' as const,
      migrations: 'applied' as const,
      worker: getWorkerHealth(this.jobsConfig.workerEnabled),
      scanner: await this.scanner.health(),
      time: toMytTimestamp(),
    })
  }
}
