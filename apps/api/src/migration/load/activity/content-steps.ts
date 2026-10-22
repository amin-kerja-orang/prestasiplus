/**
 * Content group of `migrate:activity` (BE-29 Part B): articles, banners, notes, videos and Audio KBAT sets.
 *
 * File migration is OFF (LEAD Q2): no file is read or copied, every `*_file_id` stays null, and the rows that had
 * a source path are only counted in the report notes (`file_migration_off.*`). Notes, videos and audio sets need an
 * owner user in v2 that the staged tables do not carry; it comes from `--content-owner` (`contentOwnerUserId`),
 * and without it (or with an id that is not a v2 user) those rows are rejected ORPHAN_PARENT (LEAD Q7).
 * A v2 NOT NULL column with no staged source rejects the row INVALID_VALUE naming the column (see transform/content.ts).
 *
 * Child safety (LEAD 2026-10-20, D9): migrated videos are `global`, which the API allows only for admin or teacher, so the
 * `--content-owner` must be an ACTIVE user with role `admin`; any other existing user fails the run before a content row is
 * written (`assertContentOwner`, called once by `planActivity`, so a dry-run and an apply both fail before any group runs). Article and note
 * HTML is sanitised in the transform with the API's own sanitiser, configured with the run's `PUBLIC_ORIGINS`.
 */
import type pg from 'pg'

import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId } from '../../kit/sql'
import type { LegacyRow } from '../../kit/upsert'
import { klDateSql } from '../../transform/activity-common'
import {
  transformArticle,
  transformAudioSet,
  transformBanner,
  transformNote,
  transformVideo,
  type ArticleValues,
} from '../../transform/content'
import { ApplyGuardError } from '../../kit/apply-guard'
import { originsOf, SanitizeHtmlSanitizer } from '../../../modules/content/shared/sanitize-html.sanitizer'
import { dropConflicts } from '../claim'
import { rejectRow, upsertAndMap } from '../helpers'
import { distinctValues, readById, type StagedRow } from '../source'
import { lookup } from './catalogue-steps'
import type { ActivityContext } from './context'

const idOf = (row: StagedRow): string => {
  const id = row.id ?? ''
  assertSurrogateLegacyId(id, 'migrate:activity')
  return id
}

/** The configured content owner when it is a v2 user, else undefined (the caller rejects ORPHAN_PARENT). */
async function contentOwner(a: ActivityContext, db: Pick<pg.PoolClient, 'query'>): Promise<string | undefined> {
  const id = a.contentOwnerUserId?.trim()
  if (id === undefined || !/^\d{1,18}$/.test(id)) return undefined
  const res = await db.query(`SELECT 1 FROM users WHERE id = $1::bigint`, [id])
  return res.rowCount === 1 ? id : undefined
}

/**
 * Refuses a `--content-owner` that is an existing v2 user but not an ACTIVE (active, not suspended) `admin`: such a user
 * could not publish a `global` video through the API. An id that is not a v2 user stays "no owner" (ORPHAN_PARENT rows,
 * nothing is written for them). Called once by `planActivity` (dry-run and apply) before any group runs. The message
 * carries no personal data; the id is a surrogate id.
 */
export async function assertContentOwner(pool: pg.Pool, ownerId: string | undefined): Promise<void> {
  const id = ownerId?.trim()
  if (id === undefined || !/^\d{1,18}$/.test(id)) return
  const res = await pool.query<{ ok: boolean }>(
    `SELECT (u.is_active AND NOT u.is_suspended AND EXISTS (SELECT 1 FROM user_roles r WHERE r.user_id = u.id AND r.role = 'admin')) AS ok
       FROM users u WHERE u.id = $1::bigint`,
    [id],
  )
  if (res.rowCount === 1 && res.rows[0]?.ok !== true) {
    throw new ApplyGuardError(`--content-owner ${id} must be an active user with role admin (migrated videos are published for everyone). Nothing was written.`)
  }
}

/** The sanitiser the API binds to `HTML_SANITIZER`, with this run's `PUBLIC_ORIGINS`. */
const sanitizerOf = (a: ActivityContext): SanitizeHtmlSanitizer => new SanitizeHtmlSanitizer(originsOf(a.env.PUBLIC_ORIGINS))

/** Malaysia calendar dates (`YYYY-MM-DD`) of some timestamps, computed in SQL (T-05): `text -> date text`. */
async function klDates(db: Pick<pg.PoolClient, 'query'>, values: readonly (string | null)[]): Promise<Map<string, string>> {
  const distinct = [...new Set(values.filter((v): v is string => v !== null && v.trim() !== ''))]
  const out = new Map<string, string>()
  if (distinct.length === 0) return out
  const res = await db.query<{ v: string; d: string }>(
    `SELECT v, ${klDateSql('v::timestamptz')}::text AS d FROM unnest($1::text[]) AS v`,
    [distinct],
  )
  for (const r of res.rows) out.set(r.v, r.d)
  return out
}

const toRow = (legacyId: string, values: object): LegacyRow => ({ legacyId, values: values as unknown as Record<string, unknown> })

// ---------------------------------------------------------------- articles

export function articlesStep(a: ActivityContext): AnyEntityStep {
  const entity = 'articles'
  const sanitizer = sanitizerOf(a)
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'articles', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const authors = await ctx.idMap.resolveMany('users', distinctValues(rows, 'author_id'))
      let items: { legacyId: string; values: ArticleValues }[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const authorId = lookup(authors, row.author_id)
        const out = transformArticle(row, { authorId, sanitizer })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push({ legacyId, values: out.value })
      }
      items = await dropConflicts(ctx.db, items, {
        entity, table: 'articles', column: 'slug', expr: 'slug', source: ctx.source, rejects: ctx.rejects,
        legacyIdOf: (i) => i.legacyId, valueOf: (i) => i.values.slug,
      })
      return upsertAndMap(
        ctx, entity, 'articles',
        ['title', 'slug', 'excerpt', 'content', 'featured_image_file_id', 'category', 'grade_level', 'is_published', 'views', 'author_id', 'published_at', 'created_at', 'updated_at'],
        items.map((i) => toRow(i.legacyId, i.values)),
      )
    },
  }
}

// ---------------------------------------------------------------- banners

export function bannersStep(a: ActivityContext): AnyEntityStep {
  const entity = 'banners'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'banners', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const days = await klDates(ctx.db, rows.flatMap((r) => [r.starts_at ?? null, r.ends_at ?? null]))
      const items: LegacyRow[] = []
      let images = 0
      let dropped = 0
      for (const row of rows) {
        const legacyId = idOf(row)
        const o = transformBanner(row, {
          start: lookup(days, row.starts_at) ?? null,
          end: lookup(days, row.ends_at) ?? null,
        })
        if (o.hadImage) images++
        if (o.droppedTarget) dropped++
        if (!o.out.ok) rejectRow(ctx, entity, legacyId, o.out.reject)
        else items.push(toRow(legacyId, o.out.value))
      }
      a.notes.count('file_migration_off.banners.image_path', images)
      a.notes.count('banners.target_not_a_link', dropped)
      return upsertAndMap(
        ctx, entity, 'banners',
        ['title', 'description', 'image_file_id', 'banner_type', 'link_type', 'external_url', 'display_order', 'start_date', 'end_date', 'is_active', 'created_at', 'updated_at'],
        items,
      )
    },
  }
}

// ---------------------------------------------------------------- notes

export function notesStep(a: ActivityContext): AnyEntityStep {
  const entity = 'notes'
  const sanitizer = sanitizerOf(a)
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'notes', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const ownerId = await contentOwner(a, ctx.db)
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformNote(row, { ownerId, sanitizer })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push(toRow(legacyId, out.value))
      }
      return upsertAndMap(
        ctx, entity, 'notes',
        ['title', 'summary', 'content', 'subject', 'note_type', 'grade', 'is_published', 'views', 'author_id', 'created_at', 'updated_at'],
        items,
      )
    },
  }
}

// ---------------------------------------------------------------- videos

export function videosStep(a: ActivityContext): AnyEntityStep {
  const entity = 'videos'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'videos', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const ownerId = await contentOwner(a, ctx.db)
      const items: LegacyRow[] = []
      for (const row of rows) {
        const legacyId = idOf(row)
        const out = transformVideo(row, { ownerId })
        if (!out.ok) rejectRow(ctx, entity, legacyId, out.reject)
        else items.push(toRow(legacyId, out.value))
      }
      return upsertAndMap(
        ctx, entity, 'videos',
        ['video_url', 'platform', 'title', 'description', 'category', 'visibility', 'uploader_id', 'views', 'created_at', 'updated_at'],
        items,
      )
    },
  }
}

// ---------------------------------------------------------------- audio KBAT

export function audioSetsStep(a: ActivityContext): AnyEntityStep {
  const entity = 'audio_kbat_sets'
  return {
    entity,
    source: a.source,
    extract: (after) => readById(a.pool, 'audio_kbat', after, a.pageSize),
    keyOf: idOf,
    async load(rows: StagedRow[], ctx: BatchContext): Promise<BatchResult> {
      const ownerId = await contentOwner(a, ctx.db)
      // The staging spec has no level or subject on `audio_kbat`; if it gains them they are resolved here.
      const levels = await ctx.idMap.resolveMany('education_levels', distinctValues(rows, 'education_level_id'))
      const subjects = await ctx.idMap.resolveMany('subjects', distinctValues(rows, 'subject_id'))
      const items: LegacyRow[] = []
      let audio = 0
      for (const row of rows) {
        const legacyId = idOf(row)
        const o = transformAudioSet(row, {
          ownerId,
          levelId: lookup(levels, row.education_level_id),
          subjectId: lookup(subjects, row.subject_id),
        })
        if (o.hadAudio) audio++
        if (!o.out.ok) rejectRow(ctx, entity, legacyId, o.out.reject)
        else items.push(toRow(legacyId, o.out.value))
      }
      a.notes.count('file_migration_off.audio_kbat.audio_path', audio)
      return upsertAndMap(
        ctx, entity, 'audio_kbat_sets',
        ['title', 'education_level_id', 'subject_id', 'status', 'created_by_id', 'created_at', 'updated_at'],
        items,
      )
    },
  }
}
