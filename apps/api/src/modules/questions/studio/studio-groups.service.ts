import { Inject, Injectable } from '@nestjs/common'
import {
  STUDIO_GROUP_MESSAGES as M,
  STUDIO_MAX_MEMBERS,
  STUDIO_MAX_STIMULI,
  STUDIO_MIN_MEMBERS,
  type StudioGroup,
  type StudioGroupCreateRequest,
  type StudioGroupMemberAddRequest,
  type StudioGroupMembersRequest,
  type StudioGroupUpdateRequest,
  type StudioStimulus,
  type StudioStimulusInput,
  type StudioStimulusPatch,
} from '@pp/contract'

import { ApiError } from '../../../common/errors/api-error'
import type { TxClient } from '../../../db/client'
import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString, isIdString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { FilesService } from '../../files'

const TX = { timeout: 20_000, maxWait: 10_000 } as const
/** A member in one of these states is shown to learners (base `published`; `approved` once the lifecycle merge makes it servable). */
const SERVING = new Set(['approved', 'published'])
const STEM_PREVIEW = 120

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: M.notFound })
const invalid = (fields: Record<string, string>): ApiError => ApiError.of('VALIDATION_ERROR', { fields })
const conflict = (message: string): ApiError => ApiError.of('CONFLICT', { message })

type GroupRow = Prisma.StimulusGroupGetPayload<{ include: { stimuli: { include: { stimulus: true } } } }>

/**
 * Admin write side of stimulus groups (D90). A group is one stimulus (up to three, OD-28) plus its ordered member
 * questions. The group is the unit: members are added, removed and reordered through it, a figure is stored once, and the
 * group carries no marks. Structural changes are refused while a member is being served (the V2 rule for an approved
 * question: change it through a new draft, not in place). Every method runs in one transaction on a locked group row.
 */
@Injectable()
export class StudioGroupsService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(FilesService) private readonly files: FilesService,
  ) {}

  // ---- reads -------------------------------------------------------------------------------------------

  async get(idText: string): Promise<StudioGroup> {
    const id = parseId(idText)
    return this.view(this.prisma.client, id)
  }

  // ---- writes ------------------------------------------------------------------------------------------

  async create(input: StudioGroupCreateRequest): Promise<StudioGroup> {
    const stimuli = await this.stimulusData(input.stimuli)
    const ids = this.memberIds(input.questionIds ?? [])
    return this.prisma.transaction(async (tx) => {
      const group = await tx.stimulusGroup.create({ data: { label: input.label ?? null, scope: 'section' } })
      for (const [i, data] of stimuli.entries()) {
        const s = await tx.stimulus.create({ data })
        await tx.stimulusGroupStimulus.create({ data: { groupId: group.id, stimulusId: s.id, position: i + 1 } })
      }
      if (ids.length > 0) await this.setMembers(tx, group.id, ids)
      return this.view(tx, group.id)
    }, TX)
  }

  async update(idText: string, input: StudioGroupUpdateRequest): Promise<StudioGroup> {
    const id = parseId(idText)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: false })
      if (input.label !== undefined) await tx.stimulusGroup.update({ where: { id }, data: { label: input.label } })
      return this.view(tx, id)
    }, TX)
  }

  async addStimulus(idText: string, input: StudioStimulusInput): Promise<StudioGroup> {
    const id = parseId(idText)
    const [data] = await this.stimulusData([input])
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      const links = await tx.stimulusGroupStimulus.findMany({ where: { groupId: id }, select: { position: true } })
      if (links.length >= STUDIO_MAX_STIMULI) throw invalid({ stimuli: M.stimuli })
      const s = await tx.stimulus.create({ data: data as Prisma.StimulusUncheckedCreateInput })
      const next = links.reduce((m, l) => Math.max(m, l.position), 0) + 1
      await tx.stimulusGroupStimulus.create({ data: { groupId: id, stimulusId: s.id, position: next } })
      return this.view(tx, id)
    }, TX)
  }

  async patchStimulus(idText: string, stimulusIdText: string, input: StudioStimulusPatch): Promise<StudioGroup> {
    const id = parseId(idText)
    const stimulusId = parseId(stimulusIdText, M.stimulusNotFound)
    const data = await this.patchData(input)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      await this.requireLink(tx, id, stimulusId)
      if (Object.keys(data).length > 0) await tx.stimulus.update({ where: { id: stimulusId }, data })
      return this.view(tx, id)
    }, TX)
  }

  async removeStimulus(idText: string, stimulusIdText: string): Promise<StudioGroup> {
    const id = parseId(idText)
    const stimulusId = parseId(stimulusIdText, M.stimulusNotFound)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      const links = await tx.stimulusGroupStimulus.findMany({ where: { groupId: id }, orderBy: { position: 'asc' } })
      if (!links.some((l) => l.stimulusId === stimulusId)) throw ApiError.of('NOT_FOUND', { message: M.stimulusNotFound })
      if (links.length <= 1) throw conflict(M.lastStimulus)
      await tx.stimulusGroupStimulus.delete({ where: { groupId_stimulusId: { groupId: id, stimulusId } } })
      // The stimulus row itself goes only when nothing else uses it (a version, a part or another group).
      const used =
        (await tx.stimulusGroupStimulus.count({ where: { stimulusId } })) +
        (await tx.questionVersionStimulus.count({ where: { stimulusId } })) +
        (await tx.questionPart.count({ where: { stimulusId } }))
      if (used === 0) await tx.stimulus.delete({ where: { id: stimulusId } })
      let position = 1
      for (const l of links.filter((x) => x.stimulusId !== stimulusId)) {
        await tx.stimulusGroupStimulus.update({ where: { id: l.id }, data: { position: position++ } })
      }
      return this.view(tx, id)
    }, TX)
  }

  /** The complete ordered member list after the change: adds, removals and reordering in one call. */
  async replaceMembers(idText: string, input: StudioGroupMembersRequest): Promise<StudioGroup> {
    const id = parseId(idText)
    const ids = this.memberIds(input.questionIds)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      await this.setMembers(tx, id, ids)
      return this.view(tx, id)
    }, TX)
  }

  async addMember(idText: string, input: StudioGroupMemberAddRequest): Promise<StudioGroup> {
    const id = parseId(idText)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      const current = (await tx.question.findMany({ where: { groupId: id }, orderBy: { groupPosition: 'asc' }, select: { id: true } })).map((q) => idToString(q.id))
      if (current.includes(input.questionId)) throw invalid({ questionId: M.memberDuplicate })
      const at = input.position === undefined ? current.length : Math.min(input.position - 1, current.length)
      const next = [...current.slice(0, at), input.questionId, ...current.slice(at)]
      this.memberIds(next)
      await this.setMembers(tx, id, next)
      return this.view(tx, id)
    }, TX)
  }

  async removeMember(idText: string, questionIdText: string): Promise<StudioGroup> {
    const id = parseId(idText)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      const current = (await tx.question.findMany({ where: { groupId: id }, orderBy: { groupPosition: 'asc' }, select: { id: true } })).map((q) => idToString(q.id))
      if (!current.includes(questionIdText)) throw ApiError.of('NOT_FOUND', { message: M.memberNotIn })
      await this.setMembers(tx, id, current.filter((q) => q !== questionIdText))
      return this.view(tx, id)
    }, TX)
  }

  /** Dissolves the group: members stay as ordinary questions, the stimuli go when nothing else uses them. */
  async dissolve(idText: string): Promise<{ id: string; detachedQuestionIds: string[] }> {
    const id = parseId(idText)
    return this.prisma.transaction(async (tx) => {
      await this.lock(tx, id, { structural: true })
      const members = await tx.question.findMany({ where: { groupId: id }, select: { id: true } })
      await tx.question.updateMany({ where: { groupId: id }, data: { groupId: null, groupPosition: null } })
      const links = await tx.stimulusGroupStimulus.findMany({ where: { groupId: id }, select: { stimulusId: true } })
      await tx.stimulusGroup.delete({ where: { id } })
      for (const { stimulusId } of links) {
        const used =
          (await tx.stimulusGroupStimulus.count({ where: { stimulusId } })) +
          (await tx.questionVersionStimulus.count({ where: { stimulusId } })) +
          (await tx.questionPart.count({ where: { stimulusId } }))
        if (used === 0) await tx.stimulus.delete({ where: { id: stimulusId } })
      }
      return { id: idToString(id), detachedQuestionIds: members.map((m) => idToString(m.id)) }
    }, TX)
  }

  // ---- internals ---------------------------------------------------------------------------------------

  /** Locks the group row. `structural` changes are refused while a member is being served. */
  private async lock(tx: TxClient, id: bigint, opts: { structural: boolean }): Promise<void> {
    const rows = await tx.$queryRaw<{ id: bigint }[]>`SELECT id FROM stimulus_groups WHERE id = ${id} FOR UPDATE`
    if (rows.length === 0) throw notFound()
    if (opts.structural && (await this.servingMembers(tx, [id])) > 0) throw conflict(M.locked)
  }

  /** Members (of the given groups) whose live version is approved or published. */
  private async servingMembers(tx: TxClient, groupIds: bigint[]): Promise<number> {
    const rows = await tx.question.findMany({
      where: { groupId: { in: groupIds }, liveVersionNo: { not: null } },
      select: { liveVersionNo: true, versions: { select: { versionNo: true, status: true } } },
    })
    return rows.filter((q) => SERVING.has(q.versions.find((v) => v.versionNo === q.liveVersionNo)?.status ?? '')).length
  }

  private async requireLink(tx: TxClient, groupId: bigint, stimulusId: bigint): Promise<void> {
    if ((await tx.stimulusGroupStimulus.count({ where: { groupId, stimulusId } })) === 0) throw ApiError.of('NOT_FOUND', { message: M.stimulusNotFound })
  }

  private memberIds(ids: readonly string[]): string[] {
    if (new Set(ids).size !== ids.length) throw invalid({ questionIds: M.memberDuplicate })
    if (ids.length > STUDIO_MAX_MEMBERS) throw invalid({ questionIds: M.memberTooMany })
    if (!ids.every(isIdString)) throw invalid({ questionIds: M.members })
    return [...ids]
  }

  /**
   * Makes `ids` (in order) the members of the group. A listed question that belongs to another group is a 409; one that is
   * being served is a 409 too (it would change how learners see it). Members not listed are released; positions are 1..n.
   */
  private async setMembers(tx: TxClient, groupId: bigint, ids: string[]): Promise<void> {
    const keys = ids.map((i) => idFromString(i))
    // PKSK questions are served by their own module and never grouped here: they count as unknown.
    const found = await tx.question.findMany({
      where: { id: { in: keys }, tags: { none: { kind: 'pksk_domain' } } },
      select: { id: true, groupId: true, liveVersionNo: true, versions: { select: { versionNo: true, status: true } } },
    })
    if (found.length !== keys.length) throw invalid({ questionIds: M.memberUnknown })
    for (const q of found) {
      if (q.groupId !== null && q.groupId !== groupId) throw conflict(M.memberElsewhere)
      const live = q.versions.find((v) => v.versionNo === q.liveVersionNo)?.status ?? ''
      if (q.groupId === null && q.liveVersionNo !== null && SERVING.has(live)) throw conflict(M.locked)
    }
    const listed = new Set(keys)
    const current = await tx.question.findMany({ where: { groupId }, select: { id: true } })
    const release = current.filter((q) => !listed.has(q.id)).map((q) => q.id)
    if (release.length > 0) await tx.question.updateMany({ where: { id: { in: release } }, data: { groupId: null, groupPosition: null } })
    // `uq_questions_group_id_group_position` is checked row by row: move the remaining members out of 1..n first.
    await tx.$executeRaw`UPDATE questions SET group_position = group_position + 1000 WHERE group_id = ${groupId}`
    for (const [i, key] of keys.entries()) {
      await tx.question.update({ where: { id: key }, data: { groupId, groupPosition: i + 1 } })
    }
  }

  /** Validates the pictures and maps authored stimuli to table rows. */
  private async stimulusData(inputs: readonly StudioStimulusInput[]): Promise<Prisma.StimulusUncheckedCreateInput[]> {
    const out: Prisma.StimulusUncheckedCreateInput[] = []
    for (const [i, s] of inputs.entries()) {
      out.push({
        kind: s.kind,
        label: s.label ?? null,
        bodyMs: s.body?.trim() ? s.body : null,
        bodyEn: null,
        caption: s.caption ?? null,
        altText: s.alt ?? null,
        sourceCitation: s.sourceCitation ?? null,
        tableData: s.table ? (s.table as Prisma.InputJsonValue) : Prisma.JsonNull,
        assetFileId: await this.imageKey(s.imageFileId, `stimuli.${String(i)}.imageFileId`),
      })
    }
    return out
  }

  private async patchData(p: StudioStimulusPatch): Promise<Prisma.StimulusUncheckedUpdateInput> {
    const data: Prisma.StimulusUncheckedUpdateInput = {}
    if (p.kind !== undefined) data.kind = p.kind
    if (p.label !== undefined) data.label = p.label
    if (p.caption !== undefined) data.caption = p.caption
    if (p.alt !== undefined) data.altText = p.alt
    if (p.body !== undefined) data.bodyMs = p.body?.trim() ? p.body : null
    if (p.table !== undefined) data.tableData = p.table === null ? Prisma.JsonNull : (p.table as Prisma.InputJsonValue)
    if (p.sourceCitation !== undefined) data.sourceCitation = p.sourceCitation
    if (p.imageFileId !== undefined) data.assetFileId = await this.imageKey(p.imageFileId, 'imageFileId')
    return data
  }

  /** The internal id of an uploaded `question_image` file. Missing, wrong purpose and unknown tokens answer alike. */
  private async imageKey(token: string | null | undefined, field: string): Promise<bigint | null> {
    if (token === null || token === undefined || token === '') return null
    const internal = await this.files.internalIdOf(token)
    const meta = await this.files.metaOf(internal)
    if (!meta || meta.purpose !== 'question_image' || !isIdString(internal)) throw invalid({ [field]: M.image })
    return idFromString(internal)
  }

  private async view(db: TxClient | PrismaService['client'], id: bigint): Promise<StudioGroup> {
    const client = db as TxClient
    const group: GroupRow | null = await client.stimulusGroup.findUnique({
      where: { id },
      include: { stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } } },
    })
    if (!group) throw notFound()
    const questions = await client.question.findMany({
      where: { groupId: id },
      orderBy: [{ groupPosition: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        groupPosition: true,
        liveVersionNo: true,
        latestVersionNo: true,
        versions: { select: { versionNo: true, status: true, stemMs: true, numberLabel: true, subjectId: true, educationLevelId: true } },
      },
    })
    const tokens = await this.files.publicIdsOf(group.stimuli.flatMap((l) => (l.stimulus.assetFileId === null ? [] : [idToString(l.stimulus.assetFileId)])))
    const stimuli: StudioStimulus[] = group.stimuli.map((l) => stimulusView(l.stimulus, tokens))
    const shown = questions.map((q, i) => {
      const v = q.versions.find((x) => x.versionNo === (q.liveVersionNo ?? q.latestVersionNo))
      return { q, v, position: i + 1 }
    })
    const locked = shown.some(({ q, v }) => q.liveVersionNo !== null && SERVING.has(v?.status ?? ''))
    const issues: string[] = []
    if (shown.length < STUDIO_MIN_MEMBERS) issues.push(M.needsTwo)
    const scopes = new Set(shown.map(({ v }) => `${String(v?.subjectId)}:${String(v?.educationLevelId)}`))
    if (scopes.size > 1) issues.push('Soalan dalam kumpulan mesti sama subjek dan tahap.')
    return {
      id: idToString(group.id),
      label: group.label,
      stimuli,
      members: shown.map(({ q, v, position }) => ({
        id: idToString(q.id),
        position,
        numberLabel: v?.numberLabel ?? null,
        stem: [...(v?.stemMs ?? '')].slice(0, STEM_PREVIEW).join(''),
        status: v?.status ?? 'draft',
      })),
      memberCount: shown.length,
      complete: shown.length >= STUDIO_MIN_MEMBERS,
      locked,
      issues,
    }
  }
}

function parseId(text: string, message: string = M.notFound): bigint {
  if (!isIdString(text)) throw ApiError.of('NOT_FOUND', { message })
  return idFromString(text)
}

function stimulusView(s: Prisma.StimulusGetPayload<object>, tokens: ReadonlyMap<string, string>): StudioStimulus {
  const table = s.tableData as { head?: string[]; rows?: string[][] } | null
  return {
    id: idToString(s.id),
    kind: (s.kind === 'audio' ? 'passage' : s.kind) as StudioStimulus['kind'],
    label: s.label,
    caption: s.caption,
    alt: s.altText,
    body: s.bodyMs,
    table: table && Array.isArray(table.head) && Array.isArray(table.rows) ? { head: table.head, rows: table.rows } : null,
    sourceCitation: s.sourceCitation,
    imageId: s.assetFileId === null ? null : (tokens.get(idToString(s.assetFileId)) ?? null),
  }
}
