import { Inject, Injectable } from '@nestjs/common'

import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import type { StimulusKind } from './types'

/** The five columns a stimulus write may set. `null` clears. */
export interface StimulusData {
  kind: StimulusKind
  label: string | null
  caption: string | null
  bodyMs: string | null
  bodyEn: string | null
  altText: string | null
  sourceCitation: string | null
  tableData: { head: string[]; rows: string[][] } | null
  assetFileId: bigint | null
}

export interface StimulusRow extends StimulusData {
  id: bigint
  groupCount: number
}

export interface GroupRow {
  id: bigint
  label: string | null
  scope: 'section' | 'paper'
  stimuli: StimulusRow[]
  optionBank: { label: string; bodyMs: string | null; bodyEn: string | null }[]
  questionIds: bigint[]
}

const PKSK_TAG = 'pksk_domain'
const bi = (text: string): bigint | null => (/^[1-9]\d{0,18}$/.test(text) ? BigInt(text) : null)

const tableOf = (value: unknown): { head: string[]; rows: string[][] } | null => {
  if (typeof value !== 'object' || value === null) return null
  const v = value as { head?: unknown; rows?: unknown }
  return Array.isArray(v.head) && Array.isArray(v.rows) ? { head: v.head as string[], rows: v.rows as string[][] } : null
}

/**
 * Writes and reads of the stimulus library and the stimulus groups (R1-T32). The question reads stay in `QuestionsRepository`
 * (ADR-0014 doorway); this class only owns `stimuli`, `stimulus_groups` and their child rows, plus the `group_id` /
 * `group_position` columns of `questions`. Every method uses `prisma.client`, so it joins the transaction of the service.
 */
@Injectable()
export class StimuliRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- stimuli ------------------------------------------------------------------------------------

  async getStimulus(id: string): Promise<StimulusRow | null> {
    const key = bi(id)
    if (key === null) return null
    const row = await this.db.stimulus.findUnique({ where: { id: key }, include: { _count: { select: { groupLinks: true } } } })
    return row === null ? null : this.rowOf(row, row._count.groupLinks)
  }

  async createStimulus(data: StimulusData): Promise<string> {
    const row = await this.db.stimulus.create({ data: this.columns(data) })
    return idToString(row.id)
  }

  async updateStimulus(id: string, data: StimulusData): Promise<void> {
    await this.db.stimulus.update({ where: { id: BigInt(id) }, data: this.columns(data) })
  }

  /** Locks the stimulus row so a delete and a link cannot cross. Returns false when it does not exist. */
  async lockStimulus(id: string): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    return (await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM stimuli WHERE id = ${key} FOR UPDATE`).length > 0
  }

  /** Groups, question versions and parts that use the stimulus. */
  async usageOf(id: string): Promise<{ groups: number; versions: number; parts: number }> {
    const key = BigInt(id)
    const [groups, versions, parts] = await Promise.all([
      this.db.stimulusGroupStimulus.count({ where: { stimulusId: key } }),
      this.db.questionVersionStimulus.count({ where: { stimulusId: key } }),
      this.db.questionPart.count({ where: { stimulusId: key } }),
    ])
    return { groups, versions, parts }
  }

  async deleteStimulus(id: string): Promise<void> {
    await this.db.stimulus.delete({ where: { id: BigInt(id) } })
  }

  /** The given stimuli in the order asked, `null` entries for unknown ids. */
  async stimuliByIds(ids: readonly string[]): Promise<(StimulusRow | null)[]> {
    const keys = ids.map(bi)
    const found = await this.db.stimulus.findMany({
      where: { id: { in: keys.filter((k): k is bigint => k !== null) } },
      include: { _count: { select: { groupLinks: true } } },
    })
    const byId = new Map(found.map((r) => [r.id, this.rowOf(r, r._count.groupLinks)]))
    return keys.map((k) => (k === null ? null : (byId.get(k) ?? null)))
  }

  // --- groups -------------------------------------------------------------------------------------

  async getGroup(id: string): Promise<GroupRow | null> {
    const key = bi(id)
    if (key === null) return null
    const g = await this.db.stimulusGroup.findUnique({
      where: { id: key },
      include: {
        stimuli: { orderBy: { position: 'asc' }, include: { stimulus: { include: { _count: { select: { groupLinks: true } } } } } },
        options: { orderBy: { position: 'asc' } },
        questions: { orderBy: { groupPosition: 'asc' }, select: { id: true } },
      },
    })
    if (g === null) return null
    return {
      id: g.id,
      label: g.label,
      scope: g.scope === 'paper' ? 'paper' : 'section',
      stimuli: g.stimuli.map((s) => this.rowOf(s.stimulus, s.stimulus._count.groupLinks)),
      optionBank: g.options.map((o) => ({ label: o.label, bodyMs: o.bodyMs, bodyEn: o.bodyEn })),
      questionIds: g.questions.map((q) => q.id),
    }
  }

  async lockGroup(id: string): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    return (await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM stimulus_groups WHERE id = ${key} FOR UPDATE`).length > 0
  }

  async createGroup(input: {
    label: string | null
    scope: 'section' | 'paper'
    stimulusIds: bigint[]
    optionBank: { label: string; bodyMs: string | null; bodyEn: string | null }[]
  }): Promise<string> {
    const group = await this.db.stimulusGroup.create({
      data: {
        label: input.label,
        scope: input.scope,
        stimuli: { create: input.stimulusIds.map((stimulusId, i) => ({ stimulusId, position: i + 1 })) },
        options: { create: input.optionBank.map((o, i) => ({ label: o.label, bodyMs: o.bodyMs, bodyEn: o.bodyEn, position: i + 1 })) },
      },
    })
    return idToString(group.id)
  }

  async setGroupLabel(id: string, label: string | null): Promise<void> {
    await this.db.stimulusGroup.update({ where: { id: BigInt(id) }, data: { label } })
  }

  /** Replaces the ordered stimuli of a group (delete, then insert: the (group, position) key is unique). */
  async replaceGroupStimuli(id: string, stimulusIds: bigint[]): Promise<void> {
    const groupId = BigInt(id)
    await this.db.stimulusGroupStimulus.deleteMany({ where: { groupId } })
    await this.db.stimulusGroupStimulus.createMany({ data: stimulusIds.map((stimulusId, i) => ({ groupId, stimulusId, position: i + 1 })) })
    await this.db.stimulusGroup.update({ where: { id: groupId }, data: { updatedAt: new Date() } })
  }

  /** Dissolves the group: members lose `group_id` and `group_position` (the CHECK keeps the two columns in step). */
  async deleteGroup(id: string): Promise<string[]> {
    const groupId = BigInt(id)
    const members = await this.db.question.findMany({ where: { groupId }, orderBy: { groupPosition: 'asc' }, select: { id: true } })
    await this.db.question.updateMany({ where: { groupId }, data: { groupId: null, groupPosition: null } })
    await this.db.stimulusGroup.delete({ where: { id: groupId } })
    return members.map((m) => idToString(m.id))
  }

  // --- members ------------------------------------------------------------------------------------

  /**
   * Locks the question rows (ascending, so two writers cannot deadlock) and returns what the member rules need: whether the
   * question exists, its current group and whether it is a PKSK question. Unknown ids are absent.
   */
  async lockQuestions(ids: readonly string[]): Promise<Map<string, { groupId: string | null; pksk: boolean }>> {
    const keys = [...new Set(ids.map(bi).filter((k): k is bigint => k !== null))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const out = new Map<string, { groupId: string | null; pksk: boolean }>()
    if (keys.length === 0) return out
    await this.db.$queryRaw`SELECT id FROM questions WHERE id IN (${Prisma.join(keys)}) ORDER BY id FOR UPDATE`
    const rows = await this.db.question.findMany({ where: { id: { in: keys } }, select: { id: true, groupId: true, tags: { where: { kind: PKSK_TAG }, select: { id: true } } } })
    for (const r of rows) out.set(idToString(r.id), { groupId: r.groupId === null ? null : idToString(r.groupId), pksk: r.tags.length > 0 })
    return out
  }

  /** Puts the questions in the group at positions `from`, `from + 1`, ... in the order given. */
  async attachQuestions(groupId: string, questionIds: readonly string[], from: number): Promise<void> {
    for (const [i, q] of questionIds.entries()) {
      await this.db.question.update({ where: { id: BigInt(q) }, data: { groupId: BigInt(groupId), groupPosition: from + i } })
    }
  }

  async detachQuestion(questionId: string): Promise<void> {
    await this.db.question.update({ where: { id: BigInt(questionId) }, data: { groupId: null, groupPosition: null } })
  }

  /**
   * Rewrites positions 1..n in the given order. Two passes (shift out of the way, then final) because the partial unique index on
   * (group_id, group_position) is checked row by row.
   */
  async renumber(groupId: string, orderedQuestionIds: readonly string[]): Promise<void> {
    const key = BigInt(groupId)
    await this.db.$executeRaw`UPDATE questions SET group_position = group_position + 10000 WHERE group_id = ${key}`
    for (const [i, q] of orderedQuestionIds.entries()) {
      await this.db.question.update({ where: { id: BigInt(q) }, data: { groupPosition: i + 1 } })
    }
  }

  async touchGroup(id: string): Promise<void> {
    await this.db.stimulusGroup.update({ where: { id: BigInt(id) }, data: { updatedAt: new Date() } })
  }

  // --- helpers ------------------------------------------------------------------------------------

  private columns(d: StimulusData) {
    return {
      kind: d.kind,
      label: d.label,
      caption: d.caption,
      bodyMs: d.bodyMs,
      bodyEn: d.bodyEn,
      altText: d.altText,
      sourceCitation: d.sourceCitation,
      tableData: d.tableData === null ? Prisma.JsonNull : (d.tableData as unknown as Prisma.InputJsonValue),
      assetFileId: d.assetFileId,
    }
  }

  private rowOf(
    r: { id: bigint; kind: string; label: string | null; caption: string | null; bodyMs: string | null; bodyEn: string | null; altText: string | null; sourceCitation: string | null; tableData: unknown; assetFileId: bigint | null },
    groupCount: number,
  ): StimulusRow {
    return {
      id: r.id,
      kind: r.kind as StimulusKind,
      label: r.label,
      caption: r.caption,
      bodyMs: r.bodyMs,
      bodyEn: r.bodyEn,
      altText: r.altText,
      sourceCitation: r.sourceCitation,
      tableData: tableOf(r.tableData),
      assetFileId: r.assetFileId,
      groupCount,
    }
  }
}
