import { Inject, Injectable } from '@nestjs/common'
import {
  DATABANK_PAGE_SIZE,
  DatabankQuestionsQuerySchema,
  type DatabankOverview,
  type ListMeta,
} from '@pp/contract'
import type { z } from 'zod'

import { Prisma } from '../../../db/generated/client'
import { idFromString, idToString } from '../../../db/ids'
import { PrismaService } from '../../../db/prisma.service'
import { listMeta } from '../../../common/http'
import { QuestionsRepository } from '../../questions'
import { parseStrict } from '../strict-body'

type Query = z.output<typeof DatabankQuestionsQuerySchema>
type SubjectTile = DatabankOverview['teras'][number]

export interface DatabankStimulus {
  id: string
  kind: string
  label: string
  bodyMs: string | null
  bodyEn: string | null
  imageId: string | null
  alt: string | null
  caption: string | null
  sourceCitation: string | null
  tableData: unknown
}
export interface DatabankQuestion {
  id: string
  stemMs: string | null
  stemEn: string | null
  type: string
  options: { label: string; bodyMs: string | null; bodyEn: string | null; imageId: string | null }[]
  stimuli: DatabankStimulus[]
  subjectId: string
  subject: string
  levelLabel: string
  difficulty: number | null
  status: 'approved'
  groupPosition: number | null
}
export interface DatabankRow {
  unitId: string
  group: { id: string; stimuli: DatabankStimulus[] } | null
  questions: DatabankQuestion[]
}
export interface DatabankPage {
  data: DatabankRow[]
  meta: ListMeta & { totalUnits: number; totalQuestions: number }
}

/** Tingkatan 1 to 5 only (D72, D101). The learner predicate lets a question with no level through; the Databank does not. */
const TINGKATAN_1_5_SQL = Prisma.sql`EXISTS (SELECT 1 FROM education_levels dl WHERE dl.id = v.education_level_id AND dl.code ~ '^T[1-5]$' AND dl.stage <> 'primary' AND dl.is_active)`
/** The question's subject exists and is active (a subject-less question has no tile to count in). */
const ACTIVE_SUBJECT_SQL = Prisma.sql`EXISTS (SELECT 1 FROM subjects ds WHERE ds.id = v.subject_id AND ds.is_active)`

const likePattern = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/**
 * Databank Soalan for teachers (S6-T19, API-GUR-27). Read-only. The ONE set it counts and lists is what pupils are served:
 * `QuestionsRepository.scopeSql({ status: 'approved', active: true, wholeGroups: true }, true)` (live version approved, active
 * question, learner-visible level, not source-taken-down, not flagged `stimulus_missing`/`figure_only`, every leaf keyed, not PKSK,
 * a group only when it is complete) plus the Tingkatan 1-5 and active-subject guards above, so the tile of a subject equals the
 * total of its list (D11, D91). It does not use SPM_SERVABLE_SQL (T4/T5 only) nor the pupil `/spm/databank` lane.
 */
@Injectable()
export class DatabankService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly bank: QuestionsRepository,
  ) {}

  /** FROM + WHERE of the servable set (aliases `q`, `v`). */
  private servable(): { from: Prisma.Sql; where: Prisma.Sql } {
    // S6-T16 / DM-42: add the `visibility = 'bank'` condition here once personal questions exist.
    const scope = this.bank.scopeSql({ status: 'approved', active: true, wholeGroups: true }, true)
    return { from: scope.from, where: Prisma.sql`${scope.where} AND ${TINGKATAN_1_5_SQL} AND ${ACTIVE_SUBJECT_SQL}` }
  }

  async overview(): Promise<DatabankOverview> {
    const { from, where } = this.servable()
    const rows = await this.prisma.client.$queryRaw<{ id: bigint; name: string; name_en: string; is_core: boolean; n: number }[]>(Prisma.sql`
      SELECT s.id, s.name, s.name_en, s.is_core, COALESCE(c.n, 0)::int AS n
        FROM subjects s
        LEFT JOIN (SELECT v.subject_id AS sid, count(*) AS n ${from} WHERE ${where} GROUP BY v.subject_id) c ON c.sid = s.id
       WHERE s.is_active
       ORDER BY s.sort_order, s.name, s.id`)
    const tiles = rows.map((r) => ({ core: r.is_core, tile: { subjectId: idToString(r.id), nameMs: r.name, nameEn: r.name_en, count: r.n } satisfies SubjectTile }))
    return {
      totalQuestions: tiles.reduce((sum, t) => sum + t.tile.count, 0),
      activeSubjects: tiles.filter((t) => t.tile.count > 0).length,
      teras: tiles.filter((t) => t.core).map((t) => t.tile),
      elektif: tiles.filter((t) => !t.core).map((t) => t.tile),
    }
  }

  async questions(rawQuery: Record<string, unknown>): Promise<DatabankPage> {
    const query: Query = parseStrict(DatabankQuestionsQuerySchema, rawQuery)
    const page = query.page ?? 1
    const search = query.q && query.q.length > 0 ? query.q : null
    const { from, where } = this.servable()
    const subject = query.subjectId ? Prisma.sql`AND v.subject_id = ${idFromString(query.subjectId)}` : Prisma.empty
    const hit = search ? Prisma.sql`(v.stem_ms ILIKE ${likePattern(search)} ESCAPE '\\' OR v.stem_en ILIKE ${likePattern(search)} ESCAPE '\\')` : Prisma.sql`TRUE`
    // One row per unit: a group is `g<id>`, a standalone question `q<id>`; a unit is listed when any member matches the search.
    const units = Prisma.sql`
      WITH s AS (
        SELECT q.id, q.group_id, CASE WHEN q.group_id IS NULL THEN 'q' || q.id ELSE 'g' || q.group_id END AS unit_key, ${hit} AS hit
          ${from} WHERE ${where} ${subject}
      ), u AS (
        SELECT unit_key, max(id) AS newest, count(*)::int AS members FROM s GROUP BY unit_key HAVING bool_or(hit)
      )`
    const totals = await this.prisma.client.$queryRaw<{ units: number; members: number }[]>(
      Prisma.sql`${units} SELECT count(*)::int AS units, COALESCE(sum(members), 0)::int AS members FROM u`,
    )
    const totalUnits = totals[0]?.units ?? 0
    const totalQuestions = totals[0]?.members ?? 0
    const meta = { ...listMeta(page, DATABANK_PAGE_SIZE, totalUnits), totalUnits, totalQuestions }
    if (totalUnits === 0 || (page - 1) * DATABANK_PAGE_SIZE >= totalUnits) return { data: [], meta }

    const pageUnits = await this.prisma.client.$queryRaw<{ unit_key: string }[]>(
      Prisma.sql`${units} SELECT unit_key FROM u ORDER BY newest DESC, unit_key LIMIT ${DATABANK_PAGE_SIZE} OFFSET ${(page - 1) * DATABANK_PAGE_SIZE}`,
    )
    const keys = pageUnits.map((u) => u.unit_key)
    const groupIds = keys.filter((k) => k.startsWith('g')).map((k) => BigInt(k.slice(1)))
    const singleIds = keys.filter((k) => k.startsWith('q')).map((k) => BigInt(k.slice(1)))
    return { data: await this.rowsOf(keys, groupIds, singleIds), meta }
  }

  /** The members of the page units (same servable set), with options and stimuli, in page order. */
  private async rowsOf(keys: string[], groupIds: bigint[], singleIds: bigint[]): Promise<DatabankRow[]> {
    const { from, where } = this.servable()
    const members = await this.prisma.client.$queryRaw<
      { id: bigint; vid: bigint; group_id: bigint | null; group_position: number | null; stem_ms: string | null; stem_en: string | null; type: string; difficulty: number | null; subject_id: bigint; subject: string; level: string }[]
    >(Prisma.sql`
      SELECT q.id, v.id AS vid, q.group_id, q.group_position, v.stem_ms, v.stem_en, v.type, v.difficulty_level AS difficulty,
             v.subject_id, (SELECT sj.name FROM subjects sj WHERE sj.id = v.subject_id) AS subject,
             (SELECT el.name FROM education_levels el WHERE el.id = v.education_level_id) AS level
        ${from}
       WHERE ${where} AND (q.group_id = ANY(${groupIds}::bigint[]) OR (q.group_id IS NULL AND q.id = ANY(${singleIds}::bigint[])))
       ORDER BY q.group_position NULLS LAST, q.id`)
    const vids = members.map((m) => m.vid)
    const parts = await this.prisma.client.$queryRaw<{ vid: bigint; part_id: bigint; mode: string | null; label: string | null; body_ms: string | null; body_en: string | null; image: bigint | null }[]>(Prisma.sql`
      SELECT p.question_version_id AS vid, p.id AS part_id, p.mode, o.label, o.body_ms, o.body_en, o.image_file_id AS image
        FROM question_parts p LEFT JOIN part_options o ON o.part_id = p.id
       WHERE p.question_version_id = ANY(${vids}::bigint[])
       ORDER BY p.question_version_id, p.id, o.position`)
    const direct = await this.prisma.client.$queryRaw<{ vid: bigint; sid: bigint }[]>(Prisma.sql`
      SELECT question_version_id AS vid, stimulus_id AS sid FROM question_version_stimuli WHERE question_version_id = ANY(${vids}::bigint[]) ORDER BY question_version_id, position`)
    const grouped = await this.prisma.client.$queryRaw<{ gid: bigint; sid: bigint }[]>(Prisma.sql`
      SELECT group_id AS gid, stimulus_id AS sid FROM stimulus_group_stimuli WHERE group_id = ANY(${groupIds}::bigint[]) ORDER BY group_id, position`)
    const stimuli = await this.stimuliOf([...new Set([...direct.map((d) => d.sid), ...grouped.map((g) => g.sid)].map(idToString))])

    const partsOf = new Map<string, { mode: string | null; options: DatabankQuestion['options'] }[]>()
    const seenPart = new Map<string, { mode: string | null; options: DatabankQuestion['options'] }>()
    for (const p of parts) {
      const vk = idToString(p.vid)
      const pk = idToString(p.part_id)
      let part = seenPart.get(pk)
      if (!part) {
        part = { mode: p.mode, options: [] }
        seenPart.set(pk, part)
        partsOf.set(vk, [...(partsOf.get(vk) ?? []), part])
      }
      if (p.label !== null) part.options.push({ label: p.label, bodyMs: p.body_ms, bodyEn: p.body_en, imageId: p.image === null ? null : idToString(p.image) })
    }
    const stimuliByVersion = new Map<string, DatabankStimulus[]>()
    for (const d of direct) {
      const s = stimuli.get(idToString(d.sid))
      if (s) stimuliByVersion.set(idToString(d.vid), [...(stimuliByVersion.get(idToString(d.vid)) ?? []), s])
    }
    const stimuliByGroup = new Map<string, DatabankStimulus[]>()
    for (const g of grouped) {
      const s = stimuli.get(idToString(g.sid))
      if (s) stimuliByGroup.set(idToString(g.gid), [...(stimuliByGroup.get(idToString(g.gid)) ?? []), s])
    }

    const byUnit = new Map<string, DatabankQuestion[]>()
    for (const m of members) {
      const only = partsOf.get(idToString(m.vid)) ?? []
      const question: DatabankQuestion = {
        id: idToString(m.id),
        stemMs: m.stem_ms,
        stemEn: m.stem_en,
        type: m.type,
        options: only.length === 1 && only[0]?.mode === 'mcq' ? only[0].options : [],
        stimuli: stimuliByVersion.get(idToString(m.vid)) ?? [],
        subjectId: idToString(m.subject_id),
        subject: m.subject,
        levelLabel: m.level,
        difficulty: m.difficulty,
        status: 'approved',
        groupPosition: m.group_position,
      }
      const key = m.group_id === null ? `q${idToString(m.id)}` : `g${idToString(m.group_id)}`
      byUnit.set(key, [...(byUnit.get(key) ?? []), question])
    }
    return keys.flatMap((key) => {
      const questions = byUnit.get(key)
      if (!questions) return []
      const gid = key.startsWith('g') ? key.slice(1) : null
      return [{ unitId: key, group: gid === null ? null : { id: gid, stimuli: stimuliByGroup.get(gid) ?? [] }, questions }]
    })
  }

  private async stimuliOf(ids: string[]): Promise<Map<string, DatabankStimulus>> {
    const out = new Map<string, DatabankStimulus>()
    if (ids.length === 0) return out
    const rows = await this.prisma.client.stimulus.findMany({ where: { id: { in: ids.map((i) => idFromString(i)) } } })
    for (const r of rows) {
      out.set(idToString(r.id), {
        id: idToString(r.id),
        kind: r.kind,
        label: r.label ?? '',
        bodyMs: r.bodyMs,
        bodyEn: r.bodyEn,
        imageId: r.assetFileId === null ? null : idToString(r.assetFileId),
        alt: r.altText,
        caption: r.caption,
        sourceCitation: r.sourceCitation,
        tableData: r.tableData ?? null,
      })
    }
    return out
  }
}
