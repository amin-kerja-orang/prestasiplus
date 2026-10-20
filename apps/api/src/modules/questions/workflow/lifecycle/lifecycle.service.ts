import { Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_WORKFLOW_STATUSES,
  questionWorkflowTransitionRule,
  type QuestionWorkflowActor,
  type QuestionWorkflowStatus,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { PrismaService } from '../../../../db/prisma.service'
import { assertCanActOn, isAdminPusat, isGuru, transitionActorOf, type WorkflowActor } from '../actor'
import { QuestionReportsService } from '../reports'
import { QuestionWorkflowPorts, type QuestionBankPort, type QuestionGateData, type QuestionStatusInfo } from '../ports'
import { GATE_SUMMARY, GATES, type GateFields, type GateName } from './gates'

export const REASON_REQUIRED_MESSAGE = 'Sila nyatakan sebab.'
export const STATUS_INVALID_MESSAGE = 'Status tidak sah.'
export const TAKEDOWN_REASON_MESSAGE = 'Sila nyatakan sebab penarikan sumber.'

export interface TransitionOptions {
  reason?: string | null
}
export interface TransitionResult {
  id: string
  from: QuestionWorkflowStatus
  to: QuestionWorkflowStatus
  versionNo: number
  /** Every status event written (two for "Lulus & Terbit"). */
  events: { from: QuestionWorkflowStatus | null; to: QuestionWorkflowStatus }[]
}
export interface BulkSkipped {
  id: string
  code: string
  fields: Record<string, string>
}
export interface BulkResult {
  affected: number
  skipped: BulkSkipped[]
}
export interface TakedownResult {
  sourcePaperId: string
  archived: number
  skipped: number
}

/** Input of `assertCreateAllowed`: the new question's status plus everything the gates read. */
export type CreateGateInput = { status: QuestionWorkflowStatus } & Omit<QuestionGateData, 'id'>

export function gateFailure(gate: GateName, fields: GateFields): ApiError {
  return ApiError.of('VALIDATION_ERROR', { message: GATE_SUMMARY[gate], fields, details: { gate } })
}

function runGates(gates: readonly GateName[], data: QuestionGateData): void {
  for (const gate of gates) {
    const fields = GATES[gate](data)
    if (Object.keys(fields).length > 0) throw gateFailure(gate, fields)
  }
}

function parseStatus(to: unknown): QuestionWorkflowStatus {
  if ((QUESTION_WORKFLOW_STATUSES as readonly unknown[]).includes(to)) return to as QuestionWorkflowStatus
  throw ApiError.of('VALIDATION_ERROR', { message: STATUS_INVALID_MESSAGE, fields: { status: STATUS_INVALID_MESSAGE } })
}

/**
 * Lifecycle of a question (BE-10 AC 1, 2, 6, 10, 12): table, roles, reason, gates, status events.
 * No HTTP routes here: BE-09's controllers call it through `QuestionWorkflowService`.
 */
@Injectable()
export class LifecycleService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(QuestionReportsService) private readonly reports: QuestionReportsService,
  ) {}

  private get bank(): QuestionBankPort {
    return this.ports.questionBank
  }

  /** Moves the question; one transaction covers the bank change and every status event. */
  async transition(questionId: string, toRaw: string, actor: WorkflowActor, options: TransitionOptions = {}): Promise<TransitionResult> {
    const to = parseStatus(toRaw)
    const kind = this.roleKind(actor)
    const info = await this.bank.getStatus(questionId)
    if (!info) throw ApiError.of('NOT_FOUND')
    assertCanActOn(actor, info.createdById)
    const from = info.status
    const reason = options.reason?.trim() ? options.reason.trim() : null

    // "Lulus & Terbit": review -> approved -> published in one call, admin only, both gates.
    if (from === 'review' && to === 'published') {
      if (kind !== 'admin') throw ApiError.of('FORBIDDEN')
      return this.apply(info, actor, [
        { from: 'review', to: 'approved', gate: 'approve', reason: null },
        { from: 'approved', to: 'published', gate: 'publish', reason: null },
      ])
    }
    const rule = questionWorkflowTransitionRule(from, to)
    if (!rule) throw ApiError.of('CONFLICT')
    if (!rule.actors.includes(kind)) throw ApiError.of('FORBIDDEN')
    if (rule.reasonRequired && reason === null) {
      throw ApiError.of('VALIDATION_ERROR', { message: REASON_REQUIRED_MESSAGE, fields: { reason: REASON_REQUIRED_MESSAGE } })
    }
    return this.apply(info, actor, [{ from, to, gate: rule.gate, reason }])
  }

  /** "No bypass": the same gates per question; failures are skipped and reported. */
  async bulkTransition(ids: readonly string[], toRaw: string, actor: WorkflowActor, options: TransitionOptions = {}): Promise<BulkResult> {
    parseStatus(toRaw)
    this.roleKind(actor)
    const skipped: BulkSkipped[] = []
    let affected = 0
    for (const id of ids) {
      try {
        await this.transition(id, toRaw, actor, options)
        affected += 1
      } catch (e) {
        if (!(e instanceof ApiError)) throw e
        skipped.push({ id, code: e.code, fields: e.fields ?? {} })
      }
    }
    return { affected, skipped }
  }

  /** Create hook: BE-09's create path and imports call it before writing a question that starts past draft. */
  assertCreateAllowed(input: CreateGateInput, actor: WorkflowActor): void {
    const kind = this.roleKind(actor)
    parseStatus(input.status)
    if (input.status === 'archived') {
      throw ApiError.of('VALIDATION_ERROR', { message: STATUS_INVALID_MESSAGE, fields: { status: STATUS_INVALID_MESSAGE } })
    }
    if (kind !== 'admin' && input.status !== 'draft' && input.status !== 'review') throw ApiError.of('FORBIDDEN')
    const data: QuestionGateData = { ...input, id: '0' }
    const gates: Record<QuestionWorkflowStatus, readonly GateName[]> = {
      draft: [],
      review: ['submit'],
      approved: ['submit', 'approve'],
      published: ['submit', 'approve', 'publish'],
      archived: [],
    }
    runGates(gates[input.status], data)
  }

  /** The creation status event (from null) once the question row exists. */
  async recordCreation(questionId: string, status: QuestionWorkflowStatus, actor: WorkflowActor, versionNo: number): Promise<void> {
    await this.writeEvent(questionId, versionNo, null, status, actor, null)
  }

  /** AC 6: takes a source paper down and archives its questions, atomically. Admin Pusat only. */
  async takedownSource(sourcePaperId: string, actor: WorkflowActor, reasonRaw: string): Promise<TakedownResult> {
    if (!isAdminPusat(actor)) throw ApiError.of('FORBIDDEN')
    const reason = reasonRaw?.trim()
    if (!reason) throw ApiError.of('VALIDATION_ERROR', { message: TAKEDOWN_REASON_MESSAGE, fields: { reason: TAKEDOWN_REASON_MESSAGE } })
    if (!/^\d+$/.test(sourcePaperId)) throw ApiError.of('NOT_FOUND')
    return this.prisma.transaction(async () => {
      const paper = await this.prisma.client.sourcePaper.findUnique({ where: { id: BigInt(sourcePaperId) } })
      if (!paper) throw ApiError.of('NOT_FOUND')
      await this.prisma.client.sourcePaper.update({
        where: { id: paper.id },
        data: { takedownAt: new Date(), takedownById: BigInt(actor.userId) },
      })
      let archived = 0
      let skipped = 0
      for (const id of await this.bank.listIdsBySourcePaper(sourcePaperId)) {
        const info = await this.bank.getStatus(id)
        if (!info || info.status === 'archived') {
          skipped += 1
          continue
        }
        // Working assumption (BE-10): a takedown is a system-level archive "through setStatus" (card AC 6).
        // The table only allows draft/published -> archived, but review/approved questions of a withdrawn
        // source must go too, so the table is not consulted here; no gate runs and a status event
        // records each move with the takedown reason.
        await this.applyOne(info, actor, { from: info.status, to: 'archived', gate: null, reason }, { archiveReason: 'source_takedown' })
        archived += 1
      }
      return { sourcePaperId, archived, skipped }
    })
  }

  private roleKind(actor: WorkflowActor): QuestionWorkflowActor {
    // Admin Sekolah and every other role: 403 (transitionActorOf throws FORBIDDEN).
    if (!isAdminPusat(actor) && !isGuru(actor)) throw ApiError.of('FORBIDDEN')
    return transitionActorOf(actor)
  }

  private apply(info: QuestionStatusInfo, actor: WorkflowActor, steps: Step[]): Promise<TransitionResult> {
    return this.prisma.transaction(async () => {
      const events: TransitionResult['events'] = []
      for (const step of steps) {
        await this.applyOne(info, actor, step)
        events.push({ from: step.from, to: step.to })
      }
      const last = steps[steps.length - 1]!
      return { id: info.id, from: steps[0]!.from, to: last.to, versionNo: info.latestVersionNo, events }
    })
  }

  private async applyOne(
    info: QuestionStatusInfo,
    actor: WorkflowActor,
    step: Step,
    extra: { archiveReason?: 'withdrawn' | 'source_takedown' } = {},
  ): Promise<void> {
    if (step.gate) {
      const data = await this.bank.getForGates(info.id)
      if (!data) throw ApiError.of('NOT_FOUND')
      runGates([step.gate], data)
    }
    const updated = await this.bank.setStatus(info.id, step.to, actor.userId, {
      actor: isAdminPusat(actor) ? 'admin' : 'owner_teacher',
      reason: step.reason,
      ...extra,
    })
    if (!updated) throw ApiError.of('NOT_FOUND')
    await this.writeEvent(info.id, info.latestVersionNo, step.from, step.to, actor, step.reason)
    // AC 11: reports filed against an older version become Diperbaiki, in this same transaction.
    if (step.to === 'published') await this.reports.markFixedFor(info.id, info.latestVersionNo)
  }

  private async writeEvent(
    questionId: string,
    versionNo: number,
    from: QuestionWorkflowStatus | null,
    to: QuestionWorkflowStatus,
    actor: WorkflowActor,
    reason: string | null,
  ): Promise<void> {
    await this.prisma.client.questionStatusEvent.create({
      data: {
        questionId: BigInt(questionId),
        versionNo,
        fromStatus: from,
        toStatus: to,
        actorUserId: BigInt(actor.userId),
        actorRole: actor.role,
        reason,
        requestId: actor.requestId,
      },
    })
  }
}

interface Step {
  from: QuestionWorkflowStatus
  to: QuestionWorkflowStatus
  gate: GateName | null
  reason: string | null
}
