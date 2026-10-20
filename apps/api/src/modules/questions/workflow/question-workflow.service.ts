import { Inject, Injectable } from '@nestjs/common'
import type { QuestionWorkflowStatus } from '@pp/contract'

import type { WorkflowActor } from './actor'
import {
  LifecycleService,
  type BulkResult,
  type CreateGateInput,
  type TakedownResult,
  type TransitionOptions,
  type TransitionResult,
} from './lifecycle'
import { QuestionWorkflowPorts, type QuestionBankPort } from './ports'

/**
 * Entry point other modules inject (BE-09's controllers call the lifecycle through it). The lifecycle
 * rules live in `lifecycle/`; every method here delegates.
 */
@Injectable()
export class QuestionWorkflowService {
  constructor(
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(LifecycleService) private readonly lifecycle: LifecycleService,
  ) {}

  /** The wired question bank (an empty one until BE-09 provides it). */
  get bank(): QuestionBankPort {
    return this.ports.questionBank
  }

  /** Table, role, reason and gate checks, then bank status change + status event(s) in one transaction. */
  transition(questionId: string, to: string, actor: WorkflowActor, options: TransitionOptions = {}): Promise<TransitionResult> {
    return this.lifecycle.transition(questionId, to, actor, options)
  }

  /** Same rules per id; failing ids are skipped and reported. */
  bulkTransition(ids: readonly string[], to: string, actor: WorkflowActor, options: TransitionOptions = {}): Promise<BulkResult> {
    return this.lifecycle.bulkTransition(ids, to, actor, options)
  }

  /** Throws 403 / 422 when a question may not be created in `input.status` by `actor`. */
  assertCreateAllowed(input: CreateGateInput, actor: WorkflowActor): void {
    this.lifecycle.assertCreateAllowed(input, actor)
  }

  /** Writes the creation status event (from null). Call inside the create transaction. */
  recordCreation(questionId: string, status: QuestionWorkflowStatus, actor: WorkflowActor, versionNo: number): Promise<void> {
    return this.lifecycle.recordCreation(questionId, status, actor, versionNo)
  }

  /** Admin only: marks the source paper taken down and archives all its questions atomically. */
  takedownSource(sourcePaperId: string, actor: WorkflowActor, reason: string): Promise<TakedownResult> {
    return this.lifecycle.takedownSource(sourcePaperId, actor, reason)
  }
}
