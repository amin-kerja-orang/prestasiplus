import { Global, Module } from '@nestjs/common'

import { CLOCK, SystemClock } from './clock'
import { PrismaService } from './prisma.service'

@Global()
@Module({
  providers: [PrismaService, { provide: CLOCK, useClass: SystemClock }],
  exports: [PrismaService, CLOCK],
})
export class DbModule {}
