import { Inject, Injectable, Optional } from '@nestjs/common'
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
import { OverviewCache, QuestionsRepository } from '../../questions'
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

/** The slot of the servable-set snapshot in the shared `OverviewCache` (a question event marks it stale; `evict` makes the next read compute it afresh). */
export const DATABANK_SNAPSHOT_SCOPE = 'databank:snapshot'

/**
 * Every row of the servable set (see the class comment), newest question first: the question id, its group id (0 = none) and its subject id.
 * Ids are exact as doubles (they stay far below 2^53), which keeps the 333 thousand rows of UAT in three flat arrays (about 8 MB).
 */
export interface DatabankSnapshot {
  ids: readonly number[]
  groups: readonly number[]
  subjects: readonly number[]
}

/** The units of a snapshot slice, newest unit first: a group is `-groupId`, a standalone question its own id; `members` = servable questions of the unit. */
interface UnitList {
  keys: number[]
  members: number[]
  totalQuestions: number
}

const keyOf = (key: number): string => (key < 0 ? `g${-key}` : `q${key}`)

/**
 * Databank Soalan for teachers (S6-T19, API-GUR-27). Read-only. The ONE set it counts and lists is what pupils are served:
 * `QuestionsRepository.scopeSql({ status: 'approved', active: true, wholeGroups: true }, true)` (live version approved, active
 * question, learner-visible level, not source-taken-down, not flagged `stimulus_missing`/`figure_only`, every leaf keyed, not PKSK,
 * a group only when it is complete) plus the Tingkatan 1-5 and active-subject guards above, so the tile of a subject equals the
 * total of its list (D11, D91). It does not use SPM_SERVABLE_SQL (T4/T5 only) nor the pupil `/spm/databank` lane.
 *
 * Speed (UAT, 457 thousand questions: overview 40 s, list 35 s): the servable set is read ONCE per question event (or 5 minutes) as a
 * snapshot of three flat arrays (1.8 s, stale-while-revalidate, warmed at boot); the tiles, the unit totals and the page order are then
 * computed in memory from it, so no request scans the bank. Only the page's own rows (members, options, stimuli) are read from the database,
 * with the same servable predicate, so a question that stopped being servable since the snapshot drops out of its page. A search asks the
 * database only for the ids whose stem matches, then keeps the ones in the snapshot: the same units and counts as the old per-request
 * aggregate, which the specs compare.
 */
@Injectable()
export class DatabankService {
  private readonly units = new WeakMap<DatabankSnapshot, Map<string, UnitList>>()

  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionsRepository) private readonly bank: QuestionsRepository,
    @Optional() @Inject(OverviewCache) private readonly cache?: OverviewCache,
  ) {}

  /** FROM + WHERE of the servable set (aliases `q`, `v`). */
  private servable(): { from: Prisma.Sql; where: Prisma.Sql } {
    // S6-T16 / DM-42: add the `visibility = 'bank'` condition here once personal questions exist.
    const scope = this.bank.scopeSql({ status: 'approved', active: true, wholeGroups: true }, true)
    return { from: scope.from, where: Prisma.sql`${scope.where} AND ${TINGKATAN_1_5_SQL} AND ${ACTIVE_SUBJECT_SQL}` }
  }

  /** The servable set as three flat arrays, newest question first. */
  async loadSnapshot(): Promise<DatabankSnapshot> {
    const { from, where } = this.servable()
    const rows = await this.prisma.client.$queryRaw<{ ids: number[] | null; groups: number[] | null; subjects: number[] | null }[]>(Prisma.sql`
      SELECT array_agg(t.id ORDER BY t.id DESC) AS ids, array_agg(t.gid ORDER BY t.id DESC) AS groups, array_agg(t.sid ORDER BY t.id DESC) AS subjects
        FROM (SELECT q.id::float8 AS id, COALESCE(q.group_id, 0)::float8 AS gid, COALESCE(v.subject_id, 0)::float8 AS sid ${from} WHERE ${where}) t`)
    const r = rows[0]
    return { ids: r?.ids ?? [], groups: r?.groups ?? [], subjects: r?.subjects ?? [] }
  }

  private async snapshot(): Promise<DatabankSnapshot> {
    if (!this.cache) return this.loadSnapshot()
    return (await this.cache.get(() => this.loadSnapshot(), DATABANK_SNAPSHOT_SCOPE)).value
  }

  /** Fills the snapshot (the boot warm-up). */
  async warm(): Promise<void> {
    await this.snapshot()
  }

  async overview(): Promise<DatabankOverview> {
    const snap = await this.snapshot()
    const perSubject = new Map<number, number>()
    for (const s of snap.subjects) perSubject.set(s, (perSubject.get(s) ?? 0) + 1)
    const rows = await this.prisma.client.$queryRaw<{ id: bigint; name: string; name_en: string; is_core: boolean }[]>(Prisma.sql`
      SELECT s.id, s.name, s.name_en, s.is_core FROM subjects s WHERE s.is_active ORDER BY s.sort_order, s.name, s.id`)
    const tiles = rows.map((r) => ({ core: r.is_core, tile: { subjectId: idToString(r.id), nameMs: r.name, nameEn: r.name_en, count: perSubject.get(Number(r.id)) ?? 0 } satisfies SubjectTile }))
    return {
      totalQuestions: tiles.reduce((sum, t) => sum + t.tile.count, 0),
      activeSubjects: tiles.filter((t) => t.tile.count > 0).length,
      teras: tiles.filter((t) => t.core).map((t) => t.tile),
      elektif: tiles.filter((t) => !t.core).map((t) => t.tile),
    }
  }

  /**
   * The units of the snapshot (one subject or all), newest first: one per group (`-id`) or standalone question (`id`), with the number of servable
   * questions of the subject in it. With `hits` (a search) only the units that hold a matching question are kept; the members still count every question.
   */
  private unitsOf(snap: DatabankSnapshot, subject: number | null, hits: ReadonlySet<number> | null): UnitList {
    let memo: Map<string, UnitList> | null = null
    if (hits === null) {
      memo = this.units.get(snap) ?? new Map<string, UnitList>()
      this.units.set(snap, memo)
    }
    const memoKey = String(subject)
    const cached = memo?.get(memoKey)
    if (cached) return cached
    const position = new Map<number, number>()
    const keys: number[] = []
    const members: number[] = []
    const matched: boolean[] = []
    for (let i = 0; i < snap.ids.length; i++) {
      if (subject !== null && snap.subjects[i] !== subject) continue
      const id = snap.ids[i]!
      const gid = snap.groups[i]!
      const key = gid === 0 ? id : -gid
      let at = position.get(key)
      if (at === undefined) {
        at = keys.length
        position.set(key, at)
        keys.push(key)
        members.push(0)
        matched.push(false)
      }
      members[at] = members[at]! + 1
      if (hits?.has(id)) matched[at] = true
    }
    const kept = hits === null ? keys.map((_, i) => i) : keys.flatMap((_, i) => (matched[i] ? [i] : []))
    const out: UnitList = { keys: kept.map((i) => keys[i]!), members: kept.map((i) => members[i]!), totalQuestions: kept.reduce((n, i) => n + members[i]!, 0) }
    memo?.set(memoKey, out)
    return out
  }

  /** The ids (as numbers) of the live approved versions whose stem matches `search`, narrowed to a subject when asked (the snapshot keeps the servable ones). */
  private async hitsOf(search: string, subject: Prisma.Sql): Promise<Set<number>> {
    const rows = await this.prisma.client.$queryRaw<{ ids: number[] | null }[]>(Prisma.sql`
      SELECT array_agg(q.id::float8) AS ids FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
       WHERE v.status = 'approved' ${subject} AND (v.stem_ms ILIKE ${likePattern(search)} ESCAPE '\\' OR v.stem_en ILIKE ${likePattern(search)} ESCAPE '\\')`)
    return new Set(rows[0]?.ids ?? [])
  }

  async questions(rawQuery: Record<string, unknown>): Promise<DatabankPage> {
    const query: Query = parseStrict(DatabankQuestionsQuerySchema, rawQuery)
    const page = query.page ?? 1
    const search = query.q && query.q.length > 0 ? query.q : null
    const subjectKey = query.subjectId ? idFromString(query.subjectId) : null
    const subject = subjectKey === null ? null : Number(subjectKey)
    const [snap, hits] = await Promise.all([
      this.snapshot(),
      search === null ? Promise.resolve(null) : this.hitsOf(search, subjectKey === null ? Prisma.empty : Prisma.sql`AND v.subject_id = ${subjectKey}`),
    ])
    // One unit per group (`g<id>`) or standalone question (`q<id>`), newest first; a unit is listed when any member matches the search.
    const units = this.unitsOf(snap, subject, hits)
    const totalUnits = units.keys.length
    const totalQuestions = units.totalQuestions
    const meta = { ...listMeta(page, DATABANK_PAGE_SIZE, totalUnits), totalUnits, totalQuestions }
    if (totalUnits === 0 || (page - 1) * DATABANK_PAGE_SIZE >= totalUnits) return { data: [], meta }

    const keys = units.keys.slice((page - 1) * DATABANK_PAGE_SIZE, page * DATABANK_PAGE_SIZE).map(keyOf)
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
