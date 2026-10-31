import { Inject, Injectable } from '@nestjs/common'
import {
  IMAGE_STIMULUS_KINDS,
  STIMULUS_MESSAGES,
  type StimulusCreateRequest,
  type StimulusGroupCreateRequest,
  type StimulusGroupDetail,
  type StimulusGroupUpdateRequest,
  type StimulusUpdateRequest,
  type Stimulus,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { FilesService } from '../files'
import { GroupMembers } from './group-members'
import { type GroupRow, type StimulusData, type StimulusRow, StimuliRepository } from './stimuli.repository'
import { QuestionsService } from './questions.service'
import { STIMULUS_KINDS } from './types'
import type { QuestionActor, QuestionCreateInput, QuestionView } from './types'

const TX = { timeout: 20_000, maxWait: 10_000 } as const
const IMAGE_PURPOSE = 'question_image'

const fail = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })
const notFound = (message: string): ApiError => ApiError.of('NOT_FOUND', { message })

/** One summary of what a write changed: ids and counts only (the audit row never carries content). */
export interface StimulusWrite<T> {
  result: T
  audit: Record<string, unknown>
}

/**
 * Stimulus library and stimulus groups for the Studio (R1-T32, D90). Business rules:
 * - a stimulus is one of the seven kinds; pictures are `question_image` files, never inline SVG or HTML;
 * - a group has 1 to 3 stimuli and at least 2 member questions when created; it carries no marks and is never a question;
 * - a question is in at most one group; removal that leaves fewer than 2 members succeeds with a BM warning;
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
      const body = input.body === undefined ? { ms: current.bodyMs, en: current.bodyEn } : { ms: input.body?.ms ?? null, en: input.body?.en ?? null }
      const data: StimulusData = {
        kind: current.kind,
        label: input.label === undefined ? current.label : input.label,
        caption: input.caption === undefined ? current.caption : input.caption,
        bodyMs: body.ms,
        bodyEn: body.en,
        altText: input.alt === undefined ? current.altText : input.alt,
        sourceCitation: input.sourceCitation === undefined ? current.sourceCitation : input.sourceCitation,
        tableData: input.tableData === undefined ? current.tableData : input.tableData,
        assetFileId,
      }
      // The merged state must still satisfy the rules of the kind (same rules as the create body).
      if (data.kind === 'passage' && !data.bodyMs) fields.body ??= STIMULUS_MESSAGES.bodyRequired
      if (data.kind === 'table' && data.tableData === null && data.assetFileId === null) fields.tableData ??= STIMULUS_MESSAGES.tableRequired
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
      if (use.groups + use.versions + use.parts > 0) throw ApiError.of('CONFLICT', { message: STIMULUS_MESSAGES.inUse, details: use })
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
      const id = await this.repo.createGroup({
        label: input.label ?? null,
        scope: input.scope ?? 'section',
        stimulusIds,
        optionBank: (input.optionBank ?? []).map((o) => ({ label: o.label, bodyMs: o.body.ms, bodyEn: o.body.en ?? null })),
      })
      // D93: 0 or more members; the same rules as every later member change (a failure rolls the group back).
      const members = input.questionIds.length === 0 ? [] : await this.members.set(id, input.questionIds)
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
      if (stimulusIds !== null) await this.members.assertNotServed(id) // what the served questions show changes
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
      const current = await this.repo.memberIds(id)
      if (current.includes(questionId)) throw fail({ questionId: STIMULUS_MESSAGES.memberExists })
      const after = await this.members.set(id, [...current, questionId], 'questionId')
      return { result: await this.getGroup(id), audit: { added: 1, members: after.length } }
    }, TX)
  }

  async removeMember(id: string, questionId: string): Promise<StimulusWrite<{ group: StimulusGroupDetail; warning: string | null }>> {
    await this.groupOrThrow(id)
    return this.prisma.transaction(async () => {
      await this.members.lock(id)
      const current = await this.repo.memberIds(id)
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
      const current = await this.repo.memberIds(id)
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
      body: row.bodyMs === null && row.bodyEn === null ? null : { ms: row.bodyMs ?? row.bodyEn ?? '', ...(row.bodyMs !== null && row.bodyEn !== null ? { en: row.bodyEn } : {}) },
      alt: row.altText,
      sourceCitation: row.sourceCitation,
      tableData: row.tableData,
      imageId: row.assetFileId === null ? null : (tokens.get(idToString(row.assetFileId)) ?? null),
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
    return {
      id: idToString(g.id),
      label: g.label,
      scope: g.scope,
      stimuli,
      ...(g.optionBank.length === 0
        ? {}
        : { optionBank: g.optionBank.map((o) => ({ label: o.label, body: { ms: o.bodyMs ?? o.bodyEn ?? o.label, ...(o.bodyMs !== null && o.bodyEn !== null ? { en: o.bodyEn } : {}) } })) }),
      questionIds: g.questionIds.map(idToString),
      warning: this.members.warning(g.questionIds.length),
    }
  }
}
