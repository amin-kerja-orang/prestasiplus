import { Inject, Injectable, Logger } from '@nestjs/common'

import { ApiError } from '../../common/errors/api-error'
import { Prisma } from '../../db/generated/client'
import type { Prisma as PrismaTypes } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { PrismaService } from '../../db/prisma.service'
import { LEARNER_LEVEL_SQL, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, SPM_SERVABLE_SQL } from './learner-visibility'
import type { Prng } from '../../db/prng'
import { kbatOf, missingLeafSql } from './effective-leaf'
import { isQuestionStatus } from './status'
import { partsFromRows, type PartDraft, StoredKeyError } from './tree'
import type {
  AdminListFilter,
  GroupCountBy,
  GuruListFilter,
  Page,
  QuestionFilter,
  QuestionRecord,
  QuestionStatus,
  QuestionVersionRecord,
  SampleFilter,
  StimulusGroupRecord,
  StimulusRecord,
  StoreQuestionType,
  StoreSourceType,
  StructuredListFilter,
  ViewMode,
} from './types'

/** Columns of `question_versions` a writer may set (ids are bigint, the service already parsed them). */
export interface VersionDraft {
  status: QuestionStatus
  type: StoreQuestionType
  stemMs: string | null
  stemEn: string | null
  numberLabel: string | null
  language: QuestionVersionRecord['language']
  explanationMs: string | null
  explanationEn: string | null
  subjectId: bigint | null
  educationLevelId: bigint | null
  unitNodeId: bigint | null
  chapterId: bigint | null
  topicId: bigint | null
  formOrigin: QuestionVersionRecord['formOrigin']
  cognitiveLevel: number | null
  kbat: QuestionVersionRecord['kbat']
  tagReview: boolean
  catalogueVersion: string | null
  difficultyTp: number | null
  sourcePage: number | null
  setLabel: string | null
  /**
   * Source paper code; the paper builder reads the kertas from its trailing digit (`1449/2`, `MATH/2`).
   * `undefined` leaves the stored value untouched on a rewrite and stores null on a new version.
   */
  paperCode?: string | null
  spNodeIds: bigint[]
  stimulusIds: bigint[]
  parts: PartDraft[]
}

/** Kind and file of a stimulus (the stem image of a flat question is the first `image` stimulus with a file). */
export interface StimulusAsset {
  id: string
  kind: string
  assetFileId: string | null
}

/**
 * Provenance columns of the first version (BE-38 accept-to-Draf; `source_type` goes on the question, the rest on
 * `question_versions`). Every field is optional; ids are bigint.
 */
export interface VersionProvenance {
  sourceRegion?: unknown
  sourcePaperId?: bigint | null
  intakeItemId?: bigint | null
  sourceFileId?: bigint | null
  aiRunId?: bigint | null
  aiModel?: string | null
}

export interface NewQuestion {
  sourceType: StoreSourceType | null
  createdById: bigint | null
  groupId: bigint | null
  groupPosition: number | null
  /** BE-42: tags a PKSK question (the only way a `pksk_choice` part may be stored). */
  pksk?: { domainCode: string; level: 'T1' | 'T4' }
  /** Clock time: stamps created_at / updated_at (and published_at when created published). */
  now: Date
  version: VersionDraft
  provenance?: VersionProvenance
}

export interface NewStimulus {
  kind: 'passage' | 'image' | 'diagram' | 'table' | 'graph' | 'map' | 'infographic' | 'audio'
  label: string | null
  bodyMs: string | null
  bodyEn: string | null
  altText: string | null
  assetFileId: bigint | null
}

export interface NewGroup {
  label: string | null
  scope: 'section' | 'paper'
  stimulusIds: bigint[]
  optionBank: { label: string; bodyMs: string | null; bodyEn: string | null }[]
}

/** Facts of one question (latest version) the quality audit scores. */
export interface QualityRow {
  id: string
  stemMs: string | null
  stemEn: string | null
  explanationMs: string | null
  explanationEn: string | null
  sourceType: string | null
  subjectId: string | null
  educationLevelId: string | null
  setLabel: string | null
  hasSp: boolean
}

export interface IdPage {
  ids: string[]
  total: number
  counts: Record<QuestionStatus, number>
}

type VersionRow = PrismaTypes.QuestionVersionGetPayload<{
  include: { parts: { include: { options: true; key: true } }; spNodes: true; stimuli: { include: { stimulus: true } } }
}>

/**
 * BE-42: PKSK questions (tag `pksk_domain`) belong to M07. The M04 lists, counts, sources and writes below never see them;
 * only the `pksk*` methods and `scope: 'only'` reads do.
 */
const PKSK_TAG = 'pksk_domain'
const NOT_PKSK = NOT_PKSK_SQL
const IS_PKSK = Prisma.sql`EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

/** Most ids `eligibleIds` returns (it throws beyond it) and the cap of one keyset page. */
export const ELIGIBLE_IDS_MAX = 5000
/** Largest draw one `sampleIds` call returns (a guard; real draws are tens of ids). */
const SAMPLE_MAX = 50_000
/** Ids per `eligibleAmong` statement (one bind parameter array, chunked only for very long lists). */
const AMONG_CHUNK = 5000

/**
 * SQL of the shape filters (`QuestionFilter.mcqShape`, `singleMcqLeaf`): a version-id array computed ONCE, set-based, over the
 * candidates the cheap conditions kept (`candidates` is a full `SELECT v.id AS vid ...` statement). Per-row shape predicates
 * (EXISTS or scalar sub-selects) are flattened by the planner into a semi join over a cross product (measured at 12k rows: 5-17 s
 * as a WHERE predicate, 7 s as a fenced IN); `= ANY(ARRAY(subquery))` is an uncorrelated InitPlan the planner cannot flatten
 * (0.12 s at the same size). The MATERIALIZED CTE keeps the candidate set small before the grouped joins.
 */
function shapeArraySql(candidates: Prisma.Sql, shape: QuestionFilter['mcqShape'], single: boolean): Prisma.Sql {
  const having: Prisma.Sql[] = []
  if (shape) {
    having.push(
      Prisma.sql`count(DISTINCT sp.id) = 1 AND bool_and(sp.mode = 'mcq' AND sp.stimulus_id IS NULL)
        AND count(DISTINCT so.id) BETWEEN ${Math.trunc(shape.minOptions)} AND ${Math.trunc(shape.maxOptions)}
        AND count(so.image_file_id) = 0
        AND coalesce(bool_or(so.label = sk.content ->> 'correct'), false)
        AND NOT EXISTS (SELECT 1 FROM question_version_stimuli sv WHERE sv.question_version_id = sp.question_version_id)`,
    )
  }
  if (single) having.push(Prisma.sql`count(DISTINCT sp.id) = 1 AND bool_and(sp.mode = 'mcq')`)
  const joins = shape ? Prisma.sql`LEFT JOIN part_options so ON so.part_id = sp.id LEFT JOIN answer_keys sk ON sk.part_id = sp.id` : Prisma.empty
  return Prisma.sql`ARRAY(WITH c AS MATERIALIZED (${candidates})
    SELECT sp.question_version_id FROM question_parts sp JOIN c ON c.vid = sp.question_version_id ${joins}
    GROUP BY sp.question_version_id HAVING ${Prisma.join(having, ' AND ')})`
}

const NO_STATUS_COUNTS = (): Record<QuestionStatus, number> => ({ draft: 0, review: 0, approved: 0, archived: 0 })

/** `bigint` of a decimal id, or null when the text is not a canonical id (such an id never exists). */
function bi(text: string): bigint | null {
  try {
    return idFromString(text)
  } catch {
    return null
  }
}

/** The PKSK tags of a question (`pksk_domain` code and `pksk_level`), or null when it carries no domain tag. */
function pkskOf(tags: readonly { kind: string; code: string }[]): { domainCode: string; level: 'T1' | 'T4' } | null {
  const domain = tags.find((t) => t.kind === 'pksk_domain')
  const level = tags.find((t) => t.kind === 'pksk_level')
  return domain && (level?.code === 'T1' || level?.code === 'T4') ? { domainCode: domain.code, level: level.code } : null
}

const likePattern = (s: string): string => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

/**
 * The only doorway to the question tables (ADR-0014, data model G-12). Other cards (BE-12 practice,
 * BE-15, BE-18, BE-41 Bijak, BE-10 reports) call the read methods; they never query these tables.
 * Ids are decimal strings. `view` picks the version: `live` (the published version, what practice
 * serves; a question without one is absent) or `latest` (what the admin edits).
 *
 * Reads that filter use parameterised SQL joined on the version the view selects. Every method uses
 * `prisma.client`, so it joins the transaction a service opened with `prisma.transaction(...)`.
 */
@Injectable()
export class QuestionsRepository {
  private readonly logger = new Logger(QuestionsRepository.name)

  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client
  }

  // --- reads for other modules ----------------------------------------------------------------------

  async get(id: string, view: ViewMode = 'live'): Promise<QuestionRecord | null> {
    const [row] = await this.getMany([id], view)
    return row ?? null
  }

  /** `scope`: M04 reads never return a PKSK question (default `exclude`); the PKSK service reads them with `only`. */
  async getMany(ids: readonly string[], view: ViewMode = 'live', scope: 'exclude' | 'only' = 'exclude'): Promise<QuestionRecord[]> {
    const wanted = [...new Set(ids)].map(bi).filter((v): v is bigint => v !== null)
    if (wanted.length === 0) return []
    const records = await this.hydrate(wanted, view, scope)
    const byId = new Map(records.map((r) => [r.id, r]))
    return [...new Set(ids)].flatMap((id) => {
      const r = byId.get(id)
      return r ? [r] : []
    })
  }

  /**
   * Exact versions, whatever their status or the question's `is_active` (a pinned read: practice grades a
   * served version even after a later edit, BE-12 AC 11 / OD-28). Unknown ids or version numbers are
   * absent. Returned in ascending id, then version order.
   *
   * Pinned grading only: never use it on a serving path (a draw, a list, a learner-facing read). It skips the
   * active, published and PKSK scope that `sample` / `eligibleIds` / `getMany('live')` apply.
   */
  async getVersions(refs: readonly { questionId: string; versionNo: number }[]): Promise<QuestionRecord[]> {
    const wanted = new Map<string, { id: bigint; versionNo: number }>()
    for (const r of refs) {
      const id = bi(r.questionId)
      if (id === null || !Number.isSafeInteger(r.versionNo) || r.versionNo < 1) continue
      wanted.set(`${id}:${r.versionNo}`, { id, versionNo: r.versionNo })
    }
    if (wanted.size === 0) return []
    return this.hydrateVersions([...wanted.values()])
  }

  async count(filter: QuestionFilter = {}): Promise<number> {
    const { from, where } = this.scope(filter)
    const rows = await this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`
    return rows[0]?.n ?? 0
  }

  async groupCount(by: GroupCountBy, filter: QuestionFilter = {}): Promise<Map<string, number>> {
    const column = { subject: 'v.subject_id', level: 'v.education_level_id', status: 'v.status', difficultyTp: 'v.difficulty_tp', unit: 'v.unit_node_id', chapter: 'v.chapter_id' }[by]
    const { from, where } = this.scope(filter)
    const rows = await this.db.$queryRaw<{ k: bigint | string | number | null; n: number }[]>`
      SELECT ${Prisma.raw(column)} AS k, count(*)::int AS n ${from} WHERE ${where} GROUP BY 1`
    const out = new Map<string, number>()
    for (const r of rows) if (r.k !== null) out.set(String(r.k), r.n)
    return out
  }

  /** Eligible-style counts grouped by (level, TP) in ONE statement: the SPM pool splits. `filter` is used as given. */
  async groupCountsByLevelTp(filter: QuestionFilter = {}): Promise<{ levelId: string | null; tp: number | null; n: number }[]> {
    const { from, where } = this.scope(filter)
    const rows = await this.db.$queryRaw<{ level_id: bigint | null; tp: number | null; n: number }[]>`
      SELECT v.education_level_id AS level_id, v.difficulty_tp AS tp, count(*)::int AS n ${from} WHERE ${where} GROUP BY 1, 2`
    return rows.map((r) => ({ levelId: r.level_id === null ? null : idToString(r.level_id), tp: r.tp, n: r.n }))
  }

  /**
   * Keyset page over the LATEST version (any status, no PKSK), ids ascending after `after`, with only the facts the quality
   * audit scores. No totals, no OFFSET, no hydration of parts: one bounded statement per batch.
   */
  async qualityBatch(after: string | undefined, limit: number): Promise<QualityRow[]> {
    const key = after === undefined ? null : bi(after)
    if (after !== undefined && key === null) return []
    const size = Math.max(1, Math.min(Math.floor(limit), 2000))
    const rows = await this.db.$queryRaw<
      {
        id: bigint
        stem_ms: string | null
        stem_en: string | null
        explanation_ms: string | null
        explanation_en: string | null
        source_type: string | null
        subject_id: bigint | null
        education_level_id: bigint | null
        set_label: string | null
        has_sp: boolean
      }[]
    >`
      SELECT q.id, v.stem_ms, v.stem_en, v.explanation_ms, v.explanation_en, q.source_type, v.subject_id, v.education_level_id, v.set_label,
             EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id) AS has_sp
        FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
       WHERE ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL} ${key === null ? Prisma.empty : Prisma.sql`AND q.id > ${key}`}
       ORDER BY q.id ASC LIMIT ${size}`
    return rows.map((r) => ({
      id: idToString(r.id),
      stemMs: r.stem_ms,
      stemEn: r.stem_en,
      explanationMs: r.explanation_ms,
      explanationEn: r.explanation_en,
      sourceType: r.source_type,
      subjectId: r.subject_id === null ? null : idToString(r.subject_id),
      educationLevelId: r.education_level_id === null ? null : idToString(r.education_level_id),
      setLabel: r.set_label,
      hasSp: r.has_sp,
    }))
  }

  /** `listIds` without the totals and status counts: one page (newest first) of the admin filter, by keyset (`idBelow`). */
  async listIdsKeyset(filter: Omit<AdminListFilter, 'page' | 'pageSize'>, idBelow: string | undefined, limit: number): Promise<string[]> {
    const conds = this.adminConds({ ...filter, page: 1, pageSize: limit })
    const below = idBelow === undefined ? undefined : bi(idBelow)
    if (idBelow !== undefined) conds.push(below === null || below === undefined ? Prisma.sql`FALSE` : Prisma.sql`q.id < ${below}`)
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${Prisma.join(conds, ' AND ')} ORDER BY q.id DESC LIMIT ${Math.max(1, limit)}`
    return rows.map((r) => idToString(r.id))
  }

  async eligibleForPractice(id: string): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ ok: boolean }[]>`
      SELECT true AS ok FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
      WHERE q.id = ${key} AND q.is_active AND v.status = 'approved' AND ${NOT_PKSK}`
    return rows.length > 0
  }

  /**
   * Ids of the live-published, active questions of `filter`, ascending. Bounded: it reads at most `ELIGIBLE_IDS_MAX` ids and
   * THROWS when the filter matches more (never a silent truncation). Meant for small domains (a chapter, a tracking set,
   * a test fixture). A draw uses `sampleIds` / `sample`, a membership check `eligibleAmong`, a full walk `eligibleIdsPage`.
   */
  async eligibleIds(filter: QuestionFilter = {}): Promise<string[]> {
    const { from, where } = this.scope({ ...filter, status: 'approved', active: true }, true)
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id ASC LIMIT ${ELIGIBLE_IDS_MAX + 1}`
    if (rows.length > ELIGIBLE_IDS_MAX) {
      throw new Error(`eligibleIds matched more than ${String(ELIGIBLE_IDS_MAX)} questions: use sampleIds, eligibleAmong or eligibleIdsPage`)
    }
    return rows.map((r) => idToString(r.id))
  }

  /** One keyset page of eligible ids, ascending; pass the last id of the previous page as `after`. */
  async eligibleIdsPage(filter: QuestionFilter, after: string | undefined, limit: number): Promise<string[]> {
    const size = Math.max(1, Math.min(Math.floor(limit), ELIGIBLE_IDS_MAX))
    const { mcqShape, singleMcqLeaf, ...plain } = filter
    const page = async (cursor: string | undefined, rows: number): Promise<string[]> => {
      const { from, where } = this.scope({ ...plain, status: 'approved', active: true, ...(cursor === undefined ? {} : { idAfter: cursor }) }, true)
      const r = await this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id ASC LIMIT ${rows}`
      return r.map((x) => idToString(x.id))
    }
    if (!mcqShape && !singleMcqLeaf) return page(after, size)
    // Shaped: read a keyset page of candidates, keep those that pass the shape (checked on that page only), continue after the
    // last candidate until `size` pass or the candidates run out. Each step touches O(size) rows, never the whole chapter.
    const out: string[] = []
    let cursor = after
    for (;;) {
      const candidates = await page(cursor, Math.min(size * 3, ELIGIBLE_IDS_MAX))
      if (candidates.length === 0) break
      const passing = new Set(await this.eligibleAmong(candidates, { ...plain, ...(mcqShape ? { mcqShape } : {}), ...(singleMcqLeaf ? { singleMcqLeaf } : {}) }))
      for (const id of candidates) {
        if (passing.has(id)) {
          out.push(id)
          if (out.length >= size) return out
        }
      }
      cursor = candidates[candidates.length - 1]
      if (candidates.length < Math.min(size * 3, ELIGIBLE_IDS_MAX)) break
    }
    return out
  }

  /** The ids among `ids` that are eligible for `filter` (published, active, live), ascending. One query, no scan of the bank. */
  async eligibleAmong(ids: readonly string[], filter: QuestionFilter = {}): Promise<string[]> {
    const wanted = [...new Set(ids)]
    const out: string[] = []
    for (let i = 0; i < wanted.length; i += AMONG_CHUNK) {
      const { from, where } = this.scope({ ...filter, status: 'approved', active: true, idIn: wanted.slice(i, i + AMONG_CHUNK) }, true)
      const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id ASC`
      out.push(...rows.map((r) => idToString(r.id)))
    }
    return out
  }

  /**
   * Up to `n` eligible ids drawn in SQL: ordered by `hashtextextended(id, seed)` (then id) with a LIMIT, so memory and rows
   * returned stay O(n). Deterministic for a seed (same seed, same ids; a larger `n` keeps the smaller draw as its prefix).
   *
   * With `mcqShape` or `singleMcqLeaf` the draw is BEST EFFORT: the per-row shape check runs only on a hash-ordered window of
   * the candidates (3n, then 12n, then 48n, capped at 50,000 rows) and the result may be SHORTER than `n` when too few of the
   * window pass (callers treat a short draw as "not enough questions"). It never scans the whole subject with that check.
   */
  async sampleIds(filter: SampleFilter, n: number, seed: number): Promise<string[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    const limit = Math.min(n, SAMPLE_MAX)
    const { mcqShape, singleMcqLeaf, ...plain } = filter
    const { from, where } = this.scope({ ...plain, status: 'approved', active: true }, true)
    const key = Math.trunc(seed)
    if (!mcqShape && !singleMcqLeaf) {
      const rows = await this.db.$queryRaw<{ id: bigint }[]>`
        SELECT q.id ${from} WHERE ${where} ORDER BY hashtextextended(q.id::text, ${key}::bigint), q.id LIMIT ${limit}`
      return rows.map((r) => idToString(r.id))
    }
    // The shape check is per row (sub-selects): run it on a hash-ordered window only, and widen x4 while the window falls short
    // and the window was full (a short window means the eligible set is exhausted: widening cannot help).
    let window = Math.min(limit * 3, SAMPLE_MAX)
    let out: string[] = []
    for (let round = 0; round < 3; round++) {
      const rows = await this.db.$queryRaw<{ id: bigint }[]>`
        SELECT q.id ${from} WHERE ${where} ORDER BY hashtextextended(q.id::text, ${key}::bigint), q.id LIMIT ${window}`
      const candidates = rows.map((r) => idToString(r.id))
      const passing = new Set(await this.eligibleAmong(candidates, { ...plain, ...(mcqShape ? { mcqShape } : {}), ...(singleMcqLeaf ? { singleMcqLeaf } : {}) }))
      out = candidates.filter((id) => passing.has(id)).slice(0, limit)
      if (out.length >= limit || candidates.length < window || window >= SAMPLE_MAX) break
      window = Math.min(window * 4, SAMPLE_MAX)
    }
    return out
  }

  /** `sampleIds` with the seed taken from one draw of `rng` (never Math.random). */
  async sample(filter: SampleFilter, n: number, rng: Prng): Promise<string[]> {
    if (!Number.isSafeInteger(n) || n <= 0) return []
    return this.sampleIds(filter, n, rng.int(0, 0xffffffff))
  }

  async deactivate(id: string): Promise<boolean> {
    return this.setActive(id, false)
  }

  async reactivate(id: string): Promise<boolean> {
    return this.setActive(id, true)
  }

  private async setActive(id: string, isActive: boolean): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    const res = await this.db.question.updateMany({ where: { id: key, tags: { none: { kind: PKSK_TAG } } }, data: { isActive } })
    return res.count > 0
  }

  async groupOf(questionId: string): Promise<StimulusGroupRecord | null> {
    const key = bi(questionId)
    if (key === null) return null
    const q = await this.db.question.findUnique({ where: { id: key }, select: { groupId: true } })
    if (!q?.groupId) return null
    return (await this.groupsByIds([idToString(q.groupId)]))[0] ?? null
  }

  /** Stimulus groups by id, in one statement per relation whatever the number of ids (unknown ids are absent). */
  async groupsByIds(groupIds: readonly string[]): Promise<StimulusGroupRecord[]> {
    const keys = [...new Set(groupIds)].flatMap((id) => {
      const k = bi(id)
      return k === null ? [] : [k]
    })
    if (keys.length === 0) return []
    const groups = await this.db.stimulusGroup.findMany({
      where: { id: { in: keys } },
      orderBy: { id: 'asc' },
      include: {
        stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } },
        options: { orderBy: { position: 'asc' } },
        questions: { orderBy: { groupPosition: 'asc' }, select: { id: true } },
      },
    })
    return groups.map((group) => {
      const stimuli: StimulusRecord[] = group.stimuli
        .filter((s) => s.stimulus.kind !== 'audio')
        .map((s) => ({
          id: idToString(s.stimulus.id),
          kind: s.stimulus.kind === 'passage' ? 'passage' : s.stimulus.kind === 'table' ? 'table' : 'diagram',
          label: s.stimulus.label ?? '',
          bodyMs: s.stimulus.bodyMs,
          bodyEn: s.stimulus.bodyEn,
          assetFileId: s.stimulus.assetFileId === null ? null : idToString(s.stimulus.assetFileId),
          alt: s.stimulus.altText,
        }))
      return {
        id: idToString(group.id),
        stimuli,
        optionBank: group.options.map((o) => ({ label: o.label, bodyMs: o.bodyMs, bodyEn: o.bodyEn })),
        questionIds: group.questions.map((m) => idToString(m.id)),
      }
    })
  }

  async listOwn(filter: GuruListFilter): Promise<Page<QuestionRecord>> {
    const owner = bi(filter.ownerId)
    if (owner === null) return { rows: [], page: filter.page, pageSize: filter.pageSize, total: 0 }
    // One raw filter for rows and total (no primary-level question, before pagination): the page and `total` always agree.
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const where = Prisma.sql`q.created_by_id = ${owner} AND ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL}`
    const offset = (filter.page - 1) * filter.pageSize
    const [totals, ids] = await Promise.all([
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`,
      this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id ASC LIMIT ${filter.pageSize} OFFSET ${offset}`,
    ])
    const total = totals[0]?.n ?? 0
    const records = await this.hydrate(ids.map((r) => r.id), 'latest')
    return { rows: records, page: filter.page, pageSize: filter.pageSize, total }
  }

  // --- reads for the service (admin, structured, counts) ------------------------------------------

  /** Admin list over the LATEST version: ids of one page (newest first), the total and `counts` per status. */
  async listIds(filter: AdminListFilter): Promise<IdPage> {
    const base = this.adminConds({ ...filter, status: undefined })
    const withStatus = filter.status ? [...base, Prisma.sql`v.status = ${filter.status}`] : base
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const whereAll = Prisma.join(withStatus, ' AND ')
    const whereBase = Prisma.join(base, ' AND ')
    const below = filter.idBelow === undefined ? null : bi(filter.idBelow)
    const pageWhere = filter.idBelow === undefined ? whereAll : Prisma.sql`${whereAll} AND ${below === null ? Prisma.sql`FALSE` : Prisma.sql`q.id < ${below}`}`
    const offset = filter.idBelow === undefined ? (filter.page - 1) * filter.pageSize : 0
    const [rows, totals, counted] = await Promise.all([
      this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${pageWhere} ORDER BY q.id DESC LIMIT ${filter.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${whereAll}`,
      this.db.$queryRaw<{ status: string; n: number }[]>`SELECT v.status AS status, count(*)::int AS n ${from} WHERE ${whereBase} GROUP BY 1`,
    ])
    const counts = NO_STATUS_COUNTS()
    for (const c of counted) if (isQuestionStatus(c.status)) counts[c.status] = c.n
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0, counts }
  }

  private adminConds(f: AdminListFilter): Prisma.Sql[] {
    const conds: Prisma.Sql[] = [NOT_PKSK, NOT_PRIMARY_LEVEL_SQL]
    const id = (text: string | undefined, column: Prisma.Sql): void => {
      if (text === undefined) return
      const key = bi(text)
      conds.push(key === null ? Prisma.sql`FALSE` : Prisma.sql`${column} = ${key}`)
    }
    id(f.subjectId, Prisma.sql`v.subject_id`)
    id(f.educationLevelId, Prisma.sql`v.education_level_id`)
    if (f.difficultyLevel !== undefined) {
      const n = /^[1-5]$/.test(f.difficultyLevel) ? Number(f.difficultyLevel) : null
      // Level 5 includes TP 6 (the flat wire clamps 6 to 5).
      conds.push(n === null ? Prisma.sql`FALSE` : n === 5 ? Prisma.sql`v.difficulty_tp >= 5` : Prisma.sql`v.difficulty_tp = ${n}`)
    }
    if (f.status) conds.push(Prisma.sql`v.status = ${f.status}`)
    if (f.dskpFilter !== undefined) {
      const tagged = Prisma.sql`EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id)`
      conds.push(f.dskpFilter === 'tagged' ? tagged : f.dskpFilter === 'untagged' ? Prisma.sql`NOT ${tagged}` : Prisma.sql`FALSE`)
    }
    if (f.tagReview) conds.push(Prisma.sql`v.tag_review`)
    if (f.missing !== undefined) conds.push(missingLeafSql(f.missing))
    if (f.complianceFilter !== undefined) {
      const c = f.complianceFilter
      conds.push(
        c === 'verified'
          ? Prisma.sql`q.live_version_no = v.version_no AND v.status = 'approved'`
          : c === 'draft'
            ? Prisma.sql`v.status <> 'approved'`
            : c === 'missing_source'
              ? Prisma.sql`v.source_file_id IS NULL`
              : c === 'verified_generated'
                ? Prisma.sql`q.source_type = 'ai_variant' AND v.status = 'approved'`
                : Prisma.sql`FALSE`,
      )
    }
    if (f.sourceFilter !== undefined) {
      // The v2 store has no textbook / dskp / trial / marking_scheme source: only ai_generated exists on the wire.
      conds.push(f.sourceFilter === 'ai_generated' ? Prisma.sql`q.source_type = 'ai_variant'` : Prisma.sql`FALSE`)
    }
    if (f.search !== undefined && f.search.trim() !== '') {
      const like = likePattern(f.search.trim())
      conds.push(Prisma.sql`(v.stem_ms ILIKE ${like} ESCAPE '\\' OR v.stem_en ILIKE ${like} ESCAPE '\\')`)
    }
    return conds
  }

  /** Structured questions (type `structured`) over the latest version, id ascending. */
  async structuredIds(filter: StructuredListFilter): Promise<{ ids: string[]; total: number }> {
    const conds: Prisma.Sql[] = [Prisma.sql`v.type = 'structured'`, NOT_PKSK, NOT_PRIMARY_LEVEL_SQL]
    for (const [text, column] of [
      [filter.subjectId, Prisma.sql`v.subject_id`],
      [filter.educationLevelId, Prisma.sql`v.education_level_id`],
    ] as const) {
      if (text === undefined) continue
      const key = bi(text)
      conds.push(key === null ? Prisma.sql`FALSE` : Prisma.sql`${column} = ${key}`)
    }
    if (filter.kbatLevel !== undefined) {
      // kbatLevel = cognitive_level when it is 4 or more, otherwise 0 (Q-12e).
      const n = /^\d$/.test(filter.kbatLevel) ? Number(filter.kbatLevel) : null
      conds.push(
        n === null
          ? Prisma.sql`FALSE`
          : n === 0
            ? Prisma.sql`(v.cognitive_level IS NULL OR v.cognitive_level < 4)`
            : Prisma.sql`v.cognitive_level = ${n}`,
      )
    }
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const where = Prisma.join(conds, ' AND ')
    const offset = (filter.page - 1) * filter.pageSize
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.id ASC LIMIT ${filter.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`,
    ])
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0 }
  }

  /** Whole-store figures of the structured list `meta.stats`: per subject id (decimal) and live count. */
  async structuredStats(): Promise<{ total: number; published: number; bySubject: Map<string, number> }> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; total: number; published: number }[]>`
      SELECT v.subject_id, count(*)::int AS total, count(q.live_version_no)::int AS published
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      WHERE v.type = 'structured' AND ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL} GROUP BY 1`
    const bySubject = new Map<string, number>()
    let total = 0
    let published = 0
    for (const r of rows) {
      total += r.total
      published += r.published
      if (r.subject_id !== null) bySubject.set(idToString(r.subject_id), r.total)
    }
    return { total, published, bySubject }
  }

  /** Per subject: questions (latest version) and those with a live version, plus the store total. */
  async subjectTotals(): Promise<{ total: number; bySubject: Map<string, { total: number; published: number }> }> {
    const rows = await this.db.$queryRaw<{ subject_id: bigint | null; total: number; published: number }[]>`
      SELECT v.subject_id, count(*)::int AS total, count(q.live_version_no)::int AS published
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no WHERE ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL} GROUP BY 1`
    const bySubject = new Map<string, { total: number; published: number }>()
    let total = 0
    for (const r of rows) {
      total += r.total
      if (r.subject_id !== null) bySubject.set(idToString(r.subject_id), { total: r.total, published: r.published })
    }
    return { total, bySubject }
  }

  /** Counts of one owner questions per latest-version status. */
  async ownerStatusCounts(ownerId: string): Promise<Record<QuestionStatus, number>> {
    const counts = NO_STATUS_COUNTS()
    const owner = bi(ownerId)
    if (owner === null) return counts
    const rows = await this.db.$queryRaw<{ status: string; n: number }[]>`
      SELECT v.status AS status, count(*)::int AS n
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      WHERE q.created_by_id = ${owner} AND ${NOT_PKSK} AND ${NOT_PRIMARY_LEVEL_SQL} GROUP BY 1`
    for (const r of rows) if (isQuestionStatus(r.status)) counts[r.status] = r.n
    return counts
  }

  /** The owner of a question (decimal id) or `undefined` when the question does not exist. */
  async ownerOf(id: string): Promise<string | null | undefined> {
    const key = bi(id)
    if (key === null) return undefined
    const row = await this.db.question.findFirst({ where: { id: key, tags: { none: { kind: PKSK_TAG } } }, select: { createdById: true } })
    if (!row) return undefined
    return row.createdById === null ? null : idToString(row.createdById)
  }

  async stimuliExist(ids: readonly string[]): Promise<boolean> {
    const keys = ids.map(bi)
    if (keys.some((k) => k === null)) return false
    const unique = [...new Set(keys as bigint[])]
    return (await this.db.stimulus.count({ where: { id: { in: unique } } })) === unique.length
  }

  /** Kind and file of the given stimuli (unknown ids are absent). */
  async stimulusAssets(ids: readonly string[]): Promise<StimulusAsset[]> {
    const keys = ids.map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return []
    const rows = await this.db.stimulus.findMany({ where: { id: { in: keys } }, select: { id: true, kind: true, assetFileId: true } })
    return rows.map((r) => ({ id: idToString(r.id), kind: r.kind, assetFileId: r.assetFileId === null ? null : idToString(r.assetFileId) }))
  }

  async groupExists(id: string): Promise<boolean> {
    const key = bi(id)
    return key !== null && (await this.db.stimulusGroup.count({ where: { id: key } })) > 0
  }

  // --- writes (always inside one service transaction) ------------------------------------------------

  /** Row lock so two status changes of one question serialise. Returns false when the id is unknown. */
  async lock(id: string): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM questions WHERE id = ${key} FOR UPDATE`
    return rows.length > 0
  }

  async create(input: NewQuestion): Promise<string> {
    const q = await this.db.question.create({
      data: {
        sourceType: input.sourceType,
        createdById: input.createdById,
        groupId: input.groupId,
        groupPosition: input.groupPosition,
        latestVersionNo: 1,
        liveVersionNo: input.version.status === 'approved' ? 1 : null,
        createdAt: input.now,
        updatedAt: input.now,
        ...(input.pksk
          ? {
              tags: {
                create: [
                  ...(input.pksk ? [{ kind: 'pksk_domain', code: input.pksk.domainCode }, { kind: 'pksk_level', code: input.pksk.level }] : []),
                ],
              },
            }
          : {}),
      },
    })
    await this.insertVersion(q.id, 1, input.version, input.now, input.version.status === 'approved' ? input.now : null, input.provenance)
    return idToString(q.id)
  }

  /** Adds version `versionNo` (the new latest) to an existing question. */
  async addVersion(questionId: string, versionNo: number, draft: VersionDraft, now: Date): Promise<void> {
    const id = bi(questionId)
    if (id === null) return
    await this.insertVersion(id, versionNo, draft, now, null)
    await this.db.question.update({ where: { id }, data: { latestVersionNo: versionNo, updatedAt: now } })
  }

  /** Replaces the content of an existing (non-live) version: fields, SP nodes, stimuli and the whole part tree. */
  async rewriteVersion(questionId: string, versionNo: number, draft: VersionDraft, now: Date): Promise<void> {
    const id = bi(questionId)
    if (id === null) return
    const existing = await this.db.questionVersion.findUnique({ where: { questionId_versionNo: { questionId: id, versionNo } }, select: { id: true } })
    if (!existing) return
    await this.db.questionPart.deleteMany({ where: { questionVersionId: existing.id } })
    await this.db.questionVersionSpNode.deleteMany({ where: { questionVersionId: existing.id } })
    await this.db.questionVersionStimulus.deleteMany({ where: { questionVersionId: existing.id } })
    const { parts, spNodeIds, stimulusIds, ...columns } = draft
    await this.db.questionVersion.update({ where: { id: existing.id }, data: { ...this.versionColumns(columns), updatedAt: now } })
    await this.db.question.update({ where: { id }, data: { updatedAt: now } })
    await this.insertChildren(existing.id, spNodeIds, stimulusIds, parts)
  }

  /** Sets the status columns of one version (publishing stamps `publishedAt`; archiving may carry a reason). */
  async setVersionStatus(
    questionId: string,
    versionNo: number,
    status: QuestionStatus,
    extra: { archiveReason?: 'superseded' | 'withdrawn' | 'source_takedown' | null; publishedAt?: Date | null } = {},
  ): Promise<void> {
    const id = bi(questionId)
    if (id === null) return
    await this.db.questionVersion.update({
      where: { questionId_versionNo: { questionId: id, versionNo } },
      data: {
        status,
        archiveReason: status === 'archived' ? (extra.archiveReason ?? null) : null,
        ...(extra.publishedAt === undefined ? {} : { publishedAt: extra.publishedAt }),
      },
    })
  }

  /** Moves a question to another stimulus group (or out of any group). */
  async setGroup(questionId: string, groupId: string | null, position: number | null): Promise<void> {
    const id = bi(questionId)
    if (id === null) return
    await this.db.question.update({ where: { id }, data: { groupId: groupId === null ? null : bi(groupId), groupPosition: position } })
  }

  /** Writes `live_version_no` (the one writer is the service, inside the transaction that changes a status). */
  async setLiveVersion(questionId: string, versionNo: number | null): Promise<void> {
    const id = bi(questionId)
    if (id === null) return
    await this.db.question.update({ where: { id }, data: { liveVersionNo: versionNo } })
  }

  /** Cascades to versions, parts, options, keys, tags and SP nodes. True when a row was deleted. */
  async remove(id: string): Promise<boolean> {
    const key = bi(id)
    if (key === null) return false
    const res = await this.db.question.deleteMany({ where: { id: key, tags: { none: { kind: PKSK_TAG } } } })
    return res.count > 0
  }

  async createStimulus(input: NewStimulus): Promise<string> {
    const row = await this.db.stimulus.create({
      data: { kind: input.kind, label: input.label, bodyMs: input.bodyMs, bodyEn: input.bodyEn, altText: input.altText, assetFileId: input.assetFileId },
    })
    return idToString(row.id)
  }

  async createGroup(input: NewGroup): Promise<string> {
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

  /** The next free `group_position` (1-based) in a group. */
  async nextGroupPosition(groupId: string): Promise<number> {
    const key = bi(groupId)
    if (key === null) return 1
    const agg = await this.db.question.aggregate({ where: { groupId: key }, _max: { groupPosition: true } })
    return (agg._max.groupPosition ?? 0) + 1
  }

  // --- PKSK (BE-42, M07): questions tagged `pksk_domain` + `pksk_level` -------------------------------

  /** Which of these ids are PKSK questions (subset, same strings). */
  async pkskIds(ids: readonly string[]): Promise<string[]> {
    const keys = [...new Set(ids)].map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return []
    const rows = await this.db.questionTag.findMany({ where: { questionId: { in: keys }, kind: PKSK_TAG }, select: { questionId: true } })
    return rows.map((r) => idToString(r.questionId))
  }

  /** One page of PKSK question ids over the LATEST version: `created_at` descending, then id ascending. */
  async pkskPage(f: {
    domainCodes?: readonly string[]
    level?: 'T1' | 'T4'
    versionStatuses?: readonly QuestionStatus[]
    search?: string
    page: number
    pageSize: number
  }): Promise<{ ids: string[]; total: number }> {
    const conds: Prisma.Sql[] = [IS_PKSK]
    if (f.domainCodes) {
      conds.push(
        f.domainCodes.length === 0
          ? Prisma.sql`FALSE`
          : Prisma.sql`EXISTS (SELECT 1 FROM question_tags d WHERE d.question_id = q.id AND d.kind = 'pksk_domain' AND d.code IN (${Prisma.join(f.domainCodes)}))`,
      )
    }
    if (f.level) conds.push(Prisma.sql`EXISTS (SELECT 1 FROM question_tags l WHERE l.question_id = q.id AND l.kind = 'pksk_level' AND l.code = ${f.level})`)
    if (f.versionStatuses) conds.push(f.versionStatuses.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`v.status IN (${Prisma.join(f.versionStatuses)})`)
    if (f.search !== undefined && f.search.trim() !== '') {
      conds.push(Prisma.sql`v.stem_ms ILIKE ${likePattern(f.search.trim())} ESCAPE '\\'`)
    }
    const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const where = Prisma.join(conds, ' AND ')
    const offset = (f.page - 1) * f.pageSize
    const [rows, totals] = await Promise.all([
      this.db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where} ORDER BY q.created_at DESC, q.id ASC LIMIT ${f.pageSize} OFFSET ${offset}`,
      this.db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${where}`,
    ])
    return { ids: rows.map((r) => idToString(r.id)), total: totals[0]?.n ?? 0 }
  }

  /** Counts over all PKSK questions by latest-version status and level. */
  async pkskStats(): Promise<{ total: number; published: number; archived: number; t1: number; t4: number }> {
    const rows = await this.db.$queryRaw<{ total: number; published: number; archived: number; t1: number; t4: number }[]>`
      SELECT count(*)::int AS total,
             count(*) FILTER (WHERE v.status = 'approved')::int AS published,
             count(*) FILTER (WHERE v.status = 'archived')::int AS archived,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM question_tags l WHERE l.question_id = q.id AND l.kind = 'pksk_level' AND l.code = 'T1'))::int AS t1,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM question_tags l WHERE l.question_id = q.id AND l.kind = 'pksk_level' AND l.code = 'T4'))::int AS t4
      FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no
      WHERE ${IS_PKSK}`
    return rows[0] ?? { total: 0, published: 0, archived: 0, t1: 0, t4: 0 }
  }

  /** Served PKSK questions (live version published, question active) per domain code at one level. */
  async pkskServedCounts(level: 'T1' | 'T4'): Promise<Record<string, number>> {
    const rows = await this.db.$queryRaw<{ code: string; n: number }[]>`
      SELECT d.code AS code, count(*)::int AS n
      FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
      JOIN question_tags d ON d.question_id = q.id AND d.kind = 'pksk_domain'
      JOIN question_tags l ON l.question_id = q.id AND l.kind = 'pksk_level' AND l.code = ${level}
      WHERE q.is_active GROUP BY 1`
    return Object.fromEntries(rows.map((r) => [r.code, r.n]))
  }

  /** Ids of the served PKSK questions of the given domains at one level, ascending. */
  async pkskServedIds(level: 'T1' | 'T4', domainCodes: readonly string[]): Promise<string[]> {
    if (domainCodes.length === 0) return []
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`
      SELECT q.id
      FROM questions q
      JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no AND v.status = 'approved'
      JOIN question_tags d ON d.question_id = q.id AND d.kind = 'pksk_domain' AND d.code IN (${Prisma.join(domainCodes)})
      JOIN question_tags l ON l.question_id = q.id AND l.kind = 'pksk_level' AND l.code = ${level}
      WHERE q.is_active ORDER BY q.id ASC`
    return rows.map((r) => idToString(r.id))
  }

  /** Replaces the two PKSK tags of a PKSK question. False when the id is not a PKSK question. */
  async setPkskTags(id: string, domainCode: string, level: 'T1' | 'T4'): Promise<boolean> {
    const key = bi(id)
    if (key === null || (await this.pkskIds([id])).length === 0) return false
    await this.db.questionTag.deleteMany({ where: { questionId: key, kind: { in: ['pksk_domain', 'pksk_level'] } } })
    await this.db.questionTag.createMany({
      data: [
        { questionId: key, kind: 'pksk_domain', code: domainCode },
        { questionId: key, kind: 'pksk_level', code: level },
      ],
    })
    return true
  }

  /** Hard delete of PKSK questions only (cascades to versions, parts, options, keys and tags); returns the number deleted. */
  async removePksk(ids: readonly string[]): Promise<number> {
    const keys = (await this.pkskIds(ids)).map(bi).filter((k): k is bigint => k !== null)
    if (keys.length === 0) return 0
    return (await this.db.question.deleteMany({ where: { id: { in: keys } } })).count
  }

  // --- internals ------------------------------------------------------------------------------------

  private versionColumns(c: Omit<VersionDraft, 'parts' | 'spNodeIds' | 'stimulusIds'>) {
    return {
      status: c.status,
      type: c.type,
      stemMs: c.stemMs,
      stemEn: c.stemEn,
      numberLabel: c.numberLabel,
      language: c.language,
      explanationMs: c.explanationMs,
      explanationEn: c.explanationEn,
      subjectId: c.subjectId,
      educationLevelId: c.educationLevelId,
      unitNodeId: c.unitNodeId,
      chapterId: c.chapterId,
      topicId: c.topicId,
      formOrigin: c.formOrigin,
      cognitiveLevel: c.cognitiveLevel,
      kbat: c.kbat,
      tagReview: c.tagReview,
      catalogueVersion: c.catalogueVersion,
      difficultyTp: c.difficultyTp,
      sourcePage: c.sourcePage,
      setLabel: c.setLabel,
      ...(c.paperCode === undefined ? {} : { paperCode: c.paperCode }),
    }
  }

  private async insertVersion(
    questionId: bigint,
    versionNo: number,
    draft: VersionDraft,
    now: Date,
    publishedAt: Date | null,
    provenance?: VersionProvenance,
  ): Promise<void> {
    const { parts, spNodeIds, stimulusIds, ...columns } = draft
    const version = await this.db.questionVersion.create({
      data: {
        questionId,
        versionNo,
        publishedAt,
        createdAt: now,
        updatedAt: now,
        ...this.versionColumns(columns),
        ...(provenance === undefined
          ? {}
          : {
              ...(provenance.sourceRegion === undefined || provenance.sourceRegion === null ? {} : { sourceRegion: provenance.sourceRegion as object }),
              sourcePaperId: provenance.sourcePaperId ?? null,
              intakeItemId: provenance.intakeItemId ?? null,
              sourceFileId: provenance.sourceFileId ?? null,
              aiRunId: provenance.aiRunId ?? null,
              aiModel: provenance.aiModel ?? null,
            }),
      },
    })
    await this.insertChildren(version.id, spNodeIds, stimulusIds, parts)
  }

  private async insertChildren(versionId: bigint, spNodeIds: bigint[], stimulusIds: bigint[], parts: PartDraft[]): Promise<void> {
    if (spNodeIds.length > 0) {
      await this.db.questionVersionSpNode.createMany({ data: spNodeIds.map((nodeId) => ({ questionVersionId: versionId, nodeId })) })
    }
    if (stimulusIds.length > 0) {
      await this.db.questionVersionStimulus.createMany({
        data: stimulusIds.map((stimulusId, i) => ({ questionVersionId: versionId, stimulusId, position: i + 1 })),
      })
    }
    await this.insertParts(versionId, null, parts)
  }

  private async insertParts(versionId: bigint, parentId: bigint | null, drafts: PartDraft[]): Promise<void> {
    for (const d of drafts) {
      const row = await this.db.questionPart.create({
        data: {
          questionVersionId: versionId,
          parentPartId: parentId,
          position: d.position,
          depth: d.depth,
          label: d.label,
          promptMs: d.promptMs,
          promptEn: d.promptEn,
          marks: d.marks,
          mode: d.mode,
          blankCount: d.blankCount,
          wordMin: d.wordMin,
          wordMax: d.wordMax,
          stimulusId: d.stimulusId,
          reveal: d.reveal,
          unitNodeId: d.unitNodeId,
          formOrigin: d.formOrigin,
          difficultyTp: d.difficultyTp,
          kbat: d.kbat,
        },
      })
      if (d.options.length > 0) {
        await this.db.partOption.createMany({
          data: d.options.map((o) => ({
            partId: row.id,
            label: o.label,
            bodyMs: o.bodyMs,
            bodyEn: o.bodyEn,
            imageFileId: o.imageFileId,
            position: o.position,
          })),
        })
      }
      if (d.key) await this.db.answerKey.create({ data: { partId: row.id, kind: d.key.kind, content: d.key.content as Prisma.InputJsonValue } })
      if (d.children.length > 0) await this.insertParts(versionId, row.id, d.children)
    }
  }

  /**
   * FROM + WHERE fragments for a filter. `status: 'approved'` reads the live version; otherwise the latest. Primary-level
   * (Darjah) questions are always excluded. `learnerVisible` (every eligibility/draw read) also drops questions of any other
   * INACTIVE education level.
   */
  /**
   * The SQL a reader applies for `filter` (aliases `q`, `v`), for an admin count that must embed a reader's exact scope inside a
   * larger statement (the servability hub counts). Same fragments as `count`, `sampleIds` and `eligibleAmong`.
   */
  scopeSql(filter: QuestionFilter, learnerVisible = false): { from: Prisma.Sql; where: Prisma.Sql } {
    return this.scope(filter, learnerVisible)
  }

  private scope(filter: QuestionFilter, learnerVisible = false): { from: Prisma.Sql; where: Prisma.Sql } {
    const live = filter.status === 'approved'
    const from = live
      ? Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no`
      : Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const conds: Prisma.Sql[] = [NOT_PKSK]
    if (filter.status) conds.push(Prisma.sql`v.status = ${filter.status}`)
    conds.push(NOT_PRIMARY_LEVEL_SQL)
    if (learnerVisible) conds.push(LEARNER_LEVEL_SQL)
    if (filter.active !== undefined) conds.push(filter.active ? Prisma.sql`q.is_active` : Prisma.sql`NOT q.is_active`)
    const eq = (text: string | undefined, column: Prisma.Sql): void => {
      if (text === undefined) return
      const key = bi(text)
      conds.push(key === null ? Prisma.sql`FALSE` : Prisma.sql`${column} = ${key}`)
    }
    eq(filter.subjectId, Prisma.sql`v.subject_id`)
    eq(filter.educationLevelId, Prisma.sql`v.education_level_id`)
    eq(filter.unitId, Prisma.sql`v.unit_node_id`)
    eq(filter.chapterId, Prisma.sql`v.chapter_id`)
    if (filter.educationLevelIds !== undefined) {
      const keys = filter.educationLevelIds.map(bi).filter((k): k is bigint => k !== null)
      conds.push(keys.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`v.education_level_id IN (${Prisma.join(keys)})`)
    }
    if (filter.chapterIds !== undefined) {
      const keys = filter.chapterIds.map(bi).filter((k): k is bigint => k !== null)
      conds.push(keys.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`v.chapter_id IN (${Prisma.join(keys)})`)
    }
    if (filter.idIn !== undefined) {
      const keys = [...new Set(filter.idIn)].map(bi).filter((k): k is bigint => k !== null)
      conds.push(keys.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`q.id = ANY(${keys}::bigint[])`)
    }
    if (filter.idAfter !== undefined) {
      const key = bi(filter.idAfter)
      conds.push(key === null ? Prisma.sql`FALSE` : Prisma.sql`q.id > ${key}`)
    }
    if (filter.ungrouped) conds.push(Prisma.sql`q.group_id IS NULL`)
    if (filter.difficultyTps !== undefined) {
      const tps = filter.difficultyTps.filter((n) => Number.isSafeInteger(n))
      conds.push(tps.length === 0 ? Prisma.sql`FALSE` : Prisma.sql`v.difficulty_tp IN (${Prisma.join(tps)})`)
    }
    if (filter.spmPool !== undefined) {
      // R1-B06: the shared SPM-servable definition (offered level, linked active subject), no longer the `pool` tag.
      conds.push(filter.spmPool ? SPM_SERVABLE_SQL : Prisma.sql`NOT ${SPM_SERVABLE_SQL}`)
    }
    if (filter.spId !== undefined) {
      const key = bi(filter.spId)
      conds.push(
        key === null
          ? Prisma.sql`FALSE`
          : Prisma.sql`EXISTS (SELECT 1 FROM question_version_sp_nodes s WHERE s.question_version_id = v.id AND s.node_id = ${key})`,
      )
    }
    const tp = filter.tp ?? filter.difficultyTp
    if (tp !== undefined) conds.push(Prisma.sql`v.difficulty_tp = ${tp}`)
    if (filter.type) conds.push(Prisma.sql`v.type = ${filter.type}`)
    if (filter.excludeIds && filter.excludeIds.length > 0) {
      const keys = filter.excludeIds.map(bi).filter((k): k is bigint => k !== null)
      if (keys.length > 0) conds.push(Prisma.sql`q.id <> ALL(${keys}::bigint[])`)
    }
    if (filter.mcqShape || filter.singleMcqLeaf) {
      const candidates = Prisma.sql`SELECT v.id AS vid ${from} WHERE ${Prisma.join(conds, ' AND ')}`
      conds.push(Prisma.sql`v.id = ANY(${shapeArraySql(candidates, filter.mcqShape, filter.singleMcqLeaf === true)})`)
    }
    return { from, where: Prisma.join(conds, ' AND ') }
  }

  /** Reads questions and the selected version of each; a bad stored key fails closed (500, id logged). */
  /** Ids (decimal strings) of the education levels of stage `primary`: hidden everywhere (secondary-only). */
  private async primaryLevelIds(): Promise<Set<string>> {
    const rows = await this.db.$queryRaw<{ id: bigint }[]>`SELECT id FROM education_levels WHERE stage = 'primary'`
    return new Set(rows.map((r) => idToString(r.id)))
  }

  private async hydrate(ids: readonly bigint[], view: ViewMode, scope: 'exclude' | 'only' = 'exclude'): Promise<QuestionRecord[]> {
    const questions = await this.db.question.findMany({
      where: { id: { in: [...ids] }, tags: scope === 'only' ? { some: { kind: PKSK_TAG } } : { none: { kind: PKSK_TAG } } },
      include: { tags: { where: { kind: { in: ['pool', 'pksk_domain', 'pksk_level'] } } } },
    })
    const picks = questions.flatMap((q) => {
      const versionNo = view === 'live' ? q.liveVersionNo : q.latestVersionNo
      return versionNo === null ? [] : [{ q, versionNo }]
    })
    // Secondary-only (2026-10-29): a question of a primary level (D1-D6) is not found, for every caller.
    const hidden = await this.primaryLevelIds()
    return (await this.hydratePicks(picks)).filter((r) => r.version.educationLevelId === null || !hidden.has(r.version.educationLevelId))
  }

  /**
   * `hydrate` for explicit (question, version) pairs (`getVersions`). Pinned grading only, never a serving
   * path: it applies no active, status or PKSK scope.
   */
  private async hydrateVersions(wanted: readonly { id: bigint; versionNo: number }[]): Promise<QuestionRecord[]> {
    const questions = await this.db.question.findMany({
      where: { id: { in: [...new Set(wanted.map((w) => w.id))] } },
      include: { tags: { where: { kind: 'pool' } } },
    })
    const byId = new Map(questions.map((q) => [q.id, q]))
    const picks = wanted.flatMap((w) => {
      const q = byId.get(w.id)
      return q && w.versionNo <= q.latestVersionNo ? [{ q, versionNo: w.versionNo }] : []
    })
    const out = await this.hydratePicks(picks)
    return out.sort((a, b) => (a.id === b.id ? a.version.versionNo - b.version.versionNo : BigInt(a.id) < BigInt(b.id) ? -1 : 1))
  }

  private async hydratePicks(
    picks: readonly { q: PrismaTypes.QuestionGetPayload<{ include: { tags: true } }>; versionNo: number }[],
  ): Promise<QuestionRecord[]> {
    if (picks.length === 0) return []
    const versions: VersionRow[] = await this.db.questionVersion.findMany({
      where: { OR: picks.map(({ q, versionNo }) => ({ questionId: q.id, versionNo })) },
      include: {
        parts: { include: { options: true, key: true }, orderBy: [{ depth: 'asc' }, { position: 'asc' }] },
        spNodes: { orderBy: { id: 'asc' } },
        stimuli: { orderBy: { position: 'asc' }, include: { stimulus: true } },
      },
    })
    const byKey = new Map(versions.map((v) => [`${v.questionId}:${v.versionNo}`, v]))
    const out: QuestionRecord[] = []
    for (const { q, versionNo } of picks) {
      const v = byKey.get(`${q.id}:${versionNo}`)
      if (!v) continue
      let version: QuestionVersionRecord
      try {
        version = this.versionRecord(v)
      } catch (e) {
        if (e instanceof StoredKeyError) {
          this.logger.error(`Question ${idToString(q.id)} version ${versionNo}: stored key of part ${e.partId} is invalid`)
          throw ApiError.of('SERVER_ERROR')
        }
        throw e
      }
      out.push({
        id: idToString(q.id),
        isActive: q.isActive,
        sourceType: (q.sourceType as StoreSourceType | null) ?? null,
        createdById: q.createdById === null ? null : idToString(q.createdById),
        latestVersionNo: q.latestVersionNo,
        liveVersionNo: q.liveVersionNo,
        groupId: q.groupId === null ? null : idToString(q.groupId),
        groupPosition: q.groupPosition,
        spmPool: q.tags.some((t) => t.kind === 'pool'),
        pksk: pkskOf(q.tags),
        createdAt: q.createdAt,
        updatedAt: q.updatedAt,
        version,
      })
    }
    return out.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
  }

  private versionRecord(v: VersionRow): QuestionVersionRecord {
    if (!isQuestionStatus(v.status)) throw new Error(`Question version ${idToString(v.id)}: unknown status`)
    const parts = v.parts
    return {
      id: idToString(v.id),
      versionNo: v.versionNo,
      status: v.status,
      archiveReason: v.archiveReason as QuestionVersionRecord['archiveReason'],
      publishedAt: v.publishedAt,
      type: v.type as StoreQuestionType,
      stemMs: v.stemMs,
      stemEn: v.stemEn,
      numberLabel: v.numberLabel,
      language: v.language as QuestionVersionRecord['language'],
      explanationMs: v.explanationMs,
      explanationEn: v.explanationEn,
      subjectId: v.subjectId === null ? null : idToString(v.subjectId),
      educationLevelId: v.educationLevelId === null ? null : idToString(v.educationLevelId),
      unitId: v.unitNodeId === null ? null : idToString(v.unitNodeId),
      chapterId: v.chapterId === null ? null : idToString(v.chapterId),
      topicId: v.topicId === null ? null : idToString(v.topicId),
      formOrigin: v.formOrigin as QuestionVersionRecord['formOrigin'],
      cognitiveLevel: v.cognitiveLevel,
      kbat: kbatOf(v.kbat),
      tagReview: v.tagReview,
      catalogueVersion: v.catalogueVersion,
      difficultyTp: v.difficultyTp,
      sourcePage: v.sourcePage,
      setLabel: v.setLabel,
      sourceFile: null,
      spIds: v.spNodes.map((s) => idToString(s.nodeId)),
      stimulusIds: v.stimuli.map((s) => idToString(s.stimulusId)),
      stemImageId: (() => {
        const img = v.stimuli.find((s) => s.stimulus.kind === 'image' && s.stimulus.assetFileId !== null)
        return img?.stimulus.assetFileId == null ? null : idToString(img.stimulus.assetFileId)
      })(),
      paperCode: v.paperCode,
      parts: partsFromRows(
        parts,
        parts.flatMap((p) => p.options),
        parts.flatMap((p) => (p.key ? [p.key] : [])),
      ),
      createdAt: v.createdAt,
      updatedAt: v.updatedAt,
    }
  }
}

