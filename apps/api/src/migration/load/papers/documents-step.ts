/**
 * `paper_documents` (254) and `paper_document_pages` (7,424) -> `paper_documents` / `paper_document_pages` + `files` (purpose `kertas_page`),
 * V2 parity (migration 0265). In V2 these ARE the Kertas Subjektif feature (a subjective past paper served as page images with a revealable
 * marking scheme), so they are loaded as they are, not left in the archive.
 *
 *  - document: kertas 2 to 4 and a title are required (else rejected); subject through the id map (V2 allows none: the pupil list shows it
 *    under "Lain-lain", as V2); year outside 1900..2100 and counts out of range become NULL / 0 with a counter. `published_at` is V2's: a
 *    document that pupils could open in V2 is published in V3 (the serving whitelist stays "published only"). On a re-run the header is
 *    refreshed but `published_at` and the page counts are not touched, so a V3 admin's Sembunyi is never undone by a second run;
 *  - page: kind `paper` or `scheme`, position >= 1, and the image through `MigrationFiles` (path plain and listed in SHA256SUMS, checksum,
 *    size and content check, copied to the file storage). A page whose file fails is rejected `INVALID_VALUE path` and counted by cause;
 *  - after the pages, `finaliseDocuments` makes `page_count` / `scheme_page_count` the number of pages actually loaded and hides (Draf) a
 *    document that ended with no paper page, so nothing published is empty. It runs only when the files were migrated.
 * Without `--files-dir` the pages are skipped and counted `file_migration_off.paper_document_pages`: the headers load, nothing is published empty
 * until the files are loaded by a re-run.
 */
import type pg from 'pg'

import type { AnyEntityStep, BatchContext, BatchResult } from '../../kit/runner'
import { assertSurrogateLegacyId, toJson } from '../../kit/sql'
import { text } from '../../transform/common'
import type { MigrationFiles } from '../activity/files'
import { rejectRow } from '../helpers'
import type { QuestionsContext } from '../questions/context'
import { readArchiveById, type ArchiveRow } from './archive-source'
import { intOf } from './plan'

export const DOCUMENT_KINDS = ['paper', 'scheme'] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** A year a past paper can carry; anything else is stored as NULL. */
export const yearOf = (raw: string | null | undefined): number | null => {
  const n = intOf(raw, 0)
  return n !== null && n >= 1900 && n <= 2100 ? n : null
}

/** The staged `kind` as a V3 kind, or null. */
export const kindOf = (raw: string | null | undefined): DocumentKind | null => {
  const k = (text(raw) ?? '').toLowerCase()
  return (DOCUMENT_KINDS as readonly string[]).includes(k) ? (k as DocumentKind) : null
}

/** Smallint-safe count of the staged value (NULL, junk and out-of-range become 0). */
export const smallCountOf = (raw: string | null | undefined): number => {
  const n = intOf(raw, 0)
  return n !== null && n <= 32767 ? n : 0
}

export function documentsStep(c: QuestionsContext): AnyEntityStep {
  const entity = 'paper_documents'
  return {
    entity,
    source: c.source,
    extract: (after) => readArchiveById(c.pool, 'paper_documents', after, c.pageSize),
    keyOf: (r: ArchiveRow) => r.id ?? '',
    async load(rows: ArchiveRow[], ctx: BatchContext): Promise<BatchResult> {
      const cur = await c.curriculum()
      const items: Record<string, unknown>[] = []
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:paper-documents')
        const title = text(row.title)
        if (title === null) {
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'title' })
          continue
        }
        const kertas = intOf(row.kertas, 2)
        if (kertas === null || kertas > 4) {
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'kertas' })
          continue
        }
        const v2Subject = text(row.subject_id)
        let subject: string | null = null
        if (v2Subject !== null) {
          subject = cur.subjects.get(v2Subject) ?? null
          if (subject === null) c.notes.count('paper_documents.subject_unmapped')
        } else c.notes.count('paper_documents.subject_none')
        const year = yearOf(row.year)
        if (text(row.year) !== null && year === null) c.notes.count('paper_documents.year_out_of_range')
        const duration = intOf(row.duration_minutes, 0)
        const marks = intOf(row.marks_total, 0)
        items.push({
          legacy_id: legacyId,
          subject_id: subject,
          kertas,
          title,
          negeri: text(row.negeri),
          year,
          source_file: text(row.source_file),
          duration_minutes: duration !== null && duration <= 32767 ? duration : null,
          marks_total: marks !== null && marks <= 32767 ? marks : null,
          page_count: smallCountOf(row.page_count),
          scheme_page_count: smallCountOf(row.scheme_page_count),
          published_at: text(row.published_at),
          created_at: text(row.created_at),
          updated_at: text(row.updated_at),
        })
      }
      if (items.length === 0) return {}
      const res = await ctx.db.query<{ id: string; legacy_id: string; inserted: boolean }>(
        `INSERT INTO paper_documents (subject_id, kertas, title, negeri, year, source_file, duration_minutes, marks_total, page_count, scheme_page_count,
                                      published_at, created_at, updated_at, legacy_source, legacy_id)
         SELECT x.subject_id, x.kertas, x.title, x.negeri, x.year, x.source_file, x.duration_minutes, x.marks_total, x.page_count, x.scheme_page_count,
                x.published_at, coalesce(x.created_at, now()), coalesce(x.updated_at, now()), $2, x.legacy_id
         FROM jsonb_to_recordset($1::jsonb) AS x(legacy_id text, subject_id bigint, kertas smallint, title text, negeri text, year smallint, source_file text,
                                                 duration_minutes smallint, marks_total smallint, page_count smallint, scheme_page_count smallint,
                                                 published_at timestamptz, created_at timestamptz, updated_at timestamptz)
         ON CONFLICT (legacy_source, legacy_id) DO UPDATE
           SET subject_id = EXCLUDED.subject_id, kertas = EXCLUDED.kertas, title = EXCLUDED.title, negeri = EXCLUDED.negeri, year = EXCLUDED.year,
               source_file = EXCLUDED.source_file, duration_minutes = EXCLUDED.duration_minutes, marks_total = EXCLUDED.marks_total
         RETURNING id::text AS id, legacy_id, (xmax = 0) AS inserted`,
        [toJson(items), ctx.source],
      )
      await ctx.idMap.registerMany(entity, res.rows.map((r) => [r.legacy_id, r.id] as const))
      const inserted = res.rows.filter((r) => r.inserted).length
      return { inserted, unchanged: res.rows.length - inserted }
    },
  }
}

export function documentPagesStep(c: QuestionsContext, files: MigrationFiles | undefined): AnyEntityStep {
  const entity = 'paper_document_pages'
  return {
    entity,
    source: c.source,
    extract: (after) => readArchiveById(c.pool, 'paper_document_pages', after, c.pageSize),
    keyOf: (r: ArchiveRow) => r.id ?? '',
    async load(rows: ArchiveRow[], ctx: BatchContext): Promise<BatchResult> {
      if (files === undefined) {
        c.notes.count('file_migration_off.paper_document_pages', rows.length)
        return { excluded: rows.length }
      }
      const docIds = [...new Set(rows.map((r) => text(r.paper_document_id)).filter((x): x is string => x !== null))]
      const docs = new Map<string, string>()
      if (docIds.length > 0) {
        const res = await ctx.db.query<{ id: string; legacy_id: string }>(`SELECT id::text AS id, legacy_id FROM paper_documents WHERE legacy_source = $1 AND legacy_id = ANY($2::text[])`, [ctx.source, docIds])
        for (const r of res.rows) docs.set(r.legacy_id, r.id)
      }
      const items: Record<string, unknown>[] = []
      let verified = 0
      for (const row of rows) {
        const legacyId = row.id ?? ''
        assertSurrogateLegacyId(legacyId, 'migrate:paper-document-pages')
        const parent = text(row.paper_document_id)
        const doc = parent === null ? undefined : docs.get(parent)
        if (doc === undefined) {
          rejectRow(ctx, entity, legacyId, { reason: 'ORPHAN_PARENT', column: 'paper_document_id' })
          continue
        }
        const kind = kindOf(row.kind)
        if (kind === null) {
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'kind' })
          continue
        }
        const position = intOf(row.position, 1)
        if (position === null || position > 32767) {
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'position' })
          continue
        }
        const f = await files.migrate(ctx, { table: 'paper_document_pages', column: 'path', legacyId, rawPath: row.path ?? '', purpose: 'kertas_page' })
        if (!f.ok) {
          c.notes.count(`files.paper_document_pages.path.rejected.${f.cause}`)
          rejectRow(ctx, entity, legacyId, { reason: 'INVALID_VALUE', column: 'path' })
          continue
        }
        c.notes.count(`files.paper_document_pages.path.${f.outcome}`)
        if (f.fileId === null) {
          verified += 1 // dry-run: the file is verified, nothing is written
          continue
        }
        const w = intOf(row.width, 0)
        const h = intOf(row.height, 0)
        items.push({
          legacy_id: legacyId,
          document_id: doc,
          kind,
          position,
          file_id: f.fileId,
          width: w !== null && w <= 32767 ? w : null,
          height: h !== null && h <= 32767 ? h : null,
          created_at: text(row.created_at),
        })
      }
      if (items.length === 0) return verified > 0 ? { inserted: verified } : {}
      const res = await ctx.db.query<{ id: string; legacy_id: string; inserted: boolean }>(
        `INSERT INTO paper_document_pages (paper_document_id, kind, position, file_id, width, height, created_at, legacy_source, legacy_id)
         SELECT x.document_id, x.kind, x.position, x.file_id, x.width, x.height, coalesce(x.created_at, now()), $2, x.legacy_id
         FROM jsonb_to_recordset($1::jsonb) AS x(legacy_id text, document_id bigint, kind text, position smallint, file_id bigint, width smallint, height smallint, created_at timestamptz)
         ON CONFLICT (legacy_source, legacy_id) DO UPDATE
           SET file_id = EXCLUDED.file_id, width = EXCLUDED.width, height = EXCLUDED.height
         RETURNING id::text AS id, legacy_id, (xmax = 0) AS inserted`,
        [toJson(items), ctx.source],
      )
      await ctx.idMap.registerMany(entity, res.rows.map((r) => [r.legacy_id, r.id] as const))
      const inserted = res.rows.filter((r) => r.inserted).length
      return { inserted: inserted + verified, unchanged: res.rows.length - inserted }
    },
  }
}

export interface FinaliseDocumentsResult {
  /** Documents whose page counts changed to the number of pages loaded. */
  recounted: number
  /** Published documents left with no paper page and hidden (Draf). */
  unpublishedEmpty: number
}

/**
 * After the pages: the counts of every loaded document become the number of pages actually present, and a document with no paper page is
 * hidden (it cannot be published empty; the admin Terbit refuses it too). Idempotent. Call only when the files were migrated.
 */
export async function finaliseDocuments(db: Pick<pg.Pool, 'query'>, source: string): Promise<FinaliseDocumentsResult> {
  const counted = await db.query(
    `UPDATE paper_documents d
        SET page_count = coalesce(p.papers, 0), scheme_page_count = coalesce(p.schemes, 0)
       FROM paper_documents d2
       LEFT JOIN (SELECT paper_document_id,
                         count(*) FILTER (WHERE kind = 'paper')::smallint AS papers,
                         count(*) FILTER (WHERE kind = 'scheme')::smallint AS schemes
                    FROM paper_document_pages GROUP BY paper_document_id) p ON p.paper_document_id = d2.id
      WHERE d.id = d2.id AND d.legacy_source = $1
        AND (d.page_count IS DISTINCT FROM coalesce(p.papers, 0) OR d.scheme_page_count IS DISTINCT FROM coalesce(p.schemes, 0))`,
    [source],
  )
  const hidden = await db.query(`UPDATE paper_documents SET published_at = NULL, updated_at = now() WHERE legacy_source = $1 AND page_count = 0 AND published_at IS NOT NULL`, [source])
  return { recounted: counted.rowCount ?? 0, unpublishedEmpty: hidden.rowCount ?? 0 }
}
