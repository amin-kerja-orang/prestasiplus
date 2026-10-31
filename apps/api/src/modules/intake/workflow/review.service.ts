import { Inject, Injectable } from '@nestjs/common'
import {
  INTAKE_BLANK_ITEM_DEFAULTS,
  INTAKE_MESSAGES,
  IntakeBatchReviewSchema,
  intakeOpenState,
  type IntakeBatchIssue,
  type IntakeBatchReview,
  type IntakeBulkRequest,
  type IntakeBulkResult,
  type IntakeDuplicateRequest,
  type IntakeIssue,
  type IntakeItem,
  type IntakeItemCreateRequest,
  type IntakeItemListQuery,
  type IntakeItemListResponse,
  type IntakeItemPatch,
  type IntakeItemPatchResult,
  type IntakeItemRow,
  type IntakeItemState,
  type IntakeQuestion,
  type IntakeRejectRequest,
} from '@pp/contract'

import { AuditService } from '../../../common/audit/audit.service'
import { ApiError } from '../../../common/errors/api-error'
import { listMeta } from '../../../common/http/respond'
import type { AuthContext } from '../../../common/scope/auth-context'
import type { TxClient } from '../../../db/client'
import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { QuestionsRepository, QuestionsService } from '../../questions'
import { isAdmin, parseId, visibleBatches } from '../files/intake-access'
import { CurriculumFactsService } from './curriculum-facts'
import { runToWire, type CallerInfo } from './extraction.service'
import { batchLevelIssues, itemIssues, questionMarks, stimulusIssues } from './gate'
import { attachToStimulus, groupsOf } from './grouping'
import { stimulusTableOf } from '../../questions/stimulus-table'
import { ITEM_INCLUDE, PayloadSchema, bandOf, payloadOf, questionOf, stateDuplicates, stimulusOf, type ItemRow, type StoredPayload } from './item-model'
import { ItemViews } from './item-views'
import { toQuestionInput, ConvertError } from './to-question'
import { IntakeWorkflowConfig, bandReaches } from './workflow.config'
import { INTAKE_AUDIT, MAX_DUPLICATE_ENTRIES_PER_ITEM, WORKFLOW_MESSAGES } from './workflow.constants'

const OPEN: readonly IntakeItemState[] = ['generated', 'needs_review', 'duplicate']
const MAX_OFFSET = 1_000_000
const TX = { timeout: 20_000, maxWait: 10_000 } as const

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.itemNotFound })
const batchNotFound = (): ApiError => ApiError.of('NOT_FOUND', { message: INTAKE_MESSAGES.batchNotFound })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })
const invalid = (field: string, message: string): ApiError => ApiError.of('VALIDATION_ERROR', { fields: { [field]: message } })
const gateError = (issues: IntakeIssue[]): ApiError =>
  ApiError.of('VALIDATION_ERROR', { message: INTAKE_MESSAGES.gateFailed, details: { issues } })

const same = (a: unknown, b: unknown): boolean => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

/** Identity of a transition for the audit row and the item history. */
interface Transition {
  from: IntakeItemState
  to: IntakeItemState
}

/**
 * The review workflow (BE-38): queue, item detail, edit, add, accept-to-Draf, reject, duplicate decisions, bulk and the
 * batch summary. Roles (D40a): a Guru works on own batches, Admin Pusat on all; a batch or item outside the caller's scope
 * is 404 (never 403 on an id). Questions are created ONLY through `QuestionsService` (ADR-0014, D12). Only a signed-in
 * human reaches these methods; the extraction worker and the AI port have no way to call them (AC-2): they write items
 * through `IntakeExtractionService`, which can only produce `generated` or `needs_review`.
 */
/**
 * Kertas ('1' to '3') of a source paper: the trailing digit of its paper code (`1449/2`), else the digit of its printed
 * label (`K2`, `P1`). Null when neither says (the question then carries no kertas and is not a paper-builder candidate).
 */
export function kertasOfSourcePaper(paper: { paperCode: string | null; kertas: string | null } | null): '1' | '2' | '3' | null {
  if (!paper) return null
  const m = (paper.paperCode ? /\/([0-9])\s*$/.exec(paper.paperCode) : null) ?? (paper.kertas ? /^[A-Za-z]*\s*([0-9])\s*$/.exec(paper.kertas) : null)
  return m && (m[1] === '1' || m[1] === '2' || m[1] === '3') ? m[1] : null
}

@Injectable()
export class IntakeReviewService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AuditService) private readonly audit: AuditService,
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(QuestionsRepository) private readonly questionsRepo: QuestionsRepository,
    @Inject(CurriculumFactsService) private readonly curriculum: CurriculumFactsService,
    @Inject(ItemViews) private readonly views: ItemViews,
    @Inject(IntakeWorkflowConfig) private readonly config: IntakeWorkflowConfig,
  ) {}

  // ---- reads ---------------------------------------------------------------------------------------

  private async loadVisible(auth: AuthContext, idText: string, db: Pick<TxClient, 'intakeItem'> = this.prisma.client): Promise<ItemRow> {
    const id = parseId(idText)
    if (id === null) throw notFound()
    const row = await db.intakeItem.findFirst({ where: { id, batch: visibleBatches(auth) }, include: ITEM_INCLUDE })
    if (!row) throw notFound()
    return row
  }

  async get(auth: AuthContext, idText: string): Promise<IntakeItem> {
    return this.views.detail(auth, await this.loadVisible(auth, idText))
  }

  async list(auth: AuthContext, q: IntakeItemListQuery): Promise<IntakeItemListResponse> {
    // The contract gives `page` no maximum; an offset this large cannot hold a row and would overflow the query.
    if ((q.page - 1) * q.pageSize > MAX_OFFSET) throw invalid('page', WORKFLOW_MESSAGES.pageTooLarge)
    const base: Prisma.IntakeItemWhereInput = {
      batch: {
        ...visibleBatches(auth),
        ...(q.subject === undefined ? {} : { subject: q.subject.toUpperCase() }),
        ...(isAdmin(auth) && q.uploaderId !== undefined ? { ownerUserId: parseId(q.uploaderId) ?? -1n } : {}),
      },
      ...(q.batchId === undefined ? {} : { batchId: parseId(q.batchId) ?? -1n }),
      ...(q.band === undefined ? {} : { OR: BAND_WHERE[q.band] }),
      ...(q.duplicate === undefined ? {} : DUPLICATE_WHERE[q.duplicate]),
    }
    const where: Prisma.IntakeItemWhereInput = q.state === undefined ? base : { ...base, reviewState: q.state }
    const [total, rows, grouped] = await Promise.all([
      this.prisma.client.intakeItem.count({ where }),
      this.prisma.client.intakeItem.findMany({
        where,
        include: ITEM_INCLUDE,
        orderBy: [{ batchId: 'desc' }, { position: 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.client.intakeItem.groupBy({ by: ['reviewState'], where: base, _count: { _all: true } }),
    ])
    const counts = { generated: 0, needs_review: 0, accepted: 0, rejected: 0, duplicate: 0 }
    for (const g of grouped) if (g.reviewState in counts) counts[g.reviewState as IntakeItemState] = g._count._all
    return { data: await this.views.rows(auth, rows), meta: { ...listMeta(q.page, q.pageSize, total), counts } }
  }

  async review(auth: AuthContext, idText: string): Promise<IntakeBatchReview> {
    const id = parseId(idText)
    if (id === null) throw batchNotFound()
    const batch = await this.prisma.client.intakeBatch.findFirst({
      where: { id, ...visibleBatches(auth) },
      select: { id: true, sourceText: true, rightsStatus: true },
    })
    if (!batch) throw batchNotFound()
    const [items, stimuliRows, runs] = await Promise.all([
      this.prisma.client.intakeItem.findMany({ where: { batchId: id }, include: ITEM_INCLUDE, orderBy: [{ position: 'asc' }, { id: 'asc' }] }),
      this.prisma.client.intakeStimulus.findMany({ where: { batchId: id }, orderBy: { id: 'asc' } }),
      this.prisma.client.intakeExtractionRun.findMany({ where: { batchId: id }, orderBy: { id: 'desc' } }),
    ])
    const stimuli = stimuliRows.map(stimulusOf)
    const latest = runs[0] ?? null
    const done = runs.find((r) => r.state === 'succeeded') ?? null
    const issuesByItem = await this.views.issuesOf(items)
    const open = items.filter((r) => OPEN.includes(r.reviewState as IntakeItemState))

    const itemIssuesAll: IntakeBatchIssue[] = items.flatMap((r) => (issuesByItem.get(idToString(r.id)) ?? []).map((i) => ({ ...i, blocksAccept: true })))
    const ordered = items.map((r) => ({ id: idToString(r.id), stimulusId: r.stimulusId === null ? null : idToString(r.stimulusId) }))
    const groupInfos = groupsOf(ordered)
    const label = (itemId: string): string => items.find((r) => idToString(r.id) === itemId)?.numberLabel ?? ''
    const groups = groupInfos.map((g) => ({
      stimulusId: g.stimulusId,
      itemIds: g.itemIds,
      from: label(g.itemIds[0] as string),
      to: label(g.itemIds[g.itemIds.length - 1] as string),
      contiguous: g.contiguous,
    }))
    const live = items.filter((r) => r.reviewState !== 'rejected')
    const issues: IntakeBatchIssue[] = [
      ...itemIssuesAll,
      ...stimulusIssues(stimuli).map((i) => ({ ...i, blocksAccept: true })),
      ...batchLevelIssues({
        itemCount: live.length,
        source: batch.sourceText,
        copyright: batch.rightsStatus,
        groups: groupInfos,
        stimuli,
      }).map((i) => ({ ...i, blocksAccept: false })),
    ]
    const counts = { generated: 0, needs_review: 0, accepted: 0, rejected: 0, duplicate: 0 }
    for (const r of items) counts[r.reviewState as IntakeItemState] += 1
    const unmatched = Array.isArray(done?.unmatched) ? (done?.unmatched as unknown[]).filter((u): u is string => typeof u === 'string') : []
    const warnings = Array.isArray(done?.warnings) ? (done?.warnings as unknown[]).filter((u): u is string => typeof u === 'string') : []
    return IntakeBatchReviewSchema.parse({
      batchId: idToString(id),
      provider: done?.provider ?? null,
      model: done?.model ?? null,
      unmatched,
      warnings,
      stimuli,
      groups,
      counts: {
        items: live.length,
        marks: live.reduce((n, r) => n + questionMarks(questionOf(r)), 0),
        groups: groups.length,
        low: open.reduce((n, r) => n + r.lowFields.filter((f) => !r.confirmedFields.includes(f)).length, 0),
        states: counts,
      },
      issues,
      extraction: latest ? runToWire(latest) : null,
    })
  }

  // ---- add a blank item -----------------------------------------------------------------------------

  async addItem(auth: AuthContext, batchIdText: string, body: IntakeItemCreateRequest, who: CallerInfo): Promise<IntakeItem> {
    const batchId = parseId(batchIdText)
    if (batchId === null) throw batchNotFound()
    const id = await this.prisma.transaction(async (tx) => {
      // Scope first, lock second: a caller who cannot see the batch must not queue on its row lock.
      const visible = await tx.intakeBatch.findFirst({ where: { id: batchId, ...visibleBatches(auth) }, select: { id: true } })
      if (!visible) throw batchNotFound()
      const locked = await tx.$queryRaw<{ id: bigint; subject: string }[]>`SELECT id, subject FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
      if (!locked[0]) throw batchNotFound()
      const items = await tx.intakeItem.findMany({ where: { batchId }, select: { numberLabel: true, position: true } })
      if (items.length >= this.config.maxItemsPerBatch) throw invalid('batchId', WORKFLOW_MESSAGES.tooManyItems)
      const nextLabel = items.reduce((m, r) => Math.max(m, Number.parseInt(r.numberLabel, 10) || 0), 0) + 1
      const d = INTAKE_BLANK_ITEM_DEFAULTS
      const payload: StoredPayload = {
        stem: d.stem,
        options: [],
        marks: d.marks,
        mode: d.mode,
        parts: [],
        tag: { subject: locked[0].subject, level: d.tag.level, unit: null, unitLabel: '', sp: [], tp: d.tag.tp, formOrigin: d.tag.formOrigin },
      }
      const page = body.page ?? d.page
      const row = await tx.intakeItem.create({
        data: {
          batchId,
          position: items.reduce((m, r) => Math.max(m, r.position), 0) + 1,
          sourceType: 'manual',
          numberLabel: String(nextLabel),
          itemType: d.type,
          payload: { ...payload, origin: { label: String(nextLabel), page } } as unknown as Prisma.InputJsonValue,
          pageNo: page,
          reviewState: 'generated',
        },
      })
      await tx.intakeItemEvent.create({
        data: { itemId: row.id, event: 'added', toState: 'generated', actorUserId: idFromString(auth.userId), actorRole: auth.active.role },
      })
      await this.record(INTAKE_AUDIT.itemAdded, auth, row, who, { to: 'generated', label: String(nextLabel) }, tx)
      return row.id
    })
    return this.views.detail(auth, await this.loadVisible(auth, idToString(id)))
  }

  // ---- edit ----------------------------------------------------------------------------------------

  async patch(auth: AuthContext, idText: string, body: IntakeItemPatch, who: CallerInfo): Promise<IntakeItemPatchResult> {
    const first = await this.loadVisible(auth, idText)
    const itemId = first.id
    let reordered = false
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${itemId} FOR UPDATE`
      const row = await this.loadVisible(auth, idText, tx)
      if (!OPEN.includes(row.reviewState as IntakeItemState)) throw conflict(INTAKE_MESSAGES.itemLocked)
      const current = questionOf(row)
      const stored = payloadOf(row)
      const from = row.reviewState as IntakeItemState

      // 1. the new content
      const next: IntakeQuestion = { ...current }
      const changes: Array<{ field: string; before: unknown; after: unknown }> = []
      const set = <K extends keyof IntakeQuestion>(key: K, value: IntakeQuestion[K] | undefined, field: string = key): void => {
        if (!same(current[key], value)) changes.push({ field, before: current[key] ?? null, after: value ?? null })
        if (value === undefined) delete next[key]
        else next[key] = value
      }
      if (body.label !== undefined) set('label', body.label)
      if (body.type !== undefined) set('type', body.type)
      if (body.stem !== undefined) set('stem', body.stem)
      if (body.options !== undefined) set('options', body.options)
      if (body.marks !== undefined) set('marks', body.marks)
      if (body.mode !== undefined) set('mode', body.mode)
      if (body.unit !== undefined) set('unit', body.unit ?? undefined)
      if (body.wordRange !== undefined) set('wordRange', body.wordRange ?? undefined)
      if (body.cognitiveLevel !== undefined) set('cognitiveLevel', body.cognitiveLevel ?? undefined)
      if (body.parts !== undefined) set('parts', body.parts)
      if (body.scheme !== undefined) set('scheme', body.scheme ?? undefined)
      if (body.page !== undefined) set('page', body.page)
      if (body.tag !== undefined) {
        next.tag = body.tag
        for (const k of Object.keys({ ...current.tag, ...body.tag }) as Array<keyof IntakeQuestion['tag']>) {
          if (!same(current.tag[k], body.tag[k])) changes.push({ field: `tag.${k}`, before: current.tag[k] ?? null, after: body.tag[k] ?? null })
        }
      }

      // 2. confirmed fields and "needs manual"
      let confirmed = row.confirmedFields
      const confirmedEvents: Array<{ field: string }> = []
      if (body.confirmed !== undefined) {
        const bad = body.confirmed.filter((f) => !row.lowFields.includes(f))
        if (bad.length > 0) throw invalid('confirmed', WORKFLOW_MESSAGES.confirmedNotLow)
        const wanted = [...new Set(body.confirmed)]
        for (const f of wanted) if (!confirmed.includes(f)) confirmedEvents.push({ field: f })
        if (confirmed.some((f) => !wanted.includes(f))) changes.push({ field: 'confirmed', before: confirmed, after: wanted })
        confirmed = wanted
      }
      let needsManual = row.needsManual
      if (body.needsManual === false && needsManual) {
        needsManual = false
        confirmedEvents.push({ field: 'needsManual' })
      }

      // 3. stimulus link (and the paper order it implies)
      let stimulusId = row.stimulusId
      if (body.stimulusId !== undefined) {
        const target = body.stimulusId === null ? null : parseId(body.stimulusId)
        if (body.stimulusId !== null) {
          const ok = target !== null && (await tx.intakeStimulus.findFirst({ where: { id: target, batchId: row.batchId }, select: { id: true } }))
          if (!ok) throw invalid('stimulusId', WORKFLOW_MESSAGES.stimulusInvalid)
        }
        if (!same(stimulusId === null ? null : idToString(stimulusId), body.stimulusId)) {
          changes.push({ field: 'stimulusId', before: stimulusId === null ? null : idToString(stimulusId), after: body.stimulusId })
        }
        stimulusId = target
        if (target !== null) reordered = await this.regroup(tx, row.batchId, itemId, target)
      }

      // 4. the new state, by the contract rule
      const dups = stateDuplicates(row.duplicates)
      const state = intakeOpenState({ lowFields: row.lowFields, confirmed, needsManual, duplicates: dups })
      const parsed = PayloadSchema.parse(Object.fromEntries(Object.keys(PayloadSchema.shape).filter((k) => k in next).map((k) => [k, next[k as keyof IntakeQuestion]])))
      const edited = [...new Set([...row.humanEdited, ...changes.filter((c) => c.field !== 'confirmed').map((c) => c.field)])]
      await tx.intakeItem.update({
        where: { id: itemId },
        data: {
          numberLabel: next.label,
          itemType: next.type,
          pageNo: next.page,
          payload: { ...parsed, ...(stored.origin ? { origin: stored.origin } : {}) } as unknown as Prisma.InputJsonValue,
          confirmedFields: confirmed,
          needsManual,
          humanEdited: edited,
          reviewState: state,
          stimulusId,
        },
      })
      const actor = { actorUserId: idFromString(auth.userId), actorRole: auth.active.role, fromState: from, toState: state }
      const events: Prisma.IntakeItemEventCreateManyInput[] = [
        ...changes.map((c) => ({
          itemId,
          event: 'edited',
          field: c.field.slice(0, 64),
          beforeValue: (c.before ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          afterValue: (c.after ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ...actor,
        })),
        ...confirmedEvents.map((c) => ({ itemId, event: 'confirmed', field: c.field.slice(0, 64), ...actor })),
      ]
      if (events.length > 0) {
        await tx.intakeItemEvent.createMany({ data: events })
        const fields = [...new Set([...changes.map((c) => c.field), ...confirmedEvents.map((c) => c.field)])]
        await this.record(INTAKE_AUDIT.itemEdited, auth, row, who, { from, to: state, fields: fields.slice(0, 50) }, tx)
      }
    }, TX)
    return { data: await this.views.detail(auth, await this.loadVisible(auth, idText)), reordered }
  }

  /** Gathers the group of `stimulusId` contiguous (prototype `attachToStimulus`) and rewrites the positions. */
  private async regroup(tx: TxClient, batchId: bigint, itemId: bigint, stimulusId: bigint): Promise<boolean> {
    // Two edits of one batch must not reorder it at the same time.
    await tx.$queryRaw`SELECT id FROM intake_batches WHERE id = ${batchId} FOR UPDATE`
    const rows = await tx.intakeItem.findMany({ where: { batchId }, orderBy: [{ position: 'asc' }, { id: 'asc' }], select: { id: true, position: true, stimulusId: true } })
    const ordered = rows.map((r) => ({ id: idToString(r.id), stimulusId: r.stimulusId === null ? null : idToString(r.stimulusId) }))
    const { items, moved } = attachToStimulus(ordered, [idToString(itemId)], idToString(stimulusId))
    if (!moved) return false
    const slots = rows.map((r) => r.position)
    for (const [i, it] of items.entries()) {
      const slot = slots[i] as number
      const old = rows.find((r) => idToString(r.id) === it.id)
      if (old && old.position !== slot) await tx.intakeItem.update({ where: { id: old.id }, data: { position: slot } })
    }
    return true
  }

  // ---- reject --------------------------------------------------------------------------------------

  async reject(auth: AuthContext, idText: string, body: IntakeRejectRequest, who: CallerInfo): Promise<IntakeItem> {
    const first = await this.loadVisible(auth, idText)
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const row = await this.loadVisible(auth, idText, tx)
      if (!OPEN.includes(row.reviewState as IntakeItemState)) throw conflict(INTAKE_MESSAGES.itemLocked)
      await this.decide(tx, auth, row, 'rejected', body.reason, who)
    }, TX)
    return this.views.detail(auth, await this.loadVisible(auth, idText))
  }

  /** Final decision (reject): state, reason, who and when, the history row and the audit row in one transaction. */
  private async decide(tx: TxClient, auth: AuthContext, row: ItemRow, to: 'rejected', reason: string, who: CallerInfo): Promise<void> {
    const transition: Transition = { from: row.reviewState as IntakeItemState, to }
    await tx.intakeItem.update({
      where: { id: row.id },
      data: { reviewState: to, rejectReason: reason, decidedById: idFromString(auth.userId), decidedAt: new Date() },
    })
    await tx.intakeItemEvent.create({
      data: { itemId: row.id, event: 'rejected', fromState: transition.from, toState: transition.to, reason, actorUserId: idFromString(auth.userId), actorRole: auth.active.role },
    })
    await this.record(INTAKE_AUDIT.itemRejected, auth, row, who, { from: transition.from, to: transition.to, reason }, tx)
  }

  // ---- duplicate decisions -------------------------------------------------------------------------

  async duplicate(auth: AuthContext, idText: string, body: IntakeDuplicateRequest, who: CallerInfo): Promise<IntakeItem> {
    const first = await this.loadVisible(auth, idText)
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const row = await this.loadVisible(auth, idText, tx)
      if (!OPEN.includes(row.reviewState as IntakeItemState)) throw conflict(INTAKE_MESSAGES.itemLocked)
      const from = row.reviewState as IntakeItemState
      const now = new Date()
      const decidedBy = idFromString(auth.userId)
      const who_ = { decidedById: decidedBy, decidedAt: now }
      let event: 'marked_duplicate' | 'linked_variant' | 'cleared_duplicate'

      if (body.decision === 'not_duplicate') {
        const entry = body.duplicateId === undefined ? undefined : row.duplicates.find((d) => idToString(d.id) === body.duplicateId)
        if (!entry) throw invalid('duplicateId', INTAKE_MESSAGES.duplicateTargetNotFound)
        await tx.duplicateLink.update({ where: { id: entry.id }, data: { decision: 'not_duplicate', ...who_ } })
        event = 'cleared_duplicate'
      } else {
        // One target, validated alike whatever is wrong with it (unknown, other batch, not readable): no id probing.
        let matchedQuestionId: bigint | undefined
        let matchedItemId: bigint | undefined
        if (body.matchedQuestionId !== undefined) {
          const q = parseId(body.matchedQuestionId)
          const owner = q === null ? undefined : await this.questionsRepo.ownerOf(body.matchedQuestionId)
          const readable = q !== null && owner !== undefined && (isAdmin(auth) || owner === auth.userId)
          if (!readable || q === null) throw invalid('matchedQuestionId', INTAKE_MESSAGES.duplicateTargetNotFound)
          matchedQuestionId = q
        } else {
          const m = body.matchedItemId === undefined ? null : parseId(body.matchedItemId)
          const target = m === null || m === row.id ? null : await tx.intakeItem.findFirst({ where: { id: m, batchId: row.batchId }, select: { id: true } })
          if (!target) throw invalid('matchedItemId', INTAKE_MESSAGES.duplicateTargetNotFound)
          matchedItemId = target.id
        }
        const existing = row.duplicates.find((d) => (matchedQuestionId !== undefined ? d.matchedQuestionId === matchedQuestionId : d.matchedItemId === matchedItemId))
        const variant = body.decision === 'variant'
        if (existing) {
          await tx.duplicateLink.update({
            where: { id: existing.id },
            data: { decision: variant ? 'linked_variant' : 'merged', ...(variant ? { kind: 'variant' } : {}), ...who_ },
          })
        } else {
          if (row.duplicates.length >= MAX_DUPLICATE_ENTRIES_PER_ITEM) throw invalid('duplicateId', INTAKE_MESSAGES.duplicateTargetNotFound)
          await tx.duplicateLink.create({
            data: {
              itemId: row.id,
              ...(matchedQuestionId === undefined ? {} : { matchedQuestionId }),
              ...(matchedItemId === undefined ? {} : { matchedItemId }),
              kind: variant ? 'variant' : 'near',
              decision: variant ? 'linked_variant' : 'merged',
              ...who_,
            },
          })
        }
        event = variant ? 'linked_variant' : 'marked_duplicate'
      }

      const dups = await tx.duplicateLink.findMany({ where: { itemId: row.id } })
      const to = intakeOpenState({ lowFields: row.lowFields, confirmed: row.confirmedFields, needsManual: row.needsManual, duplicates: stateDuplicates(dups) })
      await tx.intakeItem.update({ where: { id: row.id }, data: { reviewState: to } })
      await tx.intakeItemEvent.create({
        data: { itemId: row.id, event, fromState: from, toState: to, reason: body.note ?? null, actorUserId: decidedBy, actorRole: auth.active.role },
      })
      await this.record(INTAKE_AUDIT.itemDuplicate, auth, row, who, { from, to, decision: body.decision, ...(body.note ? { reason: body.note } : {}) }, tx)
    }, TX)
    return this.views.detail(auth, await this.loadVisible(auth, idText))
  }

  // ---- accept-to-Draf ------------------------------------------------------------------------------

  async accept(auth: AuthContext, idText: string, who: CallerInfo): Promise<IntakeItem> {
    const first = await this.loadVisible(auth, idText)
    await this.prisma.transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${first.id} FOR UPDATE`
      const row = await this.loadVisible(auth, idText, tx)
      await this.acceptRow(tx, auth, row, who)
    }, TX)
    return this.views.detail(auth, await this.loadVisible(auth, idText))
  }

  /** The accept itself, inside the caller's transaction on a locked row. Throws 409 for a wrong state, 422 for a failed gate. */
  private async acceptRow(tx: TxClient, auth: AuthContext, row: ItemRow, who: CallerInfo): Promise<void> {
    if (row.reviewState === 'accepted') throw conflict(INTAKE_MESSAGES.itemAlreadyAccepted)
    if (row.reviewState === 'rejected') throw conflict(INTAKE_MESSAGES.itemLocked)
    if (row.reviewState === 'duplicate') throw conflict(INTAKE_MESSAGES.itemIsDuplicate)

    // Items of one stimulus group are accepted one at a time: the first creates the bank stimulus and group, the rest join it.
    if (row.stimulusId !== null) await tx.$queryRaw`SELECT id FROM intake_batches WHERE id = ${row.batchId} FOR UPDATE`

    const q = questionOf(row)
    const stimulus = row.stimulus ? stimulusOf(row.stimulus) : undefined
    const resolved = await this.curriculum.resolver().resolve(q.tag)
    const issues = itemIssues(q, stimulus, resolved.facts)
    if (issues.length > 0 || resolved.ids === null) throw gateError(issues)

    const ownerId = row.batch.ownerUserId === null ? auth.userId : idToString(row.batch.ownerUserId)
    const actor = { userId: ownerId, role: auth.active.role === 'admin' ? ('admin' as const) : ('teacher' as const) }
    const groupId = row.stimulus ? await this.bankGroupFor(row, ownerId) : null

    let created
    try {
      // The kertas comes from the source paper (the paper builder reads it from the trailing digit of the paper code).
      const paper = row.batch.sourcePaperId === null ? null : await tx.sourcePaper.findUnique({ where: { id: row.batch.sourcePaperId }, select: { paperCode: true, kertas: true } })
      const kertas = kertasOfSourcePaper(paper)
      const input = { ...toQuestionInput(q, resolved.ids, groupId), ...(kertas === null ? {} : { kertas }) }
      const file = row.intakeFileId === null ? null : await tx.intakeFile.findUnique({ where: { id: row.intakeFileId }, select: { fileId: true } })
      created = await this.questions.createFromIntake(input, actor, {
        sourceType: row.sourceType === 'manual' ? 'manual' : 'pdf',
        numberLabel: row.numberLabel === '' ? null : row.numberLabel,
        sourcePage: row.pageNo,
        sourceRegion: row.region,
        sourcePaperId: row.batch.sourcePaperId === null ? null : idToString(row.batch.sourcePaperId),
        intakeItemId: idToString(row.id),
        sourceFileId: file === null || file === undefined ? null : idToString(file.fileId),
        aiRunId: row.aiRunId === null ? null : idToString(row.aiRunId),
        aiModel: row.run?.model ?? null,
        paperCode: paper?.paperCode && /\/[0-9]\s*$/.test(paper.paperCode) ? paper.paperCode : null,
      })
    } catch (err) {
      if (err instanceof ConvertError) throw gateError([{ itemId: idToString(row.id), where: err.where, message: err.message }])
      if (err instanceof ApiError && err.code === 'VALIDATION_ERROR' && err.fields) {
        throw gateError(Object.values(err.fields).map((message) => ({ itemId: idToString(row.id), where: `Soalan ${q.label}`, message })))
      }
      throw err
    }

    await tx.intakeItem.update({
      where: { id: row.id },
      data: {
        reviewState: 'accepted',
        questionId: idFromString(created.id),
        questionVersionNo: created.version.versionNo,
        decidedById: idFromString(auth.userId),
        decidedAt: new Date(),
      },
    })
    await tx.intakeItemEvent.create({
      data: {
        itemId: row.id,
        event: 'accepted',
        fromState: row.reviewState,
        toState: 'accepted',
        afterValue: { questionId: created.id, version: created.version.versionNo },
        actorUserId: idFromString(auth.userId),
        actorRole: auth.active.role,
      },
    })
    await this.record(INTAKE_AUDIT.itemAccepted, auth, row, who, { from: row.reviewState, to: 'accepted', questionId: created.id }, tx)
  }

  /**
   * The bank stimulus group of an item's stimulus: the group of an already accepted item of the same stimulus, else a new
   * bank stimulus and group made from a SNAPSHOT of the intake stimulus (text, caption, alt, the stored crop; D6). Both are
   * created through `QuestionsService`.
   */
  private async bankGroupFor(row: ItemRow, ownerId: string): Promise<string> {
    void ownerId
    const sibling = await this.prisma.client.intakeItem.findFirst({
      where: { stimulusId: row.stimulusId, reviewState: 'accepted', questionId: { not: null } },
      orderBy: { id: 'asc' },
      select: { questionId: true },
    })
    if (sibling?.questionId) {
      const rec = await this.questionsRepo.get(idToString(sibling.questionId), 'latest')
      if (rec?.groupId) return rec.groupId
    }
    const s = row.stimulus as NonNullable<ItemRow['stimulus']>
    const crop =
      s.figureId === null
        ? null
        : await this.prisma.client.intakeFigure.findUnique({ where: { id: s.figureId }, select: { cropFileId: true } })
    const table = stimulusTableOf(s.tableData)
    const body = s.body ?? (table ? [table.head.join(' | '), ...table.rows.map((r) => r.join(' | '))].join('\n') : null)
    const stimulusId = await this.questions.createStimulus({
      kind: s.kind as 'passage' | 'diagram' | 'table',
      label: s.label || null,
      bodyMs: body,
      bodyEn: null,
      altText: s.altText || null,
      assetFileId: crop?.cropFileId ?? null,
    })
    return this.questions.createStimulusGroup({ label: s.label || null, scope: 'section', stimulusIds: [stimulusId], optionBank: [] })
  }

  // ---- bulk ----------------------------------------------------------------------------------------

  async bulk(auth: AuthContext, body: IntakeBulkRequest, who: CallerInfo): Promise<IntakeBulkResult> {
    if (body.action === 'accept' && !isAdmin(auth)) throw ApiError.of('FORBIDDEN')
    const threshold = body.action === 'accept' ? this.config.bulkAcceptMinBand : null
    const results: IntakeBulkResult['results'] = []
    for (const idText of body.ids) {
      results.push(await this.bulkOne(auth, idText, body, threshold, who))
    }
    const done = results.filter((r) => r.outcome === 'done').length
    await this.audit.record({
      action: INTAKE_AUDIT.itemsBulk,
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      scopeLevel: auth.active.scope.level,
      schoolId: auth.active.scope.schoolId ?? null,
      targetType: 'intake_item',
      requestId: who.requestId,
      ip: who.ip,
      isTest: auth.mode !== null,
      details: { action: body.action, requested: body.ids.length, done, skipped: results.length - done, ...(threshold ? { threshold } : {}) },
    })
    return { action: body.action, threshold, results, done, skipped: results.length - done }
  }

  private async bulkOne(auth: AuthContext, idText: string, body: IntakeBulkRequest, threshold: IntakeBulkResult['threshold'], who: CallerInfo): Promise<IntakeBulkResult['results'][number]> {
    const skip = (reason: 'NOT_FOUND' | 'WRONG_STATE' | 'GATE_FAILED' | 'BELOW_THRESHOLD', issues?: IntakeIssue[]) => ({
      id: idText,
      outcome: 'skipped' as const,
      reason,
      ...(issues ? { issues } : {}),
      item: null,
    })
    const id = parseId(idText)
    const row = id === null ? null : await this.prisma.client.intakeItem.findFirst({ where: { id, batch: visibleBatches(auth) }, include: ITEM_INCLUDE })
    if (!row) return skip('NOT_FOUND')
    if (!OPEN.includes(row.reviewState as IntakeItemState)) return skip('WRONG_STATE')
    if (body.action === 'accept') {
      if (row.reviewState === 'duplicate') return skip('WRONG_STATE')
      if (threshold && !bandReaches(bandOf(row), threshold)) return skip('BELOW_THRESHOLD')
    }
    try {
      await this.prisma.transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM intake_items WHERE id = ${row.id} FOR UPDATE`
        const fresh = await tx.intakeItem.findFirst({ where: { id: row.id, batch: visibleBatches(auth) }, include: ITEM_INCLUDE })
        if (!fresh) throw notFound()
        if (body.action === 'accept') await this.acceptRow(tx, auth, fresh, who)
        else {
          if (!OPEN.includes(fresh.reviewState as IntakeItemState)) throw conflict(INTAKE_MESSAGES.itemLocked)
          await this.decide(tx, auth, fresh, 'rejected', body.reason as string, who)
        }
      }, TX)
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'VALIDATION_ERROR') return skip('GATE_FAILED', ((err.details as { issues?: IntakeIssue[] } | undefined)?.issues ?? []).slice(0, 50))
        if (err.code === 'CONFLICT') return skip('WRONG_STATE')
        if (err.code === 'NOT_FOUND') return skip('NOT_FOUND')
      }
      throw err
    }
    const after = await this.prisma.client.intakeItem.findFirst({ where: { id: row.id }, include: ITEM_INCLUDE })
    const [wire] = after ? await this.views.rows(auth, [after]) : []
    return { id: idText, outcome: 'done', reason: null, item: (wire ?? null) as IntakeItemRow | null }
  }

  // ---- audit ---------------------------------------------------------------------------------------

  private async record(action: string, auth: AuthContext, row: Pick<ItemRow, 'id' | 'batchId'>, who: CallerInfo, details: Record<string, unknown>, tx: TxClient): Promise<void> {
    await this.audit.record({
      action,
      actorUserId: auth.userId,
      actorRole: auth.active.role,
      scopeLevel: auth.active.scope.level,
      schoolId: auth.active.scope.schoolId ?? null,
      targetType: 'intake_item',
      targetId: idToString(row.id),
      requestId: who.requestId,
      ip: who.ip,
      isTest: auth.mode !== null,
      details: { batchId: idToString(row.batchId), ...details },
      tx,
    })
  }
}

/** Band of an item is its lowest field confidence (no data counts as high). Boundaries as `intakeConfidenceBand`. */
const BAND_WHERE: Record<'high' | 'medium' | 'low', Prisma.IntakeItemWhereInput[]> = {
  high: [{ lowestConfidence: null, sourceType: 'manual' }, { lowestConfidence: { gte: 0.9 } }],
  medium: [{ lowestConfidence: { gte: 0.7, lt: 0.9 } }],
  low: [{ lowestConfidence: { lt: 0.7 } }, { lowestConfidence: null, sourceType: { not: 'manual' } }],
}

/** "An entry with status open of that kind": any = an open exact or near entry; none = no open entry of any kind. */
const DUPLICATE_WHERE: Record<'any' | 'exact' | 'near' | 'variant' | 'none', Prisma.IntakeItemWhereInput> = {
  any: { duplicates: { some: { decision: 'pending', kind: { in: ['exact', 'near'] } } } },
  exact: { duplicates: { some: { decision: 'pending', kind: 'exact' } } },
  near: { duplicates: { some: { decision: 'pending', kind: 'near' } } },
  variant: { duplicates: { some: { decision: 'pending', kind: 'variant' } } },
  none: { duplicates: { none: { decision: 'pending' } } },
}

