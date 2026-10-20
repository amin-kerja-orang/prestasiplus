import {
  type BeforeApplicationShutdown,
  Inject,
  Injectable,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common'

import { JobsConfig } from './jobs.config'
import { JobsService } from './jobs.service'

/**
 * In-process poller. Does nothing unless `JOBS_WORKER_ENABLED=true`. Each tick sweeps stuck jobs and
 * claims free slots; a tick never overlaps the previous one, and long jobs run in the background.
 */
@Injectable()
export class JobsWorker implements OnApplicationBootstrap, OnModuleDestroy, BeforeApplicationShutdown {
  private timer: NodeJS.Timeout | undefined
  private ticking = false

  constructor(
    @Inject(JobsService) private readonly jobs: JobsService,
    @Inject(JobsConfig) private readonly config: JobsConfig,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.config.workerEnabled || this.timer) return
    this.timer = setInterval(() => void this.tick(), this.config.pollMs)
    this.timer.unref()
  }

  /** One poll: sweep, then claim. Exposed for tests. */
  async tick(): Promise<void> {
    if (this.ticking || this.jobs.isDraining) return
    this.ticking = true
    try {
      await this.jobs.sweepStuck()
      await this.jobs.dispatch()
    } catch {
      // Database unavailable: try again on the next tick.
    } finally {
      this.ticking = false
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = undefined
    await this.jobs.drain()
  }

  beforeApplicationShutdown(): Promise<void> {
    return this.stop()
  }

  onModuleDestroy(): Promise<void> {
    return this.stop()
  }
}
