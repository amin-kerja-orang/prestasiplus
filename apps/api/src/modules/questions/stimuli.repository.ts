import { Inject, Injectable } from '@nestjs/common'
import { STIMULUS_MEMBER_STEM_MAX } from '@pp/contract'

import { Prisma } from '../../db/generated/client'
import { idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { kertasOfPaperCode } from './projection'
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

/**
 * A question is SHOWN TO PUPILS when (A) it is active and its live version is approved, or (B) a placement of a published paper pins one of
 * its versions (approved or archived): the paper serves that version whether the question is active or not, as the attempt bridge and the
 * `question_image` read rule do (`files/question-image-access.ts`). Alias `q` is `questions`. This is the "served lock" predicate.
 */
const QUESTION_SERVED = Prisma.sql`(
  (q.is_active AND EXISTS (SELECT 1 FROM question_versions sv WHERE sv.question_id = q.id AND sv.version_no = q.live_version_no AND sv.status = 'approved'))
  OR EXISTS (SELECT 1 FROM paper_placements spl
               JOIN paper_sections sps ON sps.id = spl.paper_section_id
               JOIN papers spp ON spp.id = sps.paper_id AND spp.status = 'published'
               JOIN question_versions spv ON spv.question_id = q.id AND spv.version_no = spl.pinned_version_no AND spv.status IN ('approved', 'archived')
              WHERE spl.question_id = q.id)
)`

/** The same rule for one version `v` of question `q`: it is the live approved version of an active question, or a published paper pins it. */
const VERSION_SERVED = Prisma.sql`(
  (q.live_version_no = v.version_no AND q.is_active AND v.status = 'approved')
  OR (v.status IN ('approved', 'archived') AND EXISTS (SELECT 1 FROM paper_placements spl
               JOIN paper_sections sps ON sps.id = spl.paper_section_id
               JOIN papers spp ON spp.id = sps.paper_id AND spp.status = 'published'
              WHERE spl.question_id = q.id AND spl.pinned_version_no = v.version_no))
)`

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


/**
 * Shown to pupils NOW, as the served lock has it today: the question is active and its live version is approved. Alias `q` is `questions`.
 * (REQ-B-012 widens the lock to versions pinned by published papers; the list `status` and the member `servable` flag must follow it:
 * replace this one constant with that predicate.)
 */
const SERVED_NOW = Prisma.sql`(q.is_active AND EXISTS (SELECT 1 FROM question_versions sv WHERE sv.question_id = q.id AND sv.version_no = q.live_version_no AND sv.status = 'approved'))`

/** The same rule for one version `v` of question `q`. */
const VERSION_SERVED_NOW = Prisma.sql`(q.live_version_no = v.version_no AND q.is_active AND v.status = 'approved')`

/** `EXISTS` over the three ways a stimulus reaches pupils (a group with a shown member, a shown version link, a shown part link). */
const stimulusServedSql = (stimulusId: Prisma.Sql): Prisma.Sql => Prisma.sql`EXISTS (
  SELECT 1 FROM stimulus_group_stimuli gs JOIN questions q ON q.group_id = gs.group_id WHERE gs.stimulus_id = ${stimulusId} AND ${SERVED_NOW}
  UNION ALL
  SELECT 1 FROM question_version_stimuli vs JOIN question_versions v ON v.id = vs.question_version_id JOIN questions q ON q.id = v.question_id
   WHERE vs.stimulus_id = ${stimulusId} AND ${VERSION_SERVED_NOW}
  UNION ALL
  SELECT 1 FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id JOIN questions q ON q.id = v.question_id
   WHERE p.stimulus_id = ${stimulusId} AND ${VERSION_SERVED_NOW}
)`

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

  // --- lists (R1-T49) -----------------------------------------------------------------------------

  /** One page of stimulus group ids, newest first, with the total over the filter. */
  async listGroupIds(f: ListFilter): Promise<{ ids: string[]; total: number }> {
    const subject = f.subjectId === undefined ? null : bi(f.subjectId)
    const level = f.educationLevelId === undefined ? null : bi(f.educationLevelId)
    if ((f.subjectId !== undefined && subject === null) || (f.educationLevelId !== undefined && level === null)) return { ids: [], total: 0 }
    const pattern = f.q === undefined || f.q === '' ? null : likePattern(f.q)
    const rows = await this.db.$queryRaw<{ id: bigint; total: bigint }[]>`
      SELECT g.id, count(*) OVER () AS total
        FROM stimulus_groups g
       WHERE (${subject}::bigint IS NULL OR EXISTS (SELECT 1 FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
                                                      WHERE q.group_id = g.id AND lv.subject_id = ${subject}::bigint))
         AND (${level}::bigint IS NULL OR EXISTS (SELECT 1 FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
                                                    WHERE q.group_id = g.id AND lv.education_level_id = ${level}::bigint))
         AND (${f.status ?? null}::text IS NULL OR (EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id AND ${SERVED_NOW})) = (${f.status ?? null}::text = 'served'))
         AND (${pattern}::text IS NULL OR g.label ILIKE ${pattern}::text ESCAPE '\\'
              OR EXISTS (SELECT 1 FROM stimulus_group_stimuli gs JOIN stimuli s ON s.id = gs.stimulus_id
                          WHERE gs.group_id = g.id AND (s.label ILIKE ${pattern}::text ESCAPE '\\' OR s.body_ms ILIKE ${pattern}::text ESCAPE '\\' OR s.body_en ILIKE ${pattern}::text ESCAPE '\\')))
       ORDER BY g.updated_at DESC, g.id DESC
       LIMIT ${f.pageSize} OFFSET ${(f.page - 1) * f.pageSize}`
    if (rows.length > 0) return { ids: rows.map((r) => idToString(r.id)), total: Number(rows[0]?.total ?? 0) }
    // An empty page past the end still reports the real total.
    const total = f.page === 1 ? 0 : await this.countGroups(f, subject, level, pattern)
    return { ids: [], total }
  }

  private async countGroups(f: ListFilter, subject: bigint | null, level: bigint | null, pattern: string | null): Promise<number> {
    const rows = await this.db.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n
        FROM stimulus_groups g
       WHERE (${subject}::bigint IS NULL OR EXISTS (SELECT 1 FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
                                                      WHERE q.group_id = g.id AND lv.subject_id = ${subject}::bigint))
         AND (${level}::bigint IS NULL OR EXISTS (SELECT 1 FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
                                                    WHERE q.group_id = g.id AND lv.education_level_id = ${level}::bigint))
         AND (${f.status ?? null}::text IS NULL OR (EXISTS (SELECT 1 FROM questions q WHERE q.group_id = g.id AND ${SERVED_NOW})) = (${f.status ?? null}::text = 'served'))
         AND (${pattern}::text IS NULL OR g.label ILIKE ${pattern}::text ESCAPE '\\'
              OR EXISTS (SELECT 1 FROM stimulus_group_stimuli gs JOIN stimuli s ON s.id = gs.stimulus_id
                          WHERE gs.group_id = g.id AND (s.label ILIKE ${pattern}::text ESCAPE '\\' OR s.body_ms ILIKE ${pattern}::text ESCAPE '\\' OR s.body_en ILIKE ${pattern}::text ESCAPE '\\')))`
    return Number(rows[0]?.n ?? 0)
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
      SELECT q.group_id, q.id, lv.number_label, lv.stem_ms, lv.status, ${SERVED_NOW} AS served
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
    const rows = await this.db.$queryRaw<{ group_id: bigint }[]>`SELECT DISTINCT q.group_id FROM questions q WHERE q.group_id IN (${Prisma.join(keys)}) AND ${SERVED_NOW}`
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
    )`
    const where = Prisma.sql`
      s.kind <> 'audio'
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
  async memberTraits(groupId: string, except: string | null = null): Promise<{ subjectId: string | null; kertas: '1' | '2' | '3' | null }[]> {
    const key = bi(groupId)
    if (key === null) return []
    const skip = except === null ? null : bi(except)
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; paper_code: string | null }[]>`
      SELECT DISTINCT lv.subject_id, lv.paper_code
        FROM questions q JOIN question_versions lv ON lv.question_id = q.id AND lv.version_no = q.latest_version_no
       WHERE q.group_id = ${key} AND (${skip}::bigint IS NULL OR q.id <> ${skip}::bigint)`
    return rows.map((r) => ({ subjectId: r.subject_id === null ? null : idToString(r.subject_id), kertas: kertasOfPaperCode(r.paper_code) }))
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
