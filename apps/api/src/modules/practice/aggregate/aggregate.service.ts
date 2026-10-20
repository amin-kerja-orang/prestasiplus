import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../../db/prisma.service'
import type { BijakAttemptAggregateInput, BijakAttemptAggregatePort } from './types'

/** US-33 aggregate writer and reads (STUB: replaced by the aggregate implementation). */
@Injectable()
export class PracticeAggregateService implements BijakAttemptAggregatePort {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async recordGraded(_input: BijakAttemptAggregateInput): Promise<void> {
    void this.prisma
    throw new Error('not implemented')
  }
}
