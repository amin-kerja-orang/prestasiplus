import { forwardRef, Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_REPORT_MESSAGES,
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

/** The takedown touches every question of a paper: sized like BE-09's bulk work. */
const TAKEDOWN_TX = { timeout: 20_000, maxWait: 10_000 } as const

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
  /** Every status event written (one per transition since ADR-0027). */
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
    @Inject(forwardRef(() => QuestionReportsService)) private readonly reports: QuestionReportsService,
  ) {}

  private get bank(): QuestionBankPort {
    return this.ports.questionBank
  }

  /**
   * Moves the question; one transaction covers the status read (no lost update), the bank change and
   * every status event. `setStatus` also carries `expectedFrom`, so a change that commits between the
   * read and the write is a 409.
   */
  async transition(questionId: string, toRaw: string, actor: WorkflowActor, options: TransitionOptions = {}): Promise<TransitionResult> {
    const to = parseStatus(toRaw)
    const kind = this.roleKind(actor)
    return this.prisma.transaction(async () => {
      const info = await this.bank.getStatus(questionId)
      if (!info) throw ApiError.of('NOT_FOUND')
      assertCanActOn(actor, info.createdById)
      const from = info.status
      const reason = options.reason?.trim() ? options.reason.trim() : null

      const rule = questionWorkflowTransitionRule(from, to)
      if (!rule) throw ApiError.of('CONFLICT')
      if (!rule.actors.includes(kind)) throw ApiError.of('FORBIDDEN')
      if (rule.reasonRequired && reason === null) {
        throw ApiError.of('VALIDATION_ERROR', { message: REASON_REQUIRED_MESSAGE, fields: { reason: REASON_REQUIRED_MESSAGE } })
      }
      return this.apply(info, actor, [{ from, to, gate: rule.gate, reason }])
    })
  }

  /**
   * "Arkib" on a question report row (R1-B17, Admin Pusat), tied to the version the report was filed against (REQ-B-018): an old report
   * never archives a newer version.
   * - Something is served (a live version): it must be the reported one, else 409 `archiveStaleVersion`. When a newer revision sits on top
   *   (for example in Semakan) the table has no review to archived move, so the LIVE version is archived and serving ends, the same move a
   *   source takedown makes first; the revision is left as it is, so it can still be approved after the fix. Otherwise the normal `transition`.
   * - Nothing is served: the latest is the reported version, so the normal `transition` applies (an archived one is left as it is, a
   *   revision in Semakan is a no-op); a newer latest is a no-op when the reported version is already archived (a second Arkib), else 409.
   */
  async archiveReported(questionId: string, actor: WorkflowActor, reason: string, reportedVersionNo: number): Promise<void> {
    this.roleKind(actor)
    const stale = () => ApiError.of('CONFLICT', { message: QUESTION_REPORT_MESSAGES.archiveStaleVersion })
    await this.prisma.transaction(async () => {
      const info = await this.bank.getStatus(questionId)
      if (!info) return
      if (info.liveVersionNo !== null) {
        if (info.liveVersionNo !== reportedVersionNo) throw stale()
        if (info.liveVersionNo !== info.latestVersionNo) {
          await this.applyOne(info, actor, { from: 'approved', to: 'archived', gate: null, reason, versionNo: info.liveVersionNo, target: 'live' })
          return
        }
      } else if (info.latestVersionNo > reportedVersionNo) {
        const reported = await this.prisma.client.questionVersion.findFirst({
          where: { questionId: BigInt(questionId), versionNo: reportedVersionNo },
          select: { status: true },
        })
        if (reported?.status === 'archived') return
        throw stale()
      } else if (info.status === 'review') return
      if (info.status !== 'archived') await this.transition(questionId, 'archived', actor, { reason })
    })
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
      // Idempotent: the first takedown_at / takedown_by_id are kept.
      await this.prisma.client.sourcePaper.updateMany({
        where: { id: paper.id, takedownAt: null },
        data: { takedownAt: new Date(), takedownById: BigInt(actor.userId) },
      })
      let archived = 0
      let skipped = 0
      for (const id of await this.bank.listIdsBySourcePaper(sourcePaperId)) {
        const info = await this.bank.getStatus(id)
        if (!info) {
          skipped += 1
          continue
        }
        // Working assumption (BE-10): a takedown is a system-level archive "through setStatus" (card AC 6).
        // The table only allows draft/approved -> archived, but review questions of a withdrawn
        // source must go too, so the table is not consulted here; no gate runs and a status event
        // records each move with the takedown reason.
        const hint = { archiveReason: 'source_takedown' } as const
        let did = false
        // The live version survives a newer draft: archive it first (version = the live one).
        if (info.liveVersionNo !== null && info.liveVersionNo !== info.latestVersionNo) {
          await this.applyOne(info, actor, { from: 'approved', to: 'archived', gate: null, reason, versionNo: info.liveVersionNo, target: 'live' }, hint)
          did = true
        }
        if (info.status !== 'archived') {
          await this.applyOne(info, actor, { from: info.status, to: 'archived', gate: null, reason }, hint)
          did = true
        }
        if (did) archived += 1
        else skipped += 1
      }
      return { sourcePaperId, archived, skipped }
    }, TAKEDOWN_TX)
  }

  private roleKind(actor: WorkflowActor): QuestionWorkflowActor {
    // Admin Sekolah and every other role: 403 (transitionActorOf throws FORBIDDEN).
    if (!isAdminPusat(actor) && !isGuru(actor)) throw ApiError.of('FORBIDDEN')
    return transitionActorOf(actor)
  }

  private async apply(info: QuestionStatusInfo, actor: WorkflowActor, steps: Step[]): Promise<TransitionResult> {
    const events: TransitionResult['events'] = []
    for (const step of steps) {
      await this.applyOne(info, actor, step)
      events.push({ from: step.from, to: step.to })
    }
    const last = steps[steps.length - 1]!
    return { id: info.id, from: steps[0]!.from, to: last.to, versionNo: info.latestVersionNo, events }
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
      expectedFrom: step.from,
      ...(step.target ? { target: step.target } : {}),
      ...extra,
    })
    if (!updated) throw ApiError.of('NOT_FOUND')
    await this.writeEvent(info.id, step.versionNo ?? info.latestVersionNo, step.from, step.to, actor, step.reason)
    // AC 11: reports filed against an older version become Diperbaiki, in this same transaction.
    if (step.to === 'approved') await this.reports.markFixedFor(info.id, info.latestVersionNo)
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
  /** Version the event is about when it is not the latest (the live one on takedown). */
  versionNo?: number
  target?: 'latest' | 'live'
}
