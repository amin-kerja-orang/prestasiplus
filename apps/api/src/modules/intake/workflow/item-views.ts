import { Inject, Injectable } from '@nestjs/common'
import {
  IntakeItemRowSchema,
  IntakeItemSchema,
  type IntakeActorRef,
  type IntakeDuplicateEntry,
  type IntakeIssue,
  type IntakeItem,
  type IntakeItemGroup,
  type IntakeItemEvent,
  type IntakeItemRow,
  type IntakeItemState,
  type IntakeProvenance,
  type IntakeStimulus,
} from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import type { AuthContext } from '../../../common/scope/auth-context'
import { idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { QuestionsRepository } from '../../questions'
import { isAdmin } from '../files/intake-access'
import { CurriculumFactsService, type TagResolver } from './curriculum-facts'
import { itemIssues, questionMarks } from './gate'
import {
  bandOf,
  entryStatus,
  fieldConfidenceOf,
  payloadOf,
  questionOf,
  regionOf,
  stimulusOf,
  type DuplicateRow,
  type ItemRow,
} from './item-model'
import { WORKFLOW_MESSAGES } from './workflow.constants'

const FINAL: readonly IntakeItemState[] = ['accepted', 'rejected']

/** Plain-text preview of a stem (first part prompt when the stem is empty), at most 300 characters. */
export function preview(stem: string, firstPrompt: string | undefined): string {
  const text = (stem.trim() !== '' ? stem : (firstPrompt ?? '')).replace(/\s+/g, ' ').trim()
  const chars = [...text]
  return chars.length <= 300 ? text : chars.slice(0, 300).join('')
}

/** Everything a view needs that is not on the item row itself, loaded once for a whole page of rows. */
interface Lookups {
  users: Map<string, string>
  questions: Map<string, { status: string }>
  visibleQuestionIds: Set<string>
  stimuli: Map<string, IntakeStimulus>
}

/**
 * Builds the wire shapes of items (`IntakeItemRow`, `IntakeItem`). It computes the gate issues of open items live (never
 * stored), reads the status of an accepted item's question from its owner, and withholds the id of a bank question that the
 * caller may not read (a Guru only reads own questions, BE-09 scope).
 */
@Injectable()
export class ItemViews {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly questions: QuestionsRepository,
    @Inject(CurriculumFactsService) private readonly facts: CurriculumFactsService,
  ) {}

  /** Live gate issues of open items; none for an accepted or rejected item. */
  async issuesOf(rows: readonly ItemRow[], resolver: TagResolver = this.facts.resolver()): Promise<Map<string, IntakeIssue[]>> {
    const out = new Map<string, IntakeIssue[]>()
    // One statement per subject and level for every unit and SP code of the page, instead of one per code and row.
    await resolver.prefetch(rows.filter((r) => !FINAL.includes(r.reviewState as IntakeItemState)).map((r) => questionOf(r).tag))
    for (const row of rows) {
      const id = idToString(row.id)
      if (FINAL.includes(row.reviewState as IntakeItemState)) {
        out.set(id, [])
        continue
      }
      const q = questionOf(row)
      const { facts } = await resolver.resolve(q.tag)
      out.set(id, itemIssues(q, row.stimulus ? stimulusOf(row.stimulus) : undefined, facts))
    }
    return out
  }

  private async lookups(auth: AuthContext, rows: readonly ItemRow[], extraUserIds: Iterable<bigint> = []): Promise<Lookups> {
    const userIds = new Set<bigint>(extraUserIds)
    const questionIds = new Set<string>()
    const matchedQuestions = new Set<string>()
    for (const r of rows) {
      if (r.batch.ownerUserId !== null) userIds.add(r.batch.ownerUserId)
      if (r.decidedById !== null) userIds.add(r.decidedById)
      if (r.questionId !== null) questionIds.add(idToString(r.questionId))
      for (const d of r.duplicates) if (d.matchedQuestionId !== null) matchedQuestions.add(idToString(d.matchedQuestionId))
    }
    const users = new Map<string, string>()
    if (userIds.size > 0) {
      for (const u of await this.prisma.client.user.findMany({ where: { id: { in: [...userIds] } }, select: { id: true, name: true } })) users.set(idToString(u.id), u.name)
    }
    const questions = new Map<string, { status: string }>()
    if (questionIds.size > 0) {
      for (const rec of await this.questions.getMany([...questionIds], 'latest')) questions.set(rec.id, { status: rec.version.status })
    }
    const visibleQuestionIds = new Set<string>()
    for (const id of matchedQuestions) {
      if (isAdmin(auth)) {
        if ((await this.questions.ownerOf(id)) !== undefined) visibleQuestionIds.add(id)
      } else if ((await this.questions.ownerOf(id)) === auth.userId) {
        visibleQuestionIds.add(id)
      }
    }
    const stimuli = new Map<string, IntakeStimulus>()
    for (const r of rows) if (r.stimulus) stimuli.set(idToString(r.stimulus.id), stimulusOf(r.stimulus))
    return { users, questions, visibleQuestionIds, stimuli }
  }

  private actor(users: Map<string, string>, id: bigint | null): IntakeActorRef | null {
    if (id === null) return null
    const name = users.get(idToString(id))
    return name === undefined ? null : { id: idToString(id), name }
  }

  private uploader(row: ItemRow): IntakeActorRef {
    const o = row.batch.owner
    return o ? { id: idToString(o.id), name: o.name } : { id: '0', name: WORKFLOW_MESSAGES.userDeleted }
  }

  private duplicateEntries(auth: AuthContext, rows: readonly DuplicateRow[], l: Lookups): IntakeDuplicateEntry[] {
    return rows.map((d) => {
      const kind = d.kind as IntakeDuplicateEntry['kind']
      const similarity = d.similarity === null ? null : Number(d.similarity)
      const status = entryStatus(d.decision)
      if (d.matchedItemId !== null) {
        return { id: idToString(d.id), kind, scope: 'batch', similarity, matchedQuestionId: null, matchedItemId: idToString(d.matchedItemId), restricted: false, status }
      }
      const qid = idToString(d.matchedQuestionId as bigint)
      const visible = l.visibleQuestionIds.has(qid)
      return { id: idToString(d.id), kind, scope: 'bank', similarity, matchedQuestionId: visible ? qid : null, matchedItemId: null, restricted: !visible, status }
    })
  }

  private common(auth: AuthContext, row: ItemRow, l: Lookups) {
    return {
      batchId: idToString(row.batchId),
      position: row.position,
      state: row.reviewState as IntakeItemState,
      confidenceBand: bandOf(row),
      uploader: this.uploader(row),
      question:
        row.questionId === null
          ? null
          : {
              id: idToString(row.questionId),
              version: row.questionVersionNo ?? 1,
              status: (l.questions.get(idToString(row.questionId))?.status ?? 'draft') as 'draft',
            },
      duplicates: this.duplicateEntries(auth, row.duplicates, l),
      createdAt: toMytTimestamp(row.createdAt),
      updatedAt: toMytTimestamp(row.updatedAt),
    }
  }

  /**
   * REQ-B-035 (D90): the group of each row whose stimulus is shared by 2 or more items of its batch. One grouped read for the whole page
   * (the members are counted across the batch, not only on the page): size, and the 1-based place in paper order.
   * The size counts REJECTED members too (D90: a group is the items that share the figure, in any state; a reviewer who rejects one member
   * still sees the group as it was extracted).
   */
  private async groupsOf(rows: readonly ItemRow[]): Promise<Map<string, IntakeItemGroup>> {
    const out = new Map<string, IntakeItemGroup>()
    const stimulusIds = [...new Set(rows.flatMap((r) => (r.stimulusId === null ? [] : [r.stimulusId])))]
    if (stimulusIds.length === 0) return out
    const members = await this.prisma.client.intakeItem.findMany({
      where: { stimulusId: { in: stimulusIds } },
      select: { id: true, stimulusId: true },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
    })
    const byStimulus = new Map<string, bigint[]>()
    for (const m of members) {
      const key = idToString(m.stimulusId as bigint)
      byStimulus.set(key, [...(byStimulus.get(key) ?? []), m.id])
    }
    for (const row of rows) {
      if (row.stimulusId === null) continue
      const key = idToString(row.stimulusId)
      const ids = byStimulus.get(key) ?? []
      if (ids.length < 2) continue
      out.set(idToString(row.id), { key, label: row.stimulus?.label ?? '', size: ids.length, position: ids.indexOf(row.id) + 1 })
    }
    return out
  }

  /** Rows of the review queue. */
  async rows(auth: AuthContext, rows: readonly ItemRow[]): Promise<IntakeItemRow[]> {
    const l = await this.lookups(auth, rows)
    const issues = await this.issuesOf(rows)
    const groups = await this.groupsOf(rows)
    return rows.map((row) => {
      const q = questionOf(row)
      const id = idToString(row.id)
      const lowCount = q.lowFields.filter((f) => !q.confirmed.includes(f)).length
      return IntakeItemRowSchema.parse({
        id,
        label: q.label,
        type: q.type,
        stemPreview: preview(q.stem, q.parts[0]?.prompt),
        marks: questionMarks(q),
        page: q.page,
        subject: row.batch.subject,
        ...(row.stimulusId === null ? {} : { stimulusId: idToString(row.stimulusId) }),
        ...(groups.get(id) === undefined ? {} : { group: groups.get(id) }),
        lowCount,
        issueCount: (issues.get(id) ?? []).length,
        needsManual: row.needsManual,
        ...this.common(auth, row, l),
      })
    })
  }

  /** One item with its fields, history, gate issues and provenance. */
  async detail(auth: AuthContext, row: ItemRow): Promise<IntakeItem> {
    const events = await this.prisma.client.intakeItemEvent.findMany({ where: { itemId: row.id }, orderBy: { id: 'asc' } })
    const l = await this.lookups(auth, [row], events.flatMap((e) => (e.actorUserId === null ? [] : [e.actorUserId])))
    const issues = (await this.issuesOf([row])).get(idToString(row.id)) ?? []
    const q = questionOf(row)
    const stored = payloadOf(row)
    const provenance: IntakeProvenance = {
      sourceType: row.sourceType as 'pdf' | 'manual',
      fileId: row.intakeFileId === null ? null : idToString(row.intakeFileId),
      sourcePaperId: row.batch.sourcePaperId === null ? null : idToString(row.batch.sourcePaperId),
      page: stored.origin?.page ?? row.pageNo,
      region: regionOf(row),
      numberLabel: stored.origin?.label ?? row.numberLabel,
      runId: row.aiRunId === null ? null : idToString(row.aiRunId),
      provider: row.run?.provider ?? null,
      model: row.run?.model ?? null,
    }
    const wireEvents: IntakeItemEvent[] = events.map((e) => ({
      id: idToString(e.id),
      at: toMytTimestamp(e.createdAt),
      action: e.event as IntakeItemEvent['action'],
      actor: this.actor(l.users, e.actorUserId),
      actorRole: e.actorRole,
      from: (e.fromState as IntakeItemState | null) ?? null,
      to: (e.toState as IntakeItemState | null) ?? null,
      field: e.field,
      previous: e.beforeValue ?? null,
      reason: e.reason,
    }))
    return IntakeItemSchema.parse({
      ...q,
      ...this.common(auth, row, l),
      fieldConfidence: fieldConfidenceOf(row),
      region: regionOf(row),
      humanEdited: row.humanEdited,
      issues,
      stimulus: row.stimulus ? stimulusOf(row.stimulus) : null,
      rejectReason: row.rejectReason,
      decidedBy: this.actor(l.users, row.decidedById),
      decidedAt: row.decidedAt === null ? null : toMytTimestamp(row.decidedAt),
      provenance,
      events: wireEvents,
    })
  }
}
