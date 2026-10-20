import { Module } from '@nestjs/common'

import { JobsConfig } from './jobs.config'
import { JobsService } from './jobs.service'
import { JobsWorker } from './jobs.worker'

/** Platform job runner (BE-37). Feature modules import this, `register` their handlers in `onModuleInit` and `enqueue`. */
@Module({
  providers: [JobsConfig, JobsService, JobsWorker],
  exports: [JobsService],
})
export class JobsModule {}
