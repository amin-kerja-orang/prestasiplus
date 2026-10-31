import { Inject, Injectable } from '@nestjs/common'
import {
  INTAKE_MESSAGES,
  type IntakeStimulus,
  type IntakeStimulusCreateRequest,
  type IntakeStimulusRemoved,
  type IntakeStimulusUpdateRequest,
  type StudioFigureLinks,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import type { AuthContext } from '../../../common/scope/auth-context'
import type { TxClient } from '../../../db/client'
import { Prisma } from '../../../db/generated/client'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { parseId, visibleBatches } from '../files/intake-access'
import type { CallerInfo } from './extraction.service'
import { figureKeys, stimulusKey } from './figure-links'
import { StoredPayloadSchema, stimulusOf } from './item-model'
import { textOfQuestion } from './duplicates'
import { INTAKE_AUDIT, MAX_STIMULI_PER_BATCH, WORKFLOW_MESSAGES } from './workflow.constants'

const TX = { timeout: 20_000, maxWait: 10_000 } as const
const WORD = { diagram: 'Rajah', passage: 'Petikan', table: 'Jadual' } as const

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.stimulusNotFound })
const inUse = (): ApiError => ApiError.of('CONFLICT', { message: INTAKE_MESSAGES.stimulusInUse })

/** Rajah / petikan of a batch (prototype addStimulus, patchStimulus, removeStimulus). Never writes `svg` (stored-XSS rule). */
@Injectable()
export class IntakeStimuliService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  async create(auth: AuthContext, batchIdText: string, body: IntakeStimulusCreateRequest, who: CallerInfo): Promise<IntakeStimulus> {
    const batchId = parseId(batchIdText)
    const row = await this.prisma.transaction(async (tx) => {
      const visible = batchId === null ? null : await tx.intakeBatch.findFirst({ where: { id: batchId, ...visibleBatches(auth) }, select: { id: true } })
      if (!visible || batchId === null) throw ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.batchNotFound })
      await tx.$queryRaw`SELECT id FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
      const existing = await tx.intakeStimulus.findMany({ where: { batchId }, select: { label: true, ref: true } })
      if (existing.length >= MAX_STIMULI_PER_BATCH) throw ApiError.of('VALIDATION_ERROR', { fields: { kind: WORKFLOW_MESSAGES.tooManyStimuli } })
      const word = WORD[body.kind]
      const label = body.label ?? `${word} ${existing.filter((s) => s.label.startsWith(word)).length + 1}`
      const n = existing.reduce((m, s) => Math.max(m, Number.parseInt(s.ref.replace(/^manual-/, ''), 10) || 0), 0) + 1
      return tx.intakeStimulus.create({
        data: {
          batchId,
          ref: `manual-${n}`,
          kind: body.kind,
          label,
          caption: body.caption ?? null,
          altText: body.alt ?? '',
          body: body.text ?? null,
          tableData: body.table ? (body.table as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
          pageNo: body.page ?? null,
        },
      })
    }, TX)
    void who
    return stimulusOf(row)
  }

  async update(auth: AuthContext, idText: string, body: IntakeStimulusUpdateRequest, who: CallerInfo): Promise<IntakeStimulus> {
    void who
    const row = await this.prisma.transaction(async (tx) => {
      const found = await this.find(tx, auth, idText)
      await tx.$queryRaw`SELECT id FROM intake_stimuli WHERE id = ${found.id} FOR UPDATE`
      if (await this.usedByAccepted(tx, found.id)) throw inUse()
      return tx.intakeStimulus.update({
        where: { id: found.id },
        data: {
          ...(body.label === undefined ? {} : { label: body.label }),
          ...(body.caption === undefined ? {} : { caption: body.caption }),
          ...(body.alt === undefined ? {} : { altText: body.alt }),
          ...(body.text === undefined ? {} : { body: body.text }),
          ...(body.table === undefined ? {} : { tableData: body.table === null ? Prisma.JsonNull : (body.table as unknown as Prisma.InputJsonValue) }),
        },
      })
    }, TX)
    return stimulusOf(row)
  }

  async remove(auth: AuthContext, idText: string, who: CallerInfo): Promise<IntakeStimulusRemoved> {
    return this.prisma.transaction(async (tx) => {
      const found = await this.find(tx, auth, idText)
      await tx.$queryRaw`SELECT id FROM intake_stimuli WHERE id = ${found.id} FOR UPDATE`
      if (await this.usedByAccepted(tx, found.id)) throw inUse()
      const items = await tx.intakeItem.findMany({ where: { stimulusId: found.id }, select: { id: true } })
      await tx.intakeItem.updateMany({ where: { stimulusId: found.id }, data: { stimulusId: null } })
      await tx.intakeStimulus.delete({ where: { id: found.id } })
      await this.audit.record({
        action: INTAKE_AUDIT.stimulusRemoved,
        actorUserId: auth.userId,
        actorRole: auth.active.role,
        scopeLevel: auth.active.scope.level,
        schoolId: auth.active.scope.schoolId ?? null,
        targetType: 'intake_stimulus',
        targetId: idToString(found.id),
        requestId: who.requestId,
        ip: who.ip,
        isTest: auth.mode !== null,
        details: { batchId: idToString(found.batchId), detached: items.length },
        tx,
      })
      return { id: idToString(found.id), detachedItemIds: items.map((i) => idToString(i.id)) }
    }, TX)
  }

  /**
   * D90: links the figure to EVERY open item of its batch that names it ("Rajah 1" in S1 and in S2). Items that already have
   * a stimulus, and accepted, rejected or duplicate items, are left alone. Idempotent.
   */
  async linkReferencing(auth: AuthContext, idText: string, who: CallerInfo): Promise<StudioFigureLinks> {
    return this.prisma.transaction(async (tx) => {
      const found = await this.find(tx, auth, idText)
      await tx.$queryRaw`SELECT id FROM intake_stimuli WHERE id = ${found.id} FOR UPDATE`
      const key = stimulusKey(found.label)
      const linked: bigint[] = []
      if (key !== null) {
        const open = await tx.intakeItem.findMany({
          where: { batchId: found.batchId, stimulusId: null, reviewState: { in: ['generated', 'needs_review'] } },
          orderBy: { position: 'asc' },
          select: { id: true, payload: true },
        })
        for (const item of open) {
          const payload = StoredPayloadSchema.safeParse(item.payload)
          if (payload.success && figureKeys(textOfQuestion(payload.data)).includes(key)) linked.push(item.id)
        }
        if (linked.length > 0) await tx.intakeItem.updateMany({ where: { id: { in: linked } }, data: { stimulusId: found.id } })
      }
      await this.audit.record({
        action: INTAKE_AUDIT.figureLinked,
        actorUserId: auth.userId,
        actorRole: auth.active.role,
        scopeLevel: auth.active.scope.level,
        schoolId: auth.active.scope.schoolId ?? null,
        targetType: 'intake_stimulus',
        targetId: idToString(found.id),
        requestId: who.requestId,
        ip: who.ip,
        isTest: auth.mode !== null,
        details: { batchId: idToString(found.batchId), linked: linked.length },
        tx,
      })
      return { stimulusId: idToString(found.id), linkedItemIds: linked.map(idToString) }
    }, TX)
  }

  private async find(tx: TxClient, auth: AuthContext, idText: string) {
    const id = parseId(idText)
    const row = id === null ? null : await tx.intakeStimulus.findFirst({ where: { id, batch: visibleBatches(auth) } })
    if (!row) throw notFound()
    return row
  }

  private async usedByAccepted(tx: TxClient, stimulusId: bigint): Promise<boolean> {
    return (await tx.intakeItem.count({ where: { stimulusId, reviewState: 'accepted' } })) > 0
  }
}

