import { Module } from '@nestjs/common'

import { BijakBuilderPorts } from './ports'

/** Paper builder (BE-39): skeleton, filled in by the builder task. */
@Module({
  providers: [BijakBuilderPorts],
  exports: [BijakBuilderPorts],
})
export class ExamBuilderModule {}
