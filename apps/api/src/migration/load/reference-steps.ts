/**
 * Reference-data steps of `migrate:core` (v2-data-migration.md 6.1 step 1): education levels, subjects,
 * chapters, topics, subject-level pairs, JPN, PPD and schools. Seeded reference rows are adopted by natural
 * key (`claimSeeded`) so a seeded database and a migrated one end with one row per level / subject / chapter.
 */
import type { AnyEntityStep, BatchContext, BatchResult } from '../kit/runner'
import type { LegacyRow } from '../kit/upsert'
import { assertSurrogateLegacyId } from '../kit/sql'
import { claimSeeded, dropConflicts } from './claim'
import type { CoreContext } from './context'
import { existingByCode, rejectRow, upsertAndMap } from './helpers'
import { distinctValues, readById, readDistinctPairs, resolveFk, type StagedRow } from './source'
import {
  geoOf,
  levelIdentity,
  type JpnRow,
  type PpdRow,
  transformChapter,
  transformLevel,
  transformSchool,
  transformSubject,
  transformTopic,
  type ChapterValues,
  type ExistingLevel,
  type ExistingSubject,
  type LevelValues,
  type SchoolValues,
  type SubjectValues,
  type TopicValues,
} from '../transform/reference'
import { squash } from '../transform/common'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:core')
  return id
}

// ---------------------------------------------------------------- education_levels

export function educationLevelsStep(core: CoreContext): AnyEntityStep {
  const entity = 'education_levels'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'education_levels', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const codes = rows.map((r) => levelIdentity(squash(r.name_bm) ?? '', r.id ?? '').code)
      const existing = await existingByCode<ExistingLevel & { code: string }>(ctx, 'education_levels', ['grade'], codes)
      const items: { legacyId: string; values: LevelValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const code = levelIdentity(squash(row.name_bm) ?? '', row.id ?? '').code
        const out = transformLevel(row, existing.get(code))
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      await claimSeeded(ctx.db, 'education_levels', ctx.source, 'upper(t.code)', items.map((i) => ({ legacyId: i.legacyId, key: i.values.code })))
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: 'education_levels', column: 'code', expr: 'upper(code)', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.code,
      })
      return upsertAndMap(ctx, entity, 'education_levels', LEVEL_COLUMNS, kept.map(toRow))
    },
  }
}

const LEVEL_COLUMNS = ['code', 'name', 'name_en', 'stage', 'curriculum', 'sort_order', 'grade', 'created_at', 'updated_at'] as const

const toRow = <V extends object>(i: { legacyId: string; values: V }): LegacyRow => ({
  legacyId: i.legacyId,
  values: i.values as unknown as Record<string, unknown>,
})

// ---------------------------------------------------------------- subjects

const SUBJECT_COLUMNS = ['code', 'name', 'name_en', 'color', 'is_core', 'sort_order', 'created_at', 'updated_at'] as const

export function subjectsStep(core: CoreContext): AnyEntityStep {
  const entity = 'subjects'
  const codeOf = (r: StagedRow): string => (r.code?.trim().toUpperCase() || `SUBJ${r.id ?? ''}`).replace(/\s+/g, '_')
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'subjects', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const existing = await existingByCode<ExistingSubject & { code: string }>(
        ctx, 'subjects', ['name_en', 'color'], rows.map(codeOf),
      )
      const items: { legacyId: string; values: SubjectValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformSubject(row, existing.get(codeOf(row)))
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      await claimSeeded(ctx.db, 'subjects', ctx.source, 'upper(t.code)', items.map((i) => ({ legacyId: i.legacyId, key: i.values.code })))
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: 'subjects', column: 'code', expr: 'upper(code)', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.code,
      })
      return upsertAndMap(ctx, entity, 'subjects', SUBJECT_COLUMNS, kept.map(toRow))
    },
  }
}

// ---------------------------------------------------------------- chapters

const CHAPTER_COLUMNS = ['subject_id', 'education_level_id', 'name', 'chapter_number', 'strand', 'dskp_code', 'in_tree', 'created_at', 'updated_at'] as const
const CHAPTER_KEY = `t.subject_id::text || ':' || coalesce(t.education_level_id::text, '') || ':' || coalesce(t.chapter_number::text, '')`

export function chaptersStep(core: CoreContext): AnyEntityStep {
  const entity = 'chapters'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'chapters', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const levels = await ctx.idMap.resolveMany('education_levels', distinctValues(rows, 'education_level_id'))
      const items: { legacyId: string; values: ChapterValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformChapter(row, {
          subjectId: resolveFk(row.subject_id, subjects),
          levelId: resolveFk(row.education_level_id, levels),
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      await claimSeeded(ctx.db, 'chapters', ctx.source, CHAPTER_KEY, items.map((i) => ({
        legacyId: i.legacyId,
        key: `${i.values.subject_id}:${i.values.education_level_id ?? ''}:${i.values.chapter_number ?? ''}`,
      })))
      return upsertAndMap(ctx, entity, 'chapters', CHAPTER_COLUMNS, items.map(toRow))
    },
  }
}

// ---------------------------------------------------------------- topics

const TOPIC_COLUMNS = ['chapter_id', 'name', 'sort_order', 'created_at', 'updated_at'] as const

export function topicsStep(core: CoreContext): AnyEntityStep {
  const entity = 'topics'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'topics', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const chapters = await ctx.idMap.resolveMany('chapters', distinctValues(rows, 'chapter_id'))
      const items: { legacyId: string; values: TopicValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformTopic(row, { chapterId: resolveFk(row.chapter_id, chapters) })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      await claimSeeded(ctx.db, 'topics', ctx.source, `t.chapter_id::text || ':' || lower(btrim(t.name))`, items.map((i) => ({
        legacyId: i.legacyId,
        key: `${i.values.chapter_id}:${i.values.name.toLowerCase()}`,
      })))
      return upsertAndMap(ctx, entity, 'topics', TOPIC_COLUMNS, items.map(toRow))
    },
  }
}

// ---------------------------------------------------------------- subject_levels (derived from chapters)

export function subjectLevelsStep(core: CoreContext): AnyEntityStep {
  const entity = 'subject_levels'
  return {
    entity,
    source: core.source,
    extract: (after) => readDistinctPairs(core.pool, 'chapters', 'subject_id', 'education_level_id', after, core.pageSize),
    keyOf: (r: StagedRow) => `${r.subject_id}:${r.education_level_id}`,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const levels = await ctx.idMap.resolveMany('education_levels', distinctValues(rows, 'education_level_id'))
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = `${row.subject_id}:${row.education_level_id}`
        const subjectId = subjects.get(row.subject_id ?? '')
        const levelId = levels.get(row.education_level_id ?? '')
        if (subjectId === undefined || levelId === undefined) {
          rejectRow(ctx, entity, legacyId, { reason: 'ORPHAN_PARENT', column: subjectId === undefined ? 'subject_id' : 'education_level_id' })
          continue
        }
        items.push({ legacyId, values: { subject_id: subjectId, education_level_id: levelId } })
      }
      await claimSeeded(ctx.db, 'subject_levels', ctx.source, `t.subject_id::text || ':' || t.education_level_id::text`, items.map((i) => ({
        legacyId: i.legacyId,
        key: `${i.values.subject_id as string}:${i.values.education_level_id as string}`,
      })))
      return upsertAndMap(ctx, entity, 'subject_levels', ['subject_id', 'education_level_id'], items, { register: false })
    },
  }
}

// ---------------------------------------------------------------- jpns and ppds (derived from schools)

function geoStep<R extends JpnRow | PpdRow>(
  core: CoreContext,
  entity: 'jpns' | 'ppds',
  rowsOf: (geo: Awaited<ReturnType<CoreContext['geo']>>) => R[],
  toValues: (row: R, ctx: BatchContext, parents: Map<string, string>) => Record<string, unknown>,
  parentKeys: (rows: R[]) => string[],
): AnyEntityStep {
  return {
    entity,
    source: core.source,
    async *extract(after: string | null) {
      for (const row of rowsOf(await core.geo())) {
        if (after === null || row.key > after) yield row
      }
    },
    keyOf: (r: R) => r.key,
    async load(rows: R[], ctx: BatchContext): Promise<BatchResult> {
      const parents = entity === 'ppds' ? await ctx.idMap.resolveMany('jpns', parentKeys(rows)) : new Map<string, string>()
      const items: LegacyRow[] = []
      for (const row of rows) {
        assertSurrogateLegacyId(row.key, 'migrate:core')
        if (entity === 'ppds' && !parents.has((row as PpdRow).jpnKey)) {
          rejectRow(ctx, entity, row.key, { reason: 'ORPHAN_PARENT', column: 'jpn_id' })
          continue
        }
        items.push({ legacyId: row.key, values: toValues(row, ctx, parents) })
      }
      await claimSeeded(ctx.db, entity, ctx.source, 't.code', items.map((i) => ({ legacyId: i.legacyId, key: i.values.code as string })))
      const kept = await dropConflicts(ctx.db, items, {
        entity, table: entity, column: 'code', expr: 'code', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.code as string,
      })
      const columns = entity === 'ppds' ? ['jpn_id', 'code', 'name'] : ['code', 'name']
      return upsertAndMap(ctx, entity, entity, columns, kept)
    },
  }
}

export const jpnsStep = (core: CoreContext): AnyEntityStep =>
  geoStep<JpnRow>(core, 'jpns', (g) => g.jpns, (r) => ({ code: r.code, name: r.name }), () => [])

export const ppdsStep = (core: CoreContext): AnyEntityStep =>
  geoStep<PpdRow>(
    core,
    'ppds',
    (g) => g.ppds,
    (r, _ctx, parents) => ({ jpn_id: parents.get(r.jpnKey), code: r.code, name: r.name }),
    (rows) => [...new Set(rows.map((r) => r.jpnKey))],
  )

// ---------------------------------------------------------------- schools

const SCHOOL_COLUMNS = ['name', 'code', 'type', 'state', 'district', 'jpn_id', 'ppd_id', 'join_code', 'is_active', 'created_at', 'updated_at'] as const

export function schoolsStep(core: CoreContext): AnyEntityStep {
  const entity = 'schools'
  return {
    entity,
    source: core.source,
    extract: (after) => readById(core.pool, 'schools', after, core.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const geo = await core.geo()
      const found = rows.map((r) => geoOf(geo, r.state, r.district))
      const jpns = await ctx.idMap.resolveMany('jpns', found.flatMap((f) => (f.jpn ? [f.jpn.key] : [])))
      const ppds = await ctx.idMap.resolveMany('ppds', found.flatMap((f) => (f.ppd ? [f.ppd.key] : [])))
      let items: { legacyId: string; values: SchoolValues }[] = []
      rows.forEach((row, i) => {
        const legacyId = idOf(row)
        const f = found[i] as ReturnType<typeof geoOf>
        const out = transformSchool(row, {
          jpnId: f.jpn ? (jpns.get(f.jpn.key) ?? null) : null,
          ppdId: f.ppd ? (ppds.get(f.ppd.key) ?? null) : null,
          stateName: f.jpn?.name ?? null,
          districtName: f.ppd?.district ?? null,
        })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      })
      type SchoolItem = { legacyId: string; values: SchoolValues }
      const unique = (column: 'code' | 'join_code', expr: string) => ({
        entity, table: 'schools', column, expr, source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i: SchoolItem) => i.legacyId,
        valueOf: (i: SchoolItem) => (column === 'code' ? (i.values.code?.toLowerCase() ?? null) : i.values.join_code),
      })
      items = await dropConflicts(ctx.db, items, unique('code', 'lower(code)'))
      items = await dropConflicts(ctx.db, items, unique('join_code', 'join_code'))
      return upsertAndMap(ctx, entity, 'schools', SCHOOL_COLUMNS, items.map(toRow))
    },
  }
}
