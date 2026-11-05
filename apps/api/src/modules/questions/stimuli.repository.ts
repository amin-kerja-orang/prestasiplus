import { Inject, Injectable } from '@nestjs/common'
import { STIMULUS_MEMBER_STEM_MAX } from '@pp/contract'

import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { stimulusTableOf, stimulusTableParts, type StimulusTable } from './stimulus-table'
import { NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL } from './learner-visibility'
import { refreshStimulusFlagsOf } from './effective-leaf'
import { kertasOfPaperCode } from './projection'
import { QUESTION_SERVED, VERSION_SERVED } from './served-rule'
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
  /** Presentation hint (DM-70): `kotak`, `mono` or null. */
  style: string | null
  tableData: { head: string[]; rows: string[][] } | null
  assetFileId: bigint | null
}

export interface StimulusRow extends StimulusData {
  id: bigint
  groupCount: number
  /** The table the stimulus shows (stored grid, else a pipe table read from the body), by the one shared reader. */
  shownTable: StimulusTable | null
  /** The table was read from the body text: the body is not shown as text as well. */
  bodyIsTable: boolean
}

export interface GroupRow {
  id: bigint
  label: string | null
  scope: 'section' | 'paper'
  stimuli: StimulusRow[]
  optionBank: { label: string; bodyMs: string | null; bodyEn: string | null }[]
  questionIds: bigint[]
  /** S1-T01 (DM-51): the scope of the group itself; null = no restriction. */
  subjectId: bigint | null
  educationLevelId: bigint | null
  kertas: number | null
  /** The served group this draft copy replaces (null for an ordinary group) and the member ids staged in the copy. */
  draftOfGroupId: bigint | null
  draftMembers: string[] | null
}

/** The scope of a group (DM-51): ids as text, kertas 1..4 or null. */
export interface GroupScope {
  subjectId: string | null
  educationLevelId: string | null
  kertas: number | null
}

const draftMembersOf = (v: unknown): string[] | null => (Array.isArray(v) ? v.map((x) => String(x)) : null)

const PKSK_TAG = 'pksk_domain'

/**
 * Secondary only (D72, OQ-06), for the Studio lists of groups and stimuli: a question of a primary-stage level (Darjah) or a PKSK question is
 * hidden from everyone, admin included, so a group with such a member, and a stimulus used by such a question, are not listed (a mixed group
 * cannot be shown without a Darjah row). The question predicates are the ones of the question list (`learner-visibility`), on the LATEST
 * version, as the subject and level filters here. A group without members, and a stimulus nobody uses, have nothing to hide.
 */
const GROUP_SECONDARY_ONLY = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
   WHERE q.group_id = g.id AND NOT (${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL}))`
const STIMULUS_SECONDARY_ONLY = Prisma.sql`NOT EXISTS (
  SELECT 1 FROM (
    SELECT gq.id AS qid FROM stimulus_group_stimuli gs JOIN questions gq ON gq.group_id = gs.group_id WHERE gs.stimulus_id = s.id
    UNION ALL
    SELECT lq.id FROM question_version_stimuli vs JOIN question_versions lv ON lv.id = vs.question_version_id JOIN questions lq ON lq.id = lv.question_id WHERE vs.stimulus_id = s.id
    UNION ALL
    SELECT pq.id FROM question_parts pp JOIN question_versions pv ON pv.id = pp.question_version_id JOIN questions pq ON pq.id = pv.question_id WHERE pp.stimulus_id = s.id
  ) u JOIN questions q ON q.id = u.qid JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
  WHERE NOT (${NOT_PKSK_SQL} AND ${NOT_PRIMARY_LEVEL_SQL}))`

/**
 * A group with no member yet fits any EXISTING subject or level (the first question decides, and a group is made before its first
 * question: the Studio picker for a subject must offer it); otherwise a member must match. An id that is not a subject / level matches nothing.
 */
const groupFits = (column: 'subject_id' | 'education_level_id', value: bigint | null): Prisma.Sql => {
  const col = Prisma.raw(`lv.${column}`)
  const table = Prisma.raw(column === 'subject_id' ? 'subjects' : 'education_levels')
  return Prisma.sql`(${value}::bigint IS NULL
    OR (NOT EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id) AND EXISTS (SELECT 1 FROM ${table} x WHERE x.id = ${value}::bigint))
    OR EXISTS (SELECT 1 FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no WHERE q.group_id = g.id AND ${col} = ${value}::bigint))`
}

/** What the member rules need to know about a question. */
export interface QuestionFacts {
  groupId: string | null
  pksk: boolean
  active: boolean
  archived: boolean
  /** Shown to pupils now (see QUESTION_SERVED). */
  served: boolean
  subjectId: string | null
  levelId: string | null
  /** '1' | '2' | '3' from the paper code of the latest version, or null (compatible with any kertas). */
  kertas: '1' | '2' | '3' | null
}
/** Subject, Tingkatan and kertas of one member (latest version). */
export interface MemberTrait {
  subjectId: string | null
  levelId: string | null
  kertas: '1' | '2' | '3' | null
}
/** The short form of a group member (R1-T49). */
export interface MemberBrief {
  groupId: string
  id: string
  numberLabel: string | null
  stem: string
  status: 'draft' | 'review' | 'approved' | 'archived'
  servable: boolean
}

export interface ListFilter {
  page: number
  pageSize: number
  subjectId?: string | undefined
  educationLevelId?: string | undefined
  status?: 'draft' | 'served' | undefined
  /** Groups a question can still join: no member is shown to pupils (the served lock would refuse a change otherwise). */
  joinable?: boolean | undefined
  q?: string | undefined
  kind?: string | undefined
}

/** `%`, `_` and `\` are literal in a search term (the LIKE pattern is escaped, `ESCAPE '\\'`). */
export const likePattern = (term: string): string => `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/** Plain text of a stored stem or body: markup stripped, whitespace collapsed, cut with an ellipsis. */
export function plainExcerpt(text: string | null, max: number): string {
  if (text === null) return ''
  const plain = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return plain.length <= max ? plain : `${plain.slice(0, max).trimEnd()}\u2026`
}

/** `EXISTS` over the three ways a stimulus reaches pupils (a group with a shown member, a shown version link, a shown part link). */
const stimulusServedSql = (stimulusId: Prisma.Sql): Prisma.Sql => Prisma.sql`EXISTS (
  SELECT 1 FROM stimulus_group_stimuli gs JOIN questions q ON q.group_id = gs.group_id WHERE gs.stimulus_id = ${stimulusId} AND ${QUESTION_SERVED}
  UNION ALL
  SELECT 1 FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id JOIN questions q ON q.id = v.question_id
   WHERE vs.stimulus_id = ${stimulusId} AND ${VERSION_SERVED}
  UNION ALL
  SELECT 1 FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id JOIN questions q ON q.id = v.question_id
   WHERE p.stimulus_id = ${stimulusId} AND ${VERSION_SERVED}
)`

const bi = (text: string): bigint | null => (/^[1-9]\d{0,18}$/.test(text) ? BigInt(text) : null)

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
    // A migrated `content_hash` describes the old text: an edit makes it stale, so it is cleared (the API never writes one) (T32-L2).
    await this.db.stimulus.update({ where: { id: BigInt(id) }, data: { ...this.columns(data), contentHash: null } })
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

  /** Distinct questions that use the stimulus: members of a group that links it, plus questions whose versions or parts reference it. */
  async usingQuestionCount(id: string): Promise<number> {
    const key = BigInt(id)
    const rows = await this.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(DISTINCT q.id) AS n FROM (
        SELECT q1.id FROM questions q1 JOIN stimulus_group_stimuli gs ON gs.group_id = q1.group_id WHERE gs.stimulus_id = ${key}
        UNION
        SELECT qv.question_id FROM question_versions qv JOIN question_version_stimuli vs ON vs.question_version_id = qv.id WHERE vs.stimulus_id = ${key}
        UNION
        SELECT qv2.question_id FROM question_versions qv2 JOIN question_parts qp ON qp.question_version_id = qv2.id WHERE qp.stimulus_id = ${key}
      ) q`
    return Number(rows[0]?.n ?? 0n)
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
      subjectId: g.subjectId,
      educationLevelId: g.educationLevelId,
      kertas: g.kertas,
      draftOfGroupId: g.draftOfGroupId,
      draftMembers: draftMembersOf(g.draftMembers),
    }
  }

  // --- lists (R1-T49) -----------------------------------------------------------------------------

  /** One page of stimulus group ids, newest first, with the total over the filter. */
  async listGroupIds(f: ListFilter): Promise<{ ids: string[]; total: number }> {
    const subject = f.subjectId === undefined ? null : bi(f.subjectId)
    const level = f.educationLevelId === undefined ? null : bi(f.educationLevelId)
    if ((f.subjectId !== undefined && subject === null) || (f.educationLevelId !== undefined && level === null)) return { ids: [], total: 0 }
    const pattern = f.q === undefined || f.q === '' ? null : likePattern(f.q)
    const where = Prisma.sql`
      ${GROUP_SECONDARY_ONLY}
      AND g.draft_of_group_id IS NULL
      AND ${groupFits('subject_id', subject)}
      AND ${groupFits('education_level_id', level)}
      AND (${f.status ?? null}::text IS NULL OR (EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id AND ${QUESTION_SERVED})) = (${f.status ?? null}::text = 'served'))
      AND (${f.joinable === true}::boolean IS NOT TRUE OR NOT EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id AND ${QUESTION_SERVED}))
      AND (${pattern}::text IS NULL OR g.label ILIKE ${pattern}::text ESCAPE '\\'
           OR EXISTS (SELECT 1 FROM stimulus_group_stimuli gs JOIN stimuli s ON s.id = gs.stimulus_id
                       WHERE gs.group_id = g.id AND (s.label ILIKE ${pattern}::text ESCAPE '\\' OR s.body_ms ILIKE ${pattern}::text ESCAPE '\\' OR s.body_en ILIKE ${pattern}::text ESCAPE '\\')))`
    const rows = await this.db.$queryRaw<{ id: bigint; total: bigint }[]>`
      SELECT g.id, count(*) OVER () AS total FROM stimulus_groups g WHERE ${where}
       ORDER BY g.updated_at DESC, g.id DESC
       LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`
    if (rows.length > 0) return { ids: rows.map((r) => idToString(r.id)), total: Number(rows[0]?.total ?? 0) }
    // An empty page past the end still reports the real total.
    if (f.page === 1) return { ids: [], total: 0 }
    const count = await this.db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM stimulus_groups g WHERE ${where}`
    return { ids: [], total: Number(count[0]?.n ?? 0) }
  }

  /** The groups of a page in the order of `ids`, in one query (no N+1). */
  async groupsByIds(ids: readonly string[]): Promise<GroupRow[]> {
    const keys = ids.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return []
    const found = await this.db.stimulusGroup.findMany({
      where: { id: { in: keys } },
      include: {
        stimuli: { orderBy: { position: 'asc' }, include: { stimulus: { include: { _count: { select: { groupLinks: true } } } } } },
        options: { orderBy: { position: 'asc' } },
        questions: { orderBy: { groupPosition: 'asc' }, select: { id: true } },
      },
    })
    const byId = new Map(found.map((g) => [idToString(g.id), g]))
    return ids.flatMap((id) => {
      const g = byId.get(id)
      return g === undefined
        ? []
        : [
            {
              id: g.id,
              label: g.label,
              scope: g.scope === 'paper' ? ('paper' as const) : ('section' as const),
              stimuli: g.stimuli.map((x) => this.rowOf(x.stimulus, x.stimulus._count.groupLinks)),
              optionBank: g.options.map((o) => ({ label: o.label, bodyMs: o.bodyMs, bodyEn: o.bodyEn })),
              questionIds: g.questions.map((q) => q.id),
              subjectId: g.subjectId,
              educationLevelId: g.educationLevelId,
              kertas: g.kertas,
              draftOfGroupId: g.draftOfGroupId,
              draftMembers: draftMembersOf(g.draftMembers),
            },
          ]
    })
  }

  /** The short form of the members of every group in `groupIds`, in group order: ONE query for the whole page. */
  async memberBriefs(groupIds: readonly string[]): Promise<Map<string, MemberBrief[]>> {
    const keys = groupIds.map(bi).filter((k): k is bigint => k !== null)
    const out = new Map<string, MemberBrief[]>(groupIds.map((g) => [g, []]))
    if (keys.length === 0) return out
    const rows = await this.db.$queryRaw<{ group_id: bigint; id: bigint; number_label: string | null; stem_ms: string | null; status: string; served: boolean }[]>`
      SELECT q.group_id, q.id, lv.number_label, lv.stem_ms, lv.status, ${QUESTION_SERVED} AS served
        FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.group_id IN (${Prisma.join(keys)})
       ORDER BY q.group_id, q.group_position, q.id`
    for (const r of rows) {
      out.get(idToString(r.group_id))?.push({
        groupId: idToString(r.group_id),
        id: idToString(r.id),
        numberLabel: r.number_label,
        stem: plainExcerpt(r.stem_ms, STIMULUS_MEMBER_STEM_MAX),
        status: r.status as MemberBrief['status'],
        servable: r.served,
      })
    }
    return out
  }

  /** Which of these groups have a member shown to pupils: one query for the page. */
  async servedGroupIds(groupIds: readonly string[]): Promise<Set<string>> {
    const keys = groupIds.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return new Set()
    const rows = await this.db.$queryRaw<{ group_id: bigint }[]>`SELECT DISTINCT q.group_id FROM questions q WHERE q.group_id IN (${Prisma.join(keys)}) AND ${QUESTION_SERVED}`
    return new Set(rows.map((r) => idToString(r.group_id)))
  }

  /** One page of stimulus ids (the seven displayable kinds; `audio` never), newest first, with the total over the filter. */
  async listStimulusIds(f: ListFilter): Promise<{ ids: string[]; total: number }> {
    const subject = f.subjectId === undefined ? null : bi(f.subjectId)
    const level = f.educationLevelId === undefined ? null : bi(f.educationLevelId)
    if ((f.subjectId !== undefined && subject === null) || (f.educationLevelId !== undefined && level === null)) return { ids: [], total: 0 }
    const pattern = f.q === undefined || f.q === '' ? null : likePattern(f.q)
    const users = Prisma.sql`(
      SELECT lv.subject_id, lv.education_level_id
        FROM stimulus_group_stimuli gs JOIN questions q ON q.group_id = gs.group_id JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE gs.stimulus_id = s.id
      UNION ALL
      SELECT lv.subject_id, lv.education_level_id
        FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id JOIN questions q ON q.id = v.question_id
        JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE vs.stimulus_id = s.id
      UNION ALL
      SELECT lv.subject_id, lv.education_level_id
        FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id JOIN questions q ON q.id = v.question_id
        JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE p.stimulus_id = s.id
    )`
    const where = Prisma.sql`
      s.kind <> 'audio'
      AND ${STIMULUS_SECONDARY_ONLY}
      AND (${f.kind ?? null}::text IS NULL OR s.kind = ${f.kind ?? null}::text)
      AND (${subject}::bigint IS NULL OR EXISTS (SELECT 1 FROM ${users} u WHERE u.subject_id = ${subject}::bigint))
      AND (${level}::bigint IS NULL OR EXISTS (SELECT 1 FROM ${users} u WHERE u.education_level_id = ${level}::bigint))
      AND (${f.status ?? null}::text IS NULL OR ${stimulusServedSql(Prisma.sql`s.id`)} = (${f.status ?? null}::text = 'served'))
      AND (${pattern}::text IS NULL OR s.label ILIKE ${pattern}::text ESCAPE '\\' OR s.body_ms ILIKE ${pattern}::text ESCAPE '\\' OR s.body_en ILIKE ${pattern}::text ESCAPE '\\')`
    const rows = await this.db.$queryRaw<{ id: bigint; total: bigint }[]>`
      SELECT s.id, count(*) OVER () AS total FROM stimuli s WHERE ${where}
       ORDER BY s.updated_at DESC, s.id DESC LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`
    if (rows.length > 0) return { ids: rows.map((r) => idToString(r.id)), total: Number(rows[0]?.total ?? 0) }
    if (f.page === 1) return { ids: [], total: 0 }
    const count = await this.db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM stimuli s WHERE ${where}`
    return { ids: [], total: Number(count[0]?.n ?? 0) }
  }

  /** Stimulus rows of a page, in the order of `ids`, plus which are shown to pupils: two queries for the page. */
  async stimuliPage(ids: readonly string[]): Promise<{ rows: StimulusRow[]; served: Set<string> }> {
    const keys = ids.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return { rows: [], served: new Set() }
    const found = await this.db.stimulus.findMany({ where: { id: { in: keys } }, include: { _count: { select: { groupLinks: true } } } })
    const byId = new Map(found.map((r) => [idToString(r.id), this.rowOf(r, r._count.groupLinks)]))
    const flags = await this.db.$queryRaw<{ id: bigint; served: boolean }[]>`SELECT s.id, ${stimulusServedSql(Prisma.sql`s.id`)} AS served FROM stimuli s WHERE s.id IN (${Prisma.join(keys)})`
    return { rows: ids.flatMap((id) => byId.get(id) ?? []), served: new Set(flags.filter((f) => f.served).map((f) => idToString(f.id))) }
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
    traits?: GroupScope
  }): Promise<string> {
    const group = await this.db.stimulusGroup.create({
      data: {
        label: input.label,
        scope: input.scope,
        ...(input.traits === undefined ? {} : { subjectId: bi(input.traits.subjectId ?? ''), educationLevelId: bi(input.traits.educationLevelId ?? ''), kertas: input.traits.kertas }),
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
    await refreshStimulusFlagsOf(this.db, members.map((m) => m.id), new Date())
    return members.map((m) => idToString(m.id))
  }

  // --- members ------------------------------------------------------------------------------------

  /** What the member rules read about one question (D90, R1-T32). */
  async lockQuestions(ids: readonly string[]): Promise<Map<string, QuestionFacts>> {
    const keys = [...new Set(ids.map(bi).filter((k): k is bigint => k !== null))].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    const out = new Map<string, QuestionFacts>()
    if (keys.length === 0) return out
    // Ascending row locks, so two writers cannot deadlock.
    await this.db.$queryRaw`SELECT id FROM questions WHERE id IN (${Prisma.join(keys)}) ORDER BY id FOR UPDATE`
    const rows = await this.db.$queryRaw<
      {
        id: bigint
        group_id: bigint | null
        is_active: boolean
        latest_status: string
        served: boolean
        paper_code: string | null
        subject_id: bigint | null
        level_id: bigint | null
        pksk: boolean
      }[]
    >`
      SELECT q.id, q.group_id, q.is_active, lv.status AS latest_status, ${QUESTION_SERVED} AS served, lv.paper_code,
             lv.subject_id, lv.education_level_id AS level_id,
             EXISTS (SELECT 1 FROM question_tags t WHERE t.question_id = q.id AND t.kind = ${PKSK_TAG}) AS pksk
        FROM questions q
        JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.id IN (${Prisma.join(keys)})`
    for (const r of rows) {
      out.set(idToString(r.id), {
        groupId: r.group_id === null ? null : idToString(r.group_id),
        pksk: r.pksk,
        active: r.is_active,
        archived: r.latest_status === 'archived',
        served: r.served,
        kertas: kertasOfPaperCode(r.paper_code),
        subjectId: r.subject_id === null ? null : idToString(r.subject_id),
        levelId: r.level_id === null ? null : idToString(r.level_id),
      })
    }
    return out
  }

  /** Members of the group in order. */
  async memberIds(groupId: string): Promise<string[]> {
    const key = bi(groupId)
    if (key === null) return []
    const rows = await this.db.question.findMany({ where: { groupId: key }, orderBy: [{ groupPosition: 'asc' }, { id: 'asc' }], select: { id: true } })
    return rows.map((r) => idToString(r.id))
  }

  /** The highest `group_position` in the group (0 when empty). */
  async maxPosition(groupId: string): Promise<number> {
    const key = bi(groupId)
    if (key === null) return 0
    const agg = await this.db.question.aggregate({ where: { groupId: key }, _max: { groupPosition: true } })
    return agg._max.groupPosition ?? 0
  }

  /** Members shown to pupils now: an active question whose live version is approved. */
  async servingMemberIds(groupId: string): Promise<string[]> {
    const key = bi(groupId)
    if (key === null) return []
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id FROM questions q WHERE q.group_id = ${key} AND ${QUESTION_SERVED}`
    return rows.map((r) => idToString(r.id))
  }

  /**
   * Is the stimulus shown to pupils now: by a group with a member shown to pupils, or linked (version link or part link) to a version
   * that is shown to pupils (the live approved version of an active question, or a version pinned by a published paper).
   */
  async stimulusServed(stimulusId: string): Promise<boolean> {
    const key = bi(stimulusId)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ one: number }[]>`
      SELECT 1 AS one FROM stimulus_group_stimuli gs
        JOIN questions q ON q.group_id = gs.group_id
       WHERE gs.stimulus_id = ${key} AND ${QUESTION_SERVED}
      UNION ALL
      SELECT 1 FROM question_version_stimuli vs
        JOIN question_versions v ON v.id = vs.question_version_id
        JOIN questions q ON q.id = v.question_id
       WHERE vs.stimulus_id = ${key} AND ${VERSION_SERVED}
      UNION ALL
      SELECT 1 FROM question_parts p
        JOIN question_versions v ON v.id = p.question_version_id
        JOIN questions q ON q.id = v.question_id
       WHERE p.stimulus_id = ${key} AND ${VERSION_SERVED}
      LIMIT 1`
    return rows.length > 0
  }

  /** Subject and kertas of the latest versions of the members (one entry per distinct pair), leaving out `except`. */
  async memberTraits(groupId: string, except: string | null = null): Promise<MemberTrait[]> {
    const key = bi(groupId)
    if (key === null) return []
    const skip = except === null ? null : bi(except)
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; level_id: bigint | null; paper_code: string | null }[]>`
      SELECT DISTINCT lv.subject_id, lv.education_level_id AS level_id, lv.paper_code
        FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.group_id = ${key} AND (${skip}::bigint IS NULL OR q.id <> ${skip}::bigint)`
    return rows.map((r) => ({ subjectId: r.subject_id === null ? null : idToString(r.subject_id), levelId: r.level_id === null ? null : idToString(r.level_id), kertas: kertasOfPaperCode(r.paper_code) }))
  }

  /** Puts the questions in the group at positions `from`, `from + 1`, ... in the order given. */
  async attachQuestions(groupId: string, questionIds: readonly string[], from: number): Promise<void> {
    for (const [i, q] of questionIds.entries()) {
      await this.db.question.update({ where: { id: BigInt(q) }, data: { groupId: BigInt(groupId), groupPosition: from + i } })
    }
    await refreshStimulusFlagsOf(this.db, questionIds.map((q) => BigInt(q)), new Date())
  }

  async detachQuestion(questionId: string): Promise<void> {
    await this.db.question.update({ where: { id: BigInt(questionId) }, data: { groupId: null, groupPosition: null } })
    await refreshStimulusFlagsOf(this.db, [BigInt(questionId)], new Date())
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

  // --- scope, draft copy and group actions (S1-T01, DM-51) ------------------------------------------

  async subjectExists(id: string): Promise<boolean> {
    const key = bi(id)
    return key !== null && (await this.db.$queryRaw<{ one: number }[]>`SELECT 1 AS one FROM subjects WHERE id = ${key}`).length > 0
  }

  async levelExists(id: string): Promise<boolean> {
    const key = bi(id)
    return key !== null && (await this.db.$queryRaw<{ one: number }[]>`SELECT 1 AS one FROM education_levels WHERE id = ${key}`).length > 0
  }

  async setGroupScope(id: string, scope: GroupScope): Promise<void> {
    await this.db.stimulusGroup.update({
      where: { id: BigInt(id) },
      data: { subjectId: bi(scope.subjectId ?? ''), educationLevelId: bi(scope.educationLevelId ?? ''), kertas: scope.kertas, updatedAt: new Date() },
    })
  }

  /** The stored scope of the group (DM-51) and whether it is a draft copy. */
  async groupScope(id: string): Promise<(GroupScope & { draftOfGroupId: string | null }) | null> {
    const key = bi(id)
    if (key === null) return null
    const g = await this.db.stimulusGroup.findUnique({ where: { id: key }, select: { subjectId: true, educationLevelId: true, kertas: true, draftOfGroupId: true } })
    if (g === null) return null
    return {
      subjectId: g.subjectId === null ? null : idToString(g.subjectId),
      educationLevelId: g.educationLevelId === null ? null : idToString(g.educationLevelId),
      kertas: g.kertas,
      draftOfGroupId: g.draftOfGroupId === null ? null : idToString(g.draftOfGroupId),
    }
  }

  /** Latest-version status of every member in order (position = 1-based place in the group). */
  async memberStatuses(groupId: string): Promise<{ id: string; position: number; status: 'draft' | 'review' | 'approved' | 'archived' }[]> {
    const key = bi(groupId)
    if (key === null) return []
    const rows = await this.db.$queryRaw<{ id: bigint; status: string }[]>`
      SELECT q.id, lv.status FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.group_id = ${key} ORDER BY q.group_position, q.id`
    return rows.map((r, i) => ({ id: idToString(r.id), position: i + 1, status: r.status as 'draft' | 'review' | 'approved' | 'archived' }))
  }

  /** Latest-version status of the given questions in the order asked; an id that is not a question is left out. */
  async statusesOf(ids: readonly string[]): Promise<{ id: string; position: number; status: 'draft' | 'review' | 'approved' | 'archived' }[]> {
    const keys = ids.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: bigint; status: string }[]>`
      SELECT q.id, lv.status FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.id IN (${Prisma.join(keys)})`
    const byId = new Map(rows.map((r) => [idToString(r.id), r.status as 'draft' | 'review' | 'approved' | 'archived']))
    return ids.flatMap((id) => {
      const status = byId.get(id)
      return status === undefined ? [] : [{ id, position: 0, status }]
    }).map((m, i) => ({ ...m, position: i + 1 }))
  }

  /** The group each of the questions sits in now (questions in no group are left out). */
  async groupsOfQuestions(ids: readonly string[]): Promise<Map<string, string>> {
    const keys = ids.map(bi).filter((k): k is bigint => k !== null)
    const out = new Map<string, string>()
    if (keys.length === 0) return out
    const rows = await this.db.$queryRaw<{ id: bigint; group_id: bigint }[]>`SELECT id, group_id FROM questions WHERE id IN (${Prisma.join(keys)}) AND group_id IS NOT NULL`
    for (const r of rows) out.set(idToString(r.id), idToString(r.group_id))
    return out
  }

  /** Replaces the ordered question ids staged in a draft copy. */
  async setDraftMembers(draftId: string, ids: readonly string[]): Promise<void> {
    await this.db.stimulusGroup.update({ where: { id: BigInt(draftId) }, data: { draftMembers: [...ids], updatedAt: new Date() } })
  }

  /**
   * The swap (S1-T01 part 3b): the live group takes the label, scope, option bank and stimuli of its draft copy. The copy's stimulus rows are
   * linked to the live group (the live group id never changes); the live group's old stimulus rows are kept, only unlinked (D113: a row a
   * published version or paper may reference is immutable and never deleted). The copy's option rows move to the live group.
   */
  async replaceFromCopy(liveId: string, draftId: string): Promise<void> {
    const live = BigInt(liveId)
    const draft = BigInt(draftId)
    const copy = await this.db.stimulusGroup.findUniqueOrThrow({
      where: { id: draft },
      select: { label: true, scope: true, subjectId: true, educationLevelId: true, kertas: true, stimuli: { orderBy: { position: 'asc' }, select: { stimulusId: true } } },
    })
    await this.db.stimulusGroup.update({
      where: { id: live },
      data: { label: copy.label, scope: copy.scope, subjectId: copy.subjectId, educationLevelId: copy.educationLevelId, kertas: copy.kertas, updatedAt: new Date() },
    })
    await this.replaceGroupStimuli(liveId, copy.stimuli.map((x) => x.stimulusId))
    await this.db.stimulusGroupOption.deleteMany({ where: { groupId: live } })
    await this.db.stimulusGroupOption.updateMany({ where: { groupId: draft }, data: { groupId: live } })
  }

  /** The id of the open draft copy of a group, or null. */
  async draftCopyOf(groupId: string): Promise<string | null> {
    const key = bi(groupId)
    if (key === null) return null
    const g = await this.db.stimulusGroup.findFirst({ where: { draftOfGroupId: key }, select: { id: true } })
    return g === null ? null : idToString(g.id)
  }

  /**
   * Makes the draft copy of a group (DM-51): a new group row pointing at the live one (`draft_of_group_id`) with the same label, scope and
   * option bank, NEW stimulus rows copied from the live stimuli (a served stimulus is never edited in place, D113) in the same order, and the
   * ordered member ids staged in `draft_members`. The members themselves stay in the live group.
   */
  async createDraftCopy(source: GroupRow, memberIds: readonly string[], createdBy: string | null): Promise<string> {
    const options = await this.db.stimulusGroupOption.findMany({ where: { groupId: source.id }, orderBy: { position: 'asc' } })
    // The group row first: the stimulus copies are then never older than their copy group (`deleteDraftCopy` tells them apart by that).
    const group = await this.db.stimulusGroup.create({
      data: {
        label: source.label,
        scope: source.scope,
        subjectId: source.subjectId,
        educationLevelId: source.educationLevelId,
        kertas: source.kertas,
        draftOfGroupId: source.id,
        draftMembers: [...memberIds],
        draftCreatedBy: createdBy === null ? null : bi(createdBy),
        draftCreatedAt: new Date(),
        options: {
          create: options.map((o) => ({ label: o.label, bodyMs: o.bodyMs, bodyEn: o.bodyEn, body: o.body, imageFileId: o.imageFileId, isDistractor: o.isDistractor, position: o.position })),
        },
      },
    })
    for (const [i, st] of source.stimuli.entries()) {
      const { id: _id, groupCount: _gc, shownTable: _st, bodyIsTable: _bt, ...data } = st
      void _id
      void _gc
      void _st
      void _bt
      const copyId = BigInt(await this.createStimulus(data))
      await this.db.stimulusGroupStimulus.create({ data: { groupId: group.id, stimulusId: copyId, position: i + 1 } })
    }
    return idToString(group.id)
  }

  /**
   * Discards a draft copy: the group row (its stimulus links and option rows cascade) and the stimulus copies nobody else uses (rows created
   * with or after the copy that no other group, version or part links). The live group, its members and their versions are never touched.
   */
  async deleteDraftCopy(draftId: string): Promise<void> {
    const key = BigInt(draftId)
    const g = await this.db.stimulusGroup.findUnique({ where: { id: key }, select: { createdAt: true, stimuli: { select: { stimulusId: true } } } })
    if (g === null) return
    await this.db.stimulusGroup.delete({ where: { id: key } })
    for (const { stimulusId } of g.stimuli) {
      const use = await this.usageOf(idToString(stimulusId))
      if (use.groups + use.versions + use.parts > 0) continue
      const row = await this.db.stimulus.findUnique({ where: { id: stimulusId }, select: { createdAt: true } })
      if (row !== null && row.createdAt.getTime() >= g.createdAt.getTime()) await this.db.stimulus.delete({ where: { id: stimulusId } })
    }
  }

  /** Short forms of the given questions in the order asked (the staged members of a draft copy). */
  async memberBriefsOf(questionIds: readonly string[], groupId: string): Promise<MemberBrief[]> {
    const keys = questionIds.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: bigint; number_label: string | null; stem_ms: string | null; status: string; served: boolean }[]>`
      SELECT q.id, lv.number_label, lv.stem_ms, lv.status, ${QUESTION_SERVED} AS served
        FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.id IN (${Prisma.join(keys)})`
    const byId = new Map(rows.map((r) => [idToString(r.id), r]))
    return questionIds.flatMap((id) => {
      const r = byId.get(id)
      return r === undefined ? [] : [{ groupId, id, numberLabel: r.number_label, stem: plainExcerpt(r.stem_ms, STIMULUS_MEMBER_STEM_MAX), status: r.status as MemberBrief['status'], servable: r.served }]
    })
  }

  /** Of the given question ids that sit in a group: each group with ALL its member ids (a bulk list must hold a group whole or not at all). */
  async groupsHolding(questionIds: readonly string[]): Promise<Map<string, { members: string[]; listed: string[] }>> {
    const keys = [...new Set(questionIds.map(bi).filter((k): k is bigint => k !== null))]
    const out = new Map<string, { members: string[]; listed: string[] }>()
    if (keys.length === 0) return out
    const listed = await this.db.$queryRaw<{ id: bigint; group_id: bigint }[]>`SELECT id, group_id FROM questions WHERE id IN (${Prisma.join(keys)}) AND group_id IS NOT NULL`
    const groups = [...new Set(listed.map((r) => r.group_id))]
    if (groups.length === 0) return out
    const all = await this.db.$queryRaw<{ id: bigint; group_id: bigint }[]>`SELECT id, group_id FROM questions WHERE group_id IN (${Prisma.join(groups)}) ORDER BY group_id, group_position, id`
    for (const g of groups) {
      out.set(idToString(g), {
        members: all.filter((r) => r.group_id === g).map((r) => idToString(r.id)),
        listed: listed.filter((r) => r.group_id === g).map((r) => idToString(r.id)),
      })
    }
    return out
  }

  /** Terbit papers that place any of the questions (id and title, once each, by id). Read only: the placement tables belong to the exam module. */
  async publishedPapersPlacing(questionIds: readonly string[]): Promise<{ id: string; title: string }[]> {
    const keys = [...new Set(questionIds.map(bi).filter((k): k is bigint => k !== null))]
    if (keys.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: bigint; title: string }[]>`
      SELECT DISTINCT p.id, p.title
        FROM paper_placements pl
        JOIN paper_sections s ON s.id = pl.paper_section_id
        JOIN papers p ON p.id = s.paper_id
       WHERE pl.question_id IN (${Prisma.join(keys)}) AND p.status = 'published'
       ORDER BY p.id`
    return rows.map((r) => ({ id: idToString(r.id), title: r.title }))
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
      style: d.style,
      tableData: d.tableData === null ? Prisma.JsonNull : (d.tableData as unknown as Prisma.InputJsonValue),
      assetFileId: d.assetFileId,
    }
  }

  private rowOf(
    r: { id: bigint; kind: string; label: string | null; caption: string | null; bodyMs: string | null; bodyEn: string | null; altText: string | null; sourceCitation: string | null; style: string | null; tableData: unknown; assetFileId: bigint | null },
    groupCount: number,
  ): StimulusRow {
    const parts = stimulusTableParts(r.kind, r.tableData, r.bodyMs)
    return {
      id: r.id,
      kind: r.kind as StimulusKind,
      label: r.label,
      caption: r.caption,
      bodyMs: r.bodyMs,
      bodyEn: r.bodyEn,
      altText: r.altText,
      sourceCitation: r.sourceCitation,
      style: r.style,
      tableData: stimulusTableOf(r.tableData) ?? null,
      shownTable: parts.table ?? null,
      bodyIsTable: parts.bodyIsTable,
      assetFileId: r.assetFileId,
      groupCount,
    }
  }
}
