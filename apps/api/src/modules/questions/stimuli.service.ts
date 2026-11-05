import { Inject, Injectable } from '@nestjs/common'
import {
  IMAGE_STIMULUS_KINDS,
  QUESTION_MESSAGES,
  STIMULUS_LIMITS,
  STIMULUS_MEMBER_STEM_MAX,
  STIMULUS_MESSAGES,
  type StimulusCreateRequest,
  type StimulusGroupCreateRequest,
  type StimulusGroupDetail,
  type StimulusGroupPublishGateDetail,
  type StimulusGroupListRow,
  type StimulusListRow,
  type StimulusGroupUpdateRequest,
  type StimulusUpdateRequest,
  type Stimulus,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { FilesService } from '../files'
import { GroupMembers } from './group-members'
import { stimulusTableParts } from './stimulus-table'
import { type GroupRow, type GroupScope, type ListFilter, type MemberBrief, type MemberTrait, type StimulusData, type StimulusRow, StimuliRepository, plainExcerpt } from './stimuli.repository'
import { QuestionsService } from './questions.service'
import type { BulkFailure, BulkSkipped } from './errors'
import { STIMULUS_KINDS } from './types'
import type { QuestionBulkAction } from './types'
import type { QuestionActor, QuestionCreateInput, QuestionView } from './types'

const memberOf = ({ groupId: _g, ...m }: MemberBrief) => {
  void _g
  return m
}

const TX = { timeout: 20_000, maxWait: 10_000 } as const
const IMAGE_PURPOSE = 'question_image'

const fail = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })
const notFound = (message: string): ApiError => ApiError.of('NOT_FOUND', { message })
const conflictOf = (message: string): ApiError => ApiError.of('CONFLICT', { message })

/** The caller of a group action: the question actor plus what the status events and the audit row need. */
export type GroupActor = QuestionActor & { roleCode: string; requestId: string | null }

/** Result shape of a bulk status action (the contract `QuestionBulkResult` without the flash). */
export interface BulkOutcome {
  affected: number
  ids: string[]
  failed: BulkFailure[]
  skipped?: BulkSkipped[]
}

/** Kertas of a trait ('1'..'3' text) as the smallint of the group row. */
const kertasNumber = (k: '1' | '2' | '3' | null): number | null => (k === null ? null : Number(k))
const kertasText = (n: number | null): '1' | '2' | '3' | null => (n === 1 ? '1' : n === 2 ? '2' : n === 3 ? '3' : null)

/** One summary of what a write changed: ids and counts only (the audit row never carries content). */
export interface StimulusWrite<T> {
  result: T
  audit: Record<string, unknown>
}

/**
 * Stimulus library and stimulus groups for the Studio (R1-T32, D90). Business rules:
 * - a stimulus is one of the seven kinds; pictures are `question_image` files, never inline SVG or HTML;
 * - a group has 1 to 3 stimuli and 1..n member questions (0 members is a draft group, never published or placed in a paper); it carries no marks and is never a question;
 * - a question is in at most one group; removal of the last member succeeds with a BM warning (the group is then empty);
 * - a stimulus used by a group, a question version or a part cannot be deleted.
 * Every write runs in one transaction with the rows it depends on locked.
 */
@Injectable()
export class StimuliService {
  constructor(
    @Inject(StimuliRepository) private readonly repo: StimuliRepository,
    @Inject(GroupMembers) private readonly members: GroupMembers,
    @Inject(QuestionsService) private readonly questions: QuestionsService,
    @Inject(FilesService) private readonly files: FilesService,
    @Inject(PrismaService) private readonly prisma: PrismaService,
  ) {}

  // --- stimuli ------------------------------------------------------------------------------------

  async getStimulus(id: string): Promise<Stimulus> {
    return this.stimulusView(await this.stimulusOrThrow(id))
  }

  async createStimulus(input: StimulusCreateRequest): Promise<StimulusWrite<Stimulus>> {
    const fields: Record<string, string> = {}
    const assetFileId = await this.imageOf(input.imageFileId, fields)
    if (Object.keys(fields).length > 0) throw fail(fields)
    const data: StimulusData = {
      kind: input.kind,
      label: input.label ?? null,
      caption: input.caption ?? null,
      bodyMs: input.body?.ms ?? null,
      bodyEn: input.body?.en ?? null,
      altText: input.alt ?? null,
      sourceCitation: input.sourceCitation ?? null,
      style: input.style ?? null,
      tableData: input.tableData ?? null,
      assetFileId,
    }
    const id = await this.repo.createStimulus(data)
    return { result: await this.getStimulus(id), audit: { kind: input.kind } }
  }

  async updateStimulus(id: string, input: StimulusUpdateRequest): Promise<StimulusWrite<Stimulus>> {
    await this.stimulusOrThrow(id) // 404 before 422
    return this.prisma.transaction(async () => {
      if (!(await this.repo.lockStimulus(id))) throw notFound(STIMULUS_MESSAGES.notFound)
      const current = await this.stimulusOrThrow(id)
      if (await this.repo.stimulusServed(id)) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.stimulusServed })
      const fields: Record<string, string> = {}
      let assetFileId = current.assetFileId
      if (input.imageFileId !== undefined) {
        const next = await this.imageOf(input.imageFileId, fields)
        assetFileId = next
      }
      // A table the intake stored as a pipe table in the body (no grid) is shown as the grid only. When the Studio sends a grid for it and no
      // body, the old pipe body goes: it would otherwise stay in the row and be shown beside the new grid.
      const replacesBodyTable = current.bodyIsTable && input.tableData != null && input.body === undefined
      const body = replacesBodyTable
        ? { ms: null, en: null }
        : input.body === undefined
          ? { ms: current.bodyMs, en: current.bodyEn }
          : { ms: input.body?.ms ?? null, en: input.body?.en ?? null }
      const data: StimulusData = {
        kind: current.kind,
        label: input.label === undefined ? current.label : input.label,
        caption: input.caption === undefined ? current.caption : input.caption,
        bodyMs: body.ms,
        bodyEn: body.en,
        altText: input.alt === undefined ? current.altText : input.alt,
        sourceCitation: input.sourceCitation === undefined ? current.sourceCitation : input.sourceCitation,
        style: input.style === undefined ? current.style : input.style,
        tableData: input.tableData === undefined ? current.tableData : input.tableData,
        assetFileId,
      }
      // The merged state must still satisfy the rules of the kind (same rules as the create body).
      if (data.kind === 'passage' && !data.bodyMs) fields.body ??= STIMULUS_MESSAGES.bodyRequired
      if (data.kind === 'table' && data.tableData === null && data.assetFileId === null && !stimulusTableParts('table', null, data.bodyMs).table) fields.tableData ??= STIMULUS_MESSAGES.tableRequired
      if ((IMAGE_STIMULUS_KINDS as readonly string[]).includes(data.kind) && data.assetFileId === null) fields.imageFileId ??= STIMULUS_MESSAGES.imageRequired
      if (Object.keys(fields).length > 0) throw fail(fields)
      await this.repo.updateStimulus(id, data)
      return { result: await this.getStimulus(id), audit: { kind: data.kind, keys: Object.keys(input) } }
    }, TX)
  }

  async deleteStimulus(id: string): Promise<StimulusWrite<{ deleted: 1 }>> {
    return this.prisma.transaction(async () => {
      if (!(await this.repo.lockStimulus(id))) throw notFound(STIMULUS_MESSAGES.notFound)
      await this.stimulusOrThrow(id)
      const use = await this.repo.usageOf(id)
      if (use.groups + use.versions + use.parts > 0) {
        const n = await this.repo.usingQuestionCount(id)
        throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.stimulusInUse(n), details: { ...use, n } })
      }
      await this.repo.deleteStimulus(id)
      return { result: { deleted: 1 as const }, audit: {} }
    }, TX)
  }

  // --- groups -------------------------------------------------------------------------------------

  async getGroup(id: string): Promise<StimulusGroupDetail> {
    return this.groupView(await this.groupOrThrow(id))
  }

  async createGroup(input: StimulusGroupCreateRequest): Promise<StimulusWrite<StimulusGroupDetail>> {
    return this.prisma.transaction(async () => {
      const fields: Record<string, string> = {}
      const stimulusIds = await this.checkStimuli(input.stimulusIds, fields)
      if (Object.keys(fields).length > 0) throw fail(fields)
      await this.checkScopeRefs(input, fields)
      if (Object.keys(fields).length > 0) throw fail(fields)
      const given: GroupScope = { subjectId: input.subjectId ?? null, educationLevelId: input.educationLevelId ?? null, kertas: input.kertas === undefined || input.kertas === null ? null : Number(input.kertas) }
      const id = await this.repo.createGroup({
        label: input.label ?? null,
        scope: input.scope ?? 'section',
        stimulusIds,
        optionBank: (input.optionBank ?? []).map((o) => ({ label: o.label, bodyMs: o.body.ms, bodyEn: o.body.en ?? null })),
        traits: given,
      })
      // D93: 0 or more members; the same rules as every later member change (a failure rolls the group back).
      const members = input.questionIds.length === 0 ? [] : await this.members.set(id, input.questionIds)
      // DM-51: a scope field the request left out is taken from the members (the common value, else none).
      const derived = await this.commonScope(id)
      await this.repo.setGroupScope(id, {
        subjectId: input.subjectId ?? derived.subjectId,
        educationLevelId: input.educationLevelId ?? derived.educationLevelId,
        kertas: input.kertas === undefined ? derived.kertas : given.kertas,
      })
      return { result: await this.getGroup(id), audit: { stimuli: stimulusIds.length, members: members.length } }
    }, TX)
  }

  async updateGroup(id: string, input: StimulusGroupUpdateRequest): Promise<StimulusWrite<StimulusGroupDetail>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const fields: Record<string, string> = {}
      const stimulusIds = input.stimulusIds === undefined ? null : await this.checkStimuli(input.stimulusIds, fields)
      if (Object.keys(fields).length > 0) throw fail(fields)
      await this.checkScopeRefs(input, fields)
      if (Object.keys(fields).length > 0) throw fail(fields)
      if (stimulusIds !== null) await this.members.assertNotServed(id) // what the served questions show changes
      if (input.subjectId !== undefined || input.educationLevelId !== undefined || input.kertas !== undefined) await this.changeScope(id, input)
      if (input.label !== undefined) await this.repo.setGroupLabel(id, input.label)
      if (stimulusIds !== null) await this.repo.replaceGroupStimuli(id, stimulusIds)
      return { result: await this.getGroup(id), audit: { keys: Object.keys(input) } }
    }, TX)
  }

  async deleteGroup(id: string): Promise<StimulusWrite<{ deleted: 1; releasedQuestionIds: string[] }>> {
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      await this.members.assertNotServed(id)
      const members = (await this.groupOrThrow(id)).questionIds.map(idToString)
      await this.repo.lockQuestions(members)
      const released = await this.repo.deleteGroup(id)
      return { result: { deleted: 1 as const, releasedQuestionIds: released }, audit: { released: released.length } }
    }, TX)
  }

  async addMember(id: string, questionId: string): Promise<StimulusWrite<StimulusGroupDetail>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const current = await this.members.current(id)
      if (current.includes(questionId)) throw fail({ questionId: STIMULUS_MESSAGES.memberExists })
      const after = await this.members.set(id, [...current, questionId], 'questionId')
      return { result: await this.getGroup(id), audit: { added: 1, members: after.length } }
    }, TX)
  }

  async removeMember(id: string, questionId: string): Promise<StimulusWrite<{ group: StimulusGroupDetail; warning: string | null }>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const current = await this.members.current(id)
      if (!current.includes(questionId)) throw notFound(STIMULUS_MESSAGES.memberMissing)
      const rest = await this.members.set(id, current.filter((m) => m !== questionId))
      return {
        result: { group: await this.getGroup(id), warning: this.members.warning(rest.length) },
        audit: { removed: 1, members: rest.length },
      }
    }, TX)
  }

  async reorderMembers(id: string, questionIds: readonly string[]): Promise<StimulusWrite<StimulusGroupDetail>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const current = await this.members.current(id)
      const same = questionIds.length === current.length && new Set(questionIds).size === current.length && questionIds.every((q) => current.includes(q))
      if (!same) throw fail({ questionIds: STIMULUS_MESSAGES.orderInvalid })
      await this.members.set(id, questionIds)
      return { result: await this.getGroup(id), audit: { members: current.length } }
    }, TX)
  }

  /** The complete ordered member list after the change, in one atomic call (adds, removals and reordering). */
  async setMembers(id: string, questionIds: readonly string[]): Promise<StimulusWrite<StimulusGroupDetail>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      const after = await this.members.set(id, questionIds)
      return { result: await this.getGroup(id), audit: { members: after.length } }
    }, TX)
  }

  /** A new question created inside the group (appended at the end). The body is the `POST /questions` body. */
  async createQuestionInGroup(id: string, input: QuestionCreateInput, actor: QuestionActor): Promise<QuestionView> {
    await this.groupOrThrow(id)
    if (input.stimulusGroupId !== undefined && input.stimulusGroupId !== null && input.stimulusGroupId !== id) {
      throw fail({ stimulusGroupId: STIMULUS_MESSAGES.groupMismatch })
    }
    return this.questions.create({ ...input, stimulusGroupId: id }, actor)
  }


  // --- scope (S1-T01, DM-51) ----------------------------------------------------------------------

  /** The subject and level a request names must exist (422 on the field, like the question routes). */
  private async checkScopeRefs(input: { subjectId?: string | undefined; educationLevelId?: string | undefined }, fields: Record<string, string>): Promise<void> {
    if (input.subjectId !== undefined && !(await this.repo.subjectExists(input.subjectId))) fields.subjectId = QUESTION_MESSAGES.subject
    if (input.educationLevelId !== undefined && !(await this.repo.levelExists(input.educationLevelId))) fields.educationLevelId = QUESTION_MESSAGES.level
  }

  /** The common Subjek, Tingkatan and Kertas of the members (a value only when every member has the same one), else null. Zero members: all null. */
  private async commonScope(groupId: string): Promise<GroupScope> {
    const traits = await this.repo.memberTraits(groupId)
    const common = <T extends string | null>(pick: (t: MemberTrait) => T): T | null => {
      const values = new Set(traits.map(pick))
      const only = [...values][0]
      return traits.length > 0 && values.size === 1 && only !== null && only !== undefined ? only : null
    }
    return { subjectId: common((t) => t.subjectId), educationLevelId: common((t) => t.levelId), kertas: kertasNumber(common((t) => t.kertas)) }
  }

  /** PUT scope: allowed while the group has no member or every member already matches the new value, else 422 `memberScope`. */
  private async changeScope(id: string, input: { subjectId?: string | undefined; educationLevelId?: string | undefined; kertas?: '1' | '2' | '3' | null | undefined }): Promise<void> {
    const current = await this.repo.groupScope(id)
    if (current === null) throw notFound(STIMULUS_MESSAGES.groupNotFound)
    const next: GroupScope = {
      subjectId: input.subjectId ?? current.subjectId,
      educationLevelId: input.educationLevelId ?? current.educationLevelId,
      kertas: input.kertas === undefined ? current.kertas : input.kertas === null ? null : Number(input.kertas),
    }
    const field = input.subjectId !== undefined ? 'subjectId' : input.educationLevelId !== undefined ? 'educationLevelId' : 'kertas'
    for (const trait of await this.repo.memberTraits(id)) {
      if (next.subjectId !== null && trait.subjectId !== next.subjectId) throw fail({ [field]: STIMULUS_MESSAGES.memberScope })
      if (next.educationLevelId !== null && trait.levelId !== next.educationLevelId) throw fail({ [field]: STIMULUS_MESSAGES.memberScope })
      if (next.kertas !== null && trait.kertas !== null && String(next.kertas) !== trait.kertas) throw fail({ [field]: STIMULUS_MESSAGES.memberKertas })
    }
    await this.repo.setGroupScope(id, next)
  }

  // --- group actions (S1-T01, API-Q-04 groupId, API-Q-31..35) -------------------------------------

  /** "Soalan {no}: {mesej}" per member whose `gate` fails (no = place in the group); empty when every member passes. Reads only. */
  private async gateLines(members: readonly { id: string; position: number }[], gate: 'submit' | 'approve'): Promise<StimulusGroupPublishGateDetail[]> {
    const lines: StimulusGroupPublishGateDetail[] = []
    for (const m of members) {
      const fields = await this.questions.gateFieldsOf(m.id, gate)
      const messages = [...new Set(Object.values(fields))]
      if (messages.length > 0) lines.push({ questionId: m.id, message: `Soalan ${String(m.position)}: ${messages.join(' ')}` })
    }
    return lines
  }

  private gateRefusal(gate: StimulusGroupPublishGateDetail[]): ApiError {
    return ApiError.of('VALIDATION_ERROR', { details: { gate } })
  }

  private statusEvent(actor: GroupActor): { actorUserId: string; actorRole: string; requestId: string | null } {
    return { actorUserId: actor.userId, actorRole: actor.roleCode, requestId: actor.requestId }
  }

  /**
   * API-Q-31 core: every member `review` or `approved` (else 409 `publishNotReady`), then the approve gate for every `review` member
   * (collected: 422 `details.gate[]`, nothing changes), then all `review` members become `approved` in ONE transaction. `apply = false`
   * only checks. Returns the ids that move.
   */
  private async publishMembers(id: string, actor: GroupActor, apply: boolean): Promise<string[]> {
    const members = await this.repo.memberStatuses(id)
    if (members.length === 0) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.builderBlocker })
    if (members.some((m) => m.status !== 'review' && m.status !== 'approved')) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.publishNotReady })
    const moving = members.filter((m) => m.status === 'review')
    const gate = await this.gateLines(moving, 'approve')
    if (gate.length > 0) throw this.gateRefusal(gate)
    if (apply) for (const m of moving) await this.questions.setStatus(m.id, 'approved', actor.userId, { event: this.statusEvent(actor) })
    return moving.map((m) => m.id)
  }

  /**
   * API-Q-31. On a draft copy (`draftOfGroupId` set) it is the SWAP (part 3b, lead decision 25): see `swapDraft`. On any other group every member
   * `review` becomes `approved` in one transaction.
   */
  async publishGroup(id: string, actor: GroupActor): Promise<StimulusWrite<StimulusGroupDetail>> {
    const group = await this.groupOrThrow(id)
    if (group.draftOfGroupId !== null) return this.swapDraft(group, actor)
    const moved = await this.prisma.transaction(async () => {
      await this.members.lock(id)
      if ((await this.repo.groupScope(id))?.draftOfGroupId != null) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.conflict }) // became a copy meanwhile
      return this.publishMembers(id, actor, true)
    }, TX)
    this.questions.invalidateOverview()
    return { result: await this.getGroup(id), audit: { approved: moved.length, ids: moved.slice(0, 200) } }
  }

  /**
   * The swap (S1-T01 part 3b, lead decisions 25 and 26): publishing a draft copy replaces the served group, all or nothing, in ONE transaction.
   * 1. the gate of group publish on the members staged in the copy (409 / 422, nothing changes);
   * 2. the live group takes the copy's label, scope, option bank and stimuli (the copy's stimulus rows are relinked to the live group; the old rows are kept, unlinked);
   * 3. the staged members become the members of the live group in the staged order (added ones join, removed ones are released, served ones included);
   *    a member that was moved here from another group's copy is taken over from that group (it must no longer be staged there);
   * 4. every member in Menunggu Semakan is approved through `setStatus` (the old live version is archived `superseded`);
   * 5. the copy is deleted. The live group id never changes.
   */
  private async swapDraft(copy: GroupRow, actor: GroupActor): Promise<StimulusWrite<StimulusGroupDetail>> {
    const draftId = idToString(copy.id)
    const liveId = idToString(copy.draftOfGroupId as bigint)
    const sortIds = (ids: string[]): string[] => ids.sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))
    // Every group that holds a staged member is locked with the two groups, in ascending order, before any write (no deadlock between two swaps).
    const holders = [...(await this.repo.groupsOfQuestions(copy.draftMembers ?? [])).values()]
    const out = await this.prisma.transaction(async () => {
      for (const key of sortIds([...new Set([draftId, liveId, ...holders])])) await this.members.lock(key)
      const draft = await this.groupOrThrow(draftId)
      if (draft.draftOfGroupId === null || idToString(draft.draftOfGroupId) !== liveId) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.conflict })
      const staged = draft.draftMembers ?? []
      // The gate of group publish, before any write.
      if (staged.length === 0) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.builderBlocker })
      const statuses = await this.repo.statusesOf(staged)
      if (statuses.length !== staged.length || statuses.some((m) => m.status !== 'review' && m.status !== 'approved')) {
        throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.publishNotReady })
      }
      const before = await this.repo.memberIds(liveId)
      // A member moved here from another group (decision 26) leaves that group now; it must not be staged there any more.
      for (const [questionId, holder] of await this.repo.groupsOfQuestions(staged)) {
        if (holder === liveId) continue
        const otherCopy = await this.repo.draftCopyOf(holder)
        if (otherCopy === null || ((await this.groupOrThrow(otherCopy)).draftMembers ?? []).includes(questionId)) throw conflictOf(STIMULUS_MESSAGES.memberTaken)
        await this.members.set(holder, (await this.repo.memberIds(holder)).filter((m) => m !== questionId), 'questionId', undefined, true)
      }
      await this.repo.replaceFromCopy(liveId, draftId)
      await this.members.set(liveId, staged, 'questionIds', undefined, true)
      // The members as they are now must all fit the scope the copy brings.
      const scope = await this.repo.groupScope(liveId)
      for (const trait of await this.repo.memberTraits(liveId)) this.members.assertScope(scope, trait, 'questionIds')
      // The approve gate sees the final group (its stimuli); a refusal in any member rolls the whole swap back.
      const moved = await this.publishMembers(liveId, actor, true)
      await this.repo.deleteDraftCopy(draftId)
      return { moved, added: staged.filter((m) => !before.includes(m)).length, removed: before.filter((m) => !staged.includes(m)).length, members: staged.length }
    }, TX)
    this.questions.invalidateOverview()
    return {
      result: await this.getGroup(liveId),
      audit: { fromDraftId: draftId, approved: out.moved.length, ids: out.moved.slice(0, 200), added: out.added, removed: out.removed, members: out.members },
    }
  }

  /** Draft or review for every member of a group (API-Q-04 `groupId`, and a whole group in an `ids` list). `apply = false` only checks. */
  private async moveMembers(id: string, action: 'draft' | 'review', actor: GroupActor, apply: boolean): Promise<string[]> {
    const members = await this.repo.memberStatuses(id)
    if (members.length === 0) throw fail({ groupId: STIMULUS_MESSAGES.builderBlocker })
    if (action === 'review') {
      if (members.some((m) => m.status === 'archived')) throw ApiError.of('CONFLICT', { message: QUESTION_MESSAGES.groupArchivedMember })
      const moving = members.filter((m) => m.status === 'draft')
      const gate = await this.gateLines(moving, 'submit')
      if (gate.length > 0) throw this.gateRefusal(gate)
      if (apply) for (const m of moving) await this.questions.setStatus(m.id, 'review', actor.userId, { submitGate: true, event: this.statusEvent(actor) })
      return moving.map((m) => m.id)
    }
    const moving = members.filter((m) => m.status === 'review')
    if (apply) for (const m of moving) await this.questions.setStatus(m.id, 'draft', actor.userId, { event: this.statusEvent(actor) })
    return moving.map((m) => m.id)
  }

  /** Archives every member that is not archived yet (retire, and `archived` for a whole group in an `ids` list). */
  private async archiveMembers(id: string, actor: GroupActor, apply: boolean): Promise<string[]> {
    const moving = (await this.repo.memberStatuses(id)).filter((m) => m.status !== 'archived')
    if (apply) for (const m of moving) await this.questions.setStatus(m.id, 'archived', actor.userId, { event: this.statusEvent(actor) })
    return moving.map((m) => m.id)
  }

  /** One group moves as one unit in one transaction (or, with `apply = false`, is only checked). */
  private async groupUnit(id: string, action: 'draft' | 'review' | 'approved' | 'archived', actor: GroupActor, apply: boolean): Promise<string[]> {
    const run = (): Promise<string[]> =>
      action === 'approved' ? this.publishMembers(id, actor, apply) : action === 'archived' ? this.archiveMembers(id, actor, apply) : this.moveMembers(id, action, actor, apply)
    if (!apply) return run()
    const moved = await this.prisma.transaction(async () => {
      await this.members.lock(id)
      return run()
    }, TX)
    this.questions.invalidateOverview()
    return moved
  }

  /** API-Q-04 `{action: draft|review, groupId}`: the whole group in one transaction. An unknown group is 422 on `groupId`. */
  async bulkGroup(action: 'draft' | 'review', groupId: string, actor: GroupActor): Promise<BulkOutcome> {
    if ((await this.repo.groupScope(groupId)) === null) throw fail({ groupId: STIMULUS_MESSAGES.groupInvalid })
    const ids = await this.groupUnit(groupId, action, actor, true)
    return { affected: ids.length, ids, failed: [] }
  }

  /**
   * API-Q-04 `{action, ids}`: a list that holds part of a stimulus group is refused as a whole (422, `details.reason` `stimulus_group_split`, nothing
   * changes); a list that holds every member of a group moves that group as one unit (checked first for every group, then applied group by group,
   * ONE transaction for all of them); the other ids keep the per-id behaviour. `delete` is per id like before.
   */
  async bulkWithGroups(action: QuestionBulkAction, ids: readonly string[], actor: GroupActor, perId: (rest: string[]) => Promise<BulkOutcome>): Promise<BulkOutcome> {
    const held = await this.repo.groupsHolding(ids)
    const wholeGroups: string[] = []
    for (const [groupId, g] of held) {
      if (g.listed.length !== g.members.length) {
        throw ApiError.of('VALIDATION_ERROR', { message: QUESTION_MESSAGES.groupSplit, details: { reason: 'stimulus_group_split', group: groupId } })
      }
      wholeGroups.push(groupId)
    }
    if (wholeGroups.length === 0 || action === 'delete') return perId([...new Set(ids)])
    const unitAction = action as 'draft' | 'review' | 'approved' | 'archived'
    for (const groupId of wholeGroups) await this.groupUnit(groupId, unitAction, actor, false)
    // ONE transaction for every whole group in the list (the nested `groupUnit` calls join it): a refusal in any group changes nothing in any group,
    // and the ungrouped ids below are only touched after it committed.
    const moved = await this.prisma.transaction(async () => {
      const done: string[] = []
      for (const groupId of wholeGroups) done.push(...(await this.groupUnit(groupId, unitAction, actor, true)))
      return done
    }, TX)
    this.questions.invalidateOverview()
    const inUnits = new Set([...held.values()].flatMap((g) => g.members))
    const rest = await perId([...new Set(ids)].filter((i) => !inUnits.has(i)))
    return { affected: moved.length + rest.affected, ids: [...moved, ...rest.ids], failed: rest.failed, ...(rest.skipped === undefined ? {} : { skipped: rest.skipped }) }
  }

  /** API-Q-33: archives every non-archived member in one transaction (reason `withdrawn`, as the single archive); the stimulus is kept. */
  async retireGroup(id: string, actor: GroupActor): Promise<StimulusWrite<{ archived: number; affectedPapers: { id: string; title: string }[] }>> {
    await this.groupOrThrow(id)
    const out = await this.prisma.transaction(async () => {
      await this.members.lock(id)
      const memberIds = await this.repo.memberIds(id)
      const affectedPapers = await this.repo.publishedPapersPlacing(memberIds)
      const archived = await this.archiveMembers(id, actor, true)
      return { archived, affectedPapers }
    }, TX)
    this.questions.invalidateOverview()
    return { result: { archived: out.archived.length, affectedPapers: out.affectedPapers }, audit: { archived: out.archived.length, papers: out.affectedPapers.map((p) => p.id), ids: out.archived.slice(0, 200) } }
  }

  /** API-Q-32: the draft copy of a group (one open copy per group; a second request is 409 with the id of the open one). */
  async editAsDraft(id: string, actor: GroupActor): Promise<StimulusWrite<StimulusGroupDetail>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const source = await this.groupOrThrow(id)
      if (source.draftOfGroupId !== null) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.conflict })
      const open = await this.repo.draftCopyOf(id)
      if (open !== null) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.draftExists, details: { id: open } })
      const members = await this.repo.memberIds(id)
      const draftId = await this.repo.createDraftCopy(source, members, actor.userId)
      return { result: await this.getGroup(draftId), audit: { draftGroupId: draftId, members: members.length, stimuli: source.stimuli.length } }
    }, TX)
  }

  /** API-Q-32 `DELETE /:id/draft`: discards the draft copy only; no open copy is 409. Returns the discarded draft id. */
  async discardDraft(id: string): Promise<StimulusWrite<{ draftGroupId: string }>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const open = await this.repo.draftCopyOf(id)
      if (open === null) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.noDraft })
      await this.repo.deleteDraftCopy(open)
      return { result: { draftGroupId: open }, audit: { draftGroupId: open } }
    }, TX)
  }

  /** API-Q-34: moves a member to another group (end of the target; the source closes up). Same rules as joining; a served member is refused unless both groups are draft copies. */
  async moveMember(fromId: string, questionId: string, toGroupId: string): Promise<StimulusWrite<{ from: StimulusGroupDetail; to: StimulusGroupDetail }>> {
    await this.groupOrThrow(fromId)
    return this.prisma.transaction(async () => {
      if (toGroupId === fromId) throw fail({ toGroupId: STIMULUS_MESSAGES.requestInvalid })
      if ((await this.repo.groupScope(toGroupId)) === null) throw fail({ toGroupId: STIMULUS_MESSAGES.groupInvalid })
      for (const key of [fromId, toGroupId].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))) await this.members.lock(key)
      // Decision 26: between two draft copies the move changes the staged members and takes effect when both copies are published (the swap).
      // A served member moves in no other way (memberServed below); a copy on one side only is not allowed (409).
      const [fromCopy, toCopy] = [(await this.repo.groupScope(fromId))?.draftOfGroupId != null, (await this.repo.groupScope(toGroupId))?.draftOfGroupId != null]
      if (fromCopy && toCopy) return this.moveStaged(fromId, questionId, toGroupId)
      if (fromCopy || toCopy) throw conflictOf(STIMULUS_MESSAGES.conflict)
      const facts = (await this.repo.lockQuestions([questionId])).get(questionId)
      if (facts === undefined || facts.groupId === null) throw notFound(STIMULUS_MESSAGES.memberMissing)
      if (facts.groupId !== fromId) throw conflictOf(STIMULUS_MESSAGES.memberTaken)
      if (facts.served) throw conflictOf(STIMULUS_MESSAGES.memberServed)
      const rest = (await this.repo.memberIds(fromId)).filter((m) => m !== questionId)
      await this.members.set(fromId, rest, 'questionId')
      await this.members.set(toGroupId, [...(await this.repo.memberIds(toGroupId)), questionId], 'toGroupId', STIMULUS_MESSAGES.memberMixed)
      return { result: { from: await this.getGroup(fromId), to: await this.getGroup(toGroupId) }, audit: { questionId, from: fromId, to: toGroupId } }
    }, TX)
  }

  /** Decision 26: the staged move between two draft copies (end of the target; the source closes up). Same member rules as joining. */
  private async moveStaged(fromId: string, questionId: string, toId: string): Promise<StimulusWrite<{ from: StimulusGroupDetail; to: StimulusGroupDetail }>> {
    const [from, to] = [await this.groupOrThrow(fromId), await this.groupOrThrow(toId)]
    const [fromStaged, toStaged] = [from.draftMembers ?? [], to.draftMembers ?? []]
    if (!fromStaged.includes(questionId)) throw notFound(STIMULUS_MESSAGES.memberMissing)
    if (toStaged.includes(questionId)) throw conflictOf(STIMULUS_MESSAGES.memberTaken)
    if (toStaged.length >= STIMULUS_LIMITS.groupQuestions) throw fail({ toGroupId: STIMULUS_MESSAGES.membersTooMany })
    const facts = await this.repo.lockQuestions([questionId, ...toStaged])
    const f = facts.get(questionId)
    if (f === undefined) throw notFound(STIMULUS_MESSAGES.memberMissing)
    // It sits in the live group of the source copy (or in none, when it was added in the copy); never in a third group.
    if (f.groupId !== null && f.groupId !== idToString(from.draftOfGroupId as bigint)) throw conflictOf(STIMULUS_MESSAGES.memberTaken)
    this.members.assertScope(await this.repo.groupScope(toId), { subjectId: f.subjectId, levelId: f.levelId, kertas: f.kertas }, 'toGroupId', STIMULUS_MESSAGES.memberMixed)
    for (const id of toStaged) {
      const o = facts.get(id)
      if (o !== undefined && o.subjectId !== f.subjectId) throw fail({ toGroupId: STIMULUS_MESSAGES.memberMixed })
      if (o?.kertas != null && f.kertas !== null && o.kertas !== f.kertas) throw fail({ toGroupId: STIMULUS_MESSAGES.memberKertas })
    }
    await this.repo.setDraftMembers(fromId, fromStaged.filter((m) => m !== questionId))
    await this.repo.setDraftMembers(toId, [...toStaged, questionId])
    return { result: { from: await this.getGroup(fromId), to: await this.getGroup(toId) }, audit: { questionId, from: fromId, to: toId, staged: true } }
  }

  /** API-Q-35: merges `fromGroupId` into `intoGroupId` (members appended in order, stimuli linked once, at most 3); `from` is deleted. */
  async mergeGroups(fromId: string, intoId: string): Promise<StimulusWrite<StimulusGroupDetail>> {
    return this.prisma.transaction(async () => {
      const fields: Record<string, string> = {}
      const [fromScope, intoScope] = [await this.repo.groupScope(fromId), await this.repo.groupScope(intoId)]
      if (fromScope === null) fields.fromGroupId = STIMULUS_MESSAGES.groupInvalid
      if (intoScope === null) fields.intoGroupId = STIMULUS_MESSAGES.groupInvalid
      if (fromScope === null || intoScope === null) throw fail(fields)
      for (const key of [fromId, intoId].sort((a, b) => (BigInt(a) < BigInt(b) ? -1 : 1))) await this.members.lock(key)
      if (fromScope.draftOfGroupId !== null || intoScope.draftOfGroupId !== null) throw conflictOf(STIMULUS_MESSAGES.conflict)
      // A group with a served member keeps its members, order and stimuli: it is neither emptied nor given more stimuli in place (served lock).
      await this.members.assertNotServed(fromId)
      await this.members.assertNotServed(intoId)
      const [from, into] = [await this.groupOrThrow(fromId), await this.groupOrThrow(intoId)]
      const stimulusIds = [...new Set([...into.stimuli, ...from.stimuli].map((x) => idToString(x.id)))]
      if (stimulusIds.length > 3) throw fail({ intoGroupId: STIMULUS_MESSAGES.stimuliCount })
      if (fromScope.subjectId !== null && intoScope.subjectId !== null && fromScope.subjectId !== intoScope.subjectId) throw fail({ intoGroupId: STIMULUS_MESSAGES.memberScope })
      if (fromScope.educationLevelId !== null && intoScope.educationLevelId !== null && fromScope.educationLevelId !== intoScope.educationLevelId) throw fail({ intoGroupId: STIMULUS_MESSAGES.memberScope })
      if (fromScope.kertas !== null && intoScope.kertas !== null && fromScope.kertas !== intoScope.kertas) throw fail({ intoGroupId: STIMULUS_MESSAGES.memberKertas })
      const [fromMembers, intoMembers] = [await this.repo.memberIds(fromId), await this.repo.memberIds(intoId)]
      await this.members.set(fromId, [])
      await this.members.set(intoId, [...intoMembers, ...fromMembers], 'intoGroupId')
      await this.repo.replaceGroupStimuli(intoId, stimulusIds.map((i) => BigInt(i)))
      await this.repo.deleteGroup(fromId)
      return { result: await this.getGroup(intoId), audit: { fromGroupId: fromId, intoGroupId: intoId, members: fromMembers.length + intoMembers.length, stimuli: stimulusIds.length } }
    }, TX)
  }

  // --- helpers ------------------------------------------------------------------------------------

  private async stimulusOrThrow(id: string): Promise<StimulusRow> {
    const row = await this.repo.getStimulus(id)
    // `audio` lives in the same table but is not a displayable stimulus: the Studio never sees it.
    if (row === null || !(STIMULUS_KINDS as readonly string[]).includes(row.kind)) throw notFound(STIMULUS_MESSAGES.notFound)
    return row
  }

  private async groupOrThrow(id: string): Promise<GroupRow> {
    const row = await this.repo.getGroup(id)
    if (row === null) throw notFound(STIMULUS_MESSAGES.groupNotFound)
    return row
  }

  /** The internal id of an image file, or a `imageFileId` failure. Wrong purpose, missing and malformed answer alike. */
  private async imageOf(token: string | null | undefined, fields: Record<string, string>): Promise<bigint | null> {
    if (token === null || token === undefined) return null
    const internal = await this.files.internalIdOf(token)
    // Only the public token that `POST /files` returns names a picture; a guessable decimal id never does (T32-L1).
    const meta = internal !== token && /^[1-9]\d{0,18}$/.test(internal) ? await this.files.metaOf(internal) : null
    if (meta === null || meta.purpose !== IMAGE_PURPOSE) {
      fields.imageFileId = STIMULUS_MESSAGES.image
      return null
    }
    return BigInt(internal)
  }

  private async checkStimuli(ids: readonly string[], fields: Record<string, string>): Promise<bigint[]> {
    if (new Set(ids).size !== ids.length) {
      fields.stimulusIds = STIMULUS_MESSAGES.stimuliInvalid
      return []
    }
    const rows = await this.repo.stimuliByIds(ids)
    if (rows.some((r) => r === null || !(STIMULUS_KINDS as readonly string[]).includes(r.kind))) {
      fields.stimulusIds = STIMULUS_MESSAGES.stimuliInvalid
      return []
    }
    return ids.map((i) => BigInt(i))
  }

  private async stimulusView(row: StimulusRow): Promise<Stimulus> {
    const tokens = row.assetFileId === null ? new Map<string, string>() : await this.files.publicIdsOf([idToString(row.assetFileId)])
    return {
      id: idToString(row.id),
      kind: row.kind,
      label: row.label ?? '',
      caption: row.caption,
      // A table read from the body is shown as the grid only (never the grid and its source text).
      body: row.bodyIsTable || (row.bodyMs === null && row.bodyEn === null) ? null : { ms: row.bodyMs ?? row.bodyEn ?? '', ...(row.bodyMs !== null && row.bodyEn !== null ? { en: row.bodyEn } : {}) },
      alt: row.altText,
      sourceCitation: row.sourceCitation,
      tableData: row.shownTable,
      imageId: row.assetFileId === null ? null : (tokens.get(idToString(row.assetFileId)) ?? null),
      style: row.style,
      groupCount: row.groupCount,
    }
  }

  private async groupView(g: GroupRow): Promise<StimulusGroupDetail> {
    const stimuli = await Promise.all(
      g.stimuli
        .filter((s) => (STIMULUS_KINDS as readonly string[]).includes(s.kind))
        .map(async (s) => {
          const v = await this.stimulusView(s)
          return {
            id: v.id,
            kind: v.kind,
            label: v.label,
            body: v.body,
            imageId: v.imageId,
            alt: v.alt,
            ...(v.caption === null ? {} : { caption: v.caption }),
            ...(v.sourceCitation === null ? {} : { sourceCitation: v.sourceCitation }),
            ...(v.tableData === null ? {} : { tableData: v.tableData }),
          }
        }),
    )
    const draftBriefs = g.draftMembers === null ? null : await this.repo.memberBriefsOf(g.draftMembers, idToString(g.id))
    return {
      id: idToString(g.id),
      label: g.label,
      scope: g.scope,
      subjectId: g.subjectId === null ? null : idToString(g.subjectId),
      educationLevelId: g.educationLevelId === null ? null : idToString(g.educationLevelId),
      kertas: kertasText(g.kertas),
      draftOfGroupId: g.draftOfGroupId === null ? null : idToString(g.draftOfGroupId),
      stimuli,
      ...(g.optionBank.length === 0
        ? {}
        : { optionBank: g.optionBank.map((o) => ({ label: o.label, body: { ms: o.bodyMs ?? o.bodyEn ?? o.label, ...(o.bodyMs !== null && o.bodyEn !== null ? { en: o.bodyEn } : {}) } })) }),
      questionIds: draftBriefs === null ? g.questionIds.map(idToString) : draftBriefs.map((b) => b.id),
      members: (draftBriefs ?? ((await this.repo.memberBriefs([idToString(g.id)])).get(idToString(g.id)) ?? [])).map(memberOf),
      warning: this.members.warning(draftBriefs === null ? g.questionIds.length : draftBriefs.length),
    }
  }

  // --- lists (R1-T49) -----------------------------------------------------------------------------

  /** One page of groups with the short form of their members: ids and total (1 query), rows (1), members (1), served flags (1), picture tokens (1). */
  async listGroups(f: ListFilter): Promise<{ rows: StimulusGroupListRow[]; total: number }> {
    const { ids, total } = await this.repo.listGroupIds(f)
    const [groups, briefs, served] = await Promise.all([this.repo.groupsByIds(ids), this.repo.memberBriefs(ids), this.repo.servedGroupIds(ids)])
    // Picture tokens of the whole page in ONE lookup (not one per stimulus).
    const assets = [...new Set(groups.flatMap((g) => g.stimuli.flatMap((x) => (x.assetFileId === null ? [] : [idToString(x.assetFileId)]))))]
    const tokens = assets.length === 0 ? new Map<string, string>() : await this.files.publicIdsOf(assets)
    const rows = groups.map((g) => {
      const id = idToString(g.id)
      const members = (briefs.get(id) ?? []).map(memberOf)
      return {
        id,
        label: g.label,
        scope: g.scope,
        stimuli: g.stimuli
          .filter((x) => (STIMULUS_KINDS as readonly string[]).includes(x.kind))
          .map((x) => ({ id: idToString(x.id), kind: x.kind, label: x.label ?? '', imageId: x.assetFileId === null ? null : (tokens.get(idToString(x.assetFileId)) ?? null) })),
        memberCount: members.length,
        members,
        status: served.has(id) ? ('served' as const) : ('draft' as const),
        warning: this.members.warning(members.length),
      }
    })
    return { rows, total }
  }

  /** One page of stimuli: ids and total (1 query), rows and served flags (2), picture tokens (1). */
  async listStimuli(f: ListFilter): Promise<{ rows: StimulusListRow[]; total: number }> {
    const { ids, total } = await this.repo.listStimulusIds(f)
    const { rows: found, served } = await this.repo.stimuliPage(ids)
    const assets = found.flatMap((r) => (r.assetFileId === null ? [] : [idToString(r.assetFileId)]))
    const tokens = assets.length === 0 ? new Map<string, string>() : await this.files.publicIdsOf(assets)
    const rows = found.map((r) => ({
      id: idToString(r.id),
      kind: r.kind as StimulusListRow['kind'],
      label: r.label ?? '',
      caption: r.caption,
      excerpt: r.bodyIsTable ? null : plainExcerpt(r.bodyMs ?? r.bodyEn, STIMULUS_MEMBER_STEM_MAX) || null,
      imageId: r.assetFileId === null ? null : (tokens.get(idToString(r.assetFileId)) ?? null),
      groupCount: r.groupCount,
      status: served.has(idToString(r.id)) ? ('served' as const) : ('draft' as const),
    }))
    return { rows, total }
  }
}
