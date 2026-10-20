import { Inject, Injectable } from '@nestjs/common'

import { QuestionWorkflowPorts, type QuestionBankPort } from './ports'

/**
 * Entry point other modules inject (BE-09 controller calls the lifecycle through it).
 * FOUNDATION STUB (BE-10 milestone 1): only the question bank accessor exists. The lifecycle
 * developer adds `transition(...)`, `bulkTransition(...)` and `takedown(...)` here (see `lifecycle/`);
 * the other route groups keep their own services in their own subfolder.
 */
@Injectable()
export class QuestionWorkflowService {
  constructor(@Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts) {}

  /** The wired question bank (an empty one until BE-09 provides it). */
  get bank(): QuestionBankPort {
    return this.ports.questionBank
  }
}
