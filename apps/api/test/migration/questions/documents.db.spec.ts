/**
 * Kertas Subjektif page-image documents (V2 `paper_documents` / `paper_document_pages`, migration 0265), loaded by `migrate:papers` with
 * `--files-dir`. Synthetic documents and tiny synthetic images in a temp directory outside the repository (no real data).
 *
 * Cases: the header rules (kertas 2 to 4, title), the page rules (kind, position, parent, file checks), the V2 `published_at` kept, the
 * counts and the empty-document guard after the pages, idempotency, a V3 admin's Sembunyi kept by a second run, and the run without
 * `--files-dir` (headers load, pages are skipped and counted).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { finaliseDocuments, runPapers } from '../../../src/migration/load/papers'
import { kindOf, smallCountOf, yearOf } from '../../../src/migration/load/papers/documents-step'
import { makeJpeg, makePng } from '../../files/fixtures'
import { AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex')

let h: QuestionsHarness
let root = ''
let exportDir = ''
let env: Record<string, string> = {}

const P1 = makePng({ width: 3, height: 3, padTo: 600 })
const P2 = makePng({ width: 4, height: 4, padTo: 700 })
const S1 = makeJpeg()

const base = () => ({ pool: h.pool, env, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 2 })
const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)

beforeAll(async () => {
  h = await bootQuestions()
  root = mkdtempSync(join(tmpdir(), 'pp-docs-'))
  exportDir = join(root, 'export')
  mkdirSync(join(exportDir, 'paper-docs'), { recursive: true })
  env = { ...h.runEnv, FILE_STORAGE_DIR: join(root, 'storage') }
  writeFileSync(join(exportDir, 'paper-docs', 'p1.png'), P1)
  writeFileSync(join(exportDir, 'paper-docs', 'p2.png'), P2)
  writeFileSync(join(exportDir, 'paper-docs', 's1.jpg'), S1)
  writeFileSync(join(exportDir, 'SHA256SUMS'), [`${sha(P1)}  paper-docs/p1.png`, `${sha(P2)}  paper-docs/p2.png`, `${sha(S1)}  paper-docs/s1.jpg`, `${sha(P1)}  paper-docs/gone.png`].join('\n') + '\n')

  await sql(`delete from archive_cloud.paper_document_pages`)
  await sql(`delete from archive_cloud.paper_documents`)
  const doc = (id: number, o: { subject?: number | null; kertas?: string; title?: string | null; negeri?: string | null; year?: string | null; pages?: number; scheme?: number; published?: string | null }) =>
    sql(
      `insert into archive_cloud.paper_documents (id, subject_id, kertas, title, negeri, year, source_file, duration_minutes, marks_total, page_count, scheme_page_count, published_at, created_at, updated_at)
       values ($1, $2, $3, $4, $5, $6, $7, 150, 100, $8, $9, $10::timestamptz, '2025-02-01T00:00:00Z', '2025-02-02T00:00:00Z')`,
      [id, o.subject === undefined ? 1 : o.subject, o.kertas ?? '2', o.title === undefined ? `Kertas Contoh ${id}` : o.title, o.negeri === undefined ? 'Selangor' : o.negeri, o.year === undefined ? '2024' : o.year, `contoh/${id}.pdf`, o.pages ?? 0, o.scheme ?? 0, o.published === undefined ? null : o.published],
    )
  await doc(1, { pages: 2, scheme: 1, published: '2025-03-01T00:00:00Z' })
  await doc(2, { kertas: '3', pages: 1, published: '2025-03-01T00:00:00Z' }) // its only page file is missing
  await doc(3, { kertas: '9' }) // kertas out of range: rejected
  await doc(4, { title: null }) // no title: rejected
  await doc(5, { subject: null, kertas: '4', negeri: null, year: '1850' }) // no subject, junk year, Draf
  await doc(6, { subject: 9999, kertas: '2', published: null }) // subject that maps to nothing
  const page = (id: number, docId: number, kind: string, position: number, path: string | null) =>
    sql(`insert into archive_cloud.paper_document_pages (id, paper_document_id, kind, position, path, sha, width, height, created_at, updated_at) values ($1, $2, $3, $4, $5, 'x', 794, 1123, now(), now())`, [id, docId, kind, position, path])
  await page(11, 1, 'paper', 1, 'paper-docs/p1.png')
  await page(12, 1, 'paper', 2, 'paper-docs/p2.png')
  await page(13, 1, 'scheme', 1, 'paper-docs/s1.jpg')
  await page(21, 2, 'paper', 1, 'paper-docs/gone.png') // listed but not on disk
  await page(31, 5, 'cover', 1, 'paper-docs/p1.png') // bad kind
  await page(32, 5, 'paper', 0, 'paper-docs/p1.png') // bad position
  await page(33, 5, 'paper', 1, '../outside.png') // path refused
  await page(41, 777, 'paper', 1, 'paper-docs/p1.png') // parent absent
}, 600_000)

afterAll(async () => {
  await h?.close()
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('pure helpers', () => {
  it('reads the V2 text values safely', () => {
    expect(yearOf('2024')).toBe(2024)
    expect([yearOf('1850'), yearOf('x'), yearOf(null), yearOf('99999')]).toEqual([null, null, null, null])
    expect(kindOf(' Paper ')).toBe('paper')
    expect(kindOf('scheme')).toBe('scheme')
    expect([kindOf('cover'), kindOf(null)]).toEqual([null, null])
    expect([smallCountOf('12'), smallCountOf(null), smallCountOf('-3'), smallCountOf('99999')]).toEqual([12, 0, 0, 0])
  })
})

describe('without --files-dir', () => {
  it('loads the headers, skips the pages and counts them, and publishes nothing empty on its own', async () => {
    const dry = await runPapers({ ...base(), mode: 'dry-run' })
    expect(dry.report.status).toBe('succeeded')
    const apply = await runPapers({ ...base(), mode: 'apply' })
    expect(apply.report.status).toBe('succeeded')
    expect(await h.count('paper_documents', `t.legacy_source = 'cloud'`)).toBe(4)
    expect(await h.count('paper_document_pages')).toBe(0)
    expect(apply.questions.notes.counters.get('file_migration_off.paper_document_pages')).toBe(8)
    expect(apply.documents).toBeUndefined()
    // V2's published_at and counts stay as staged until the files are loaded
    const d1 = (await h.q<{ page_count: number; scheme_page_count: number; published: boolean }>(`select page_count, scheme_page_count, published_at is not null as published from paper_documents where legacy_id = '1'`))[0]
    expect(d1).toEqual({ page_count: 2, scheme_page_count: 1, published: true })
  })
})

describe('with --files-dir', () => {
  it('loads the pages with their files, recounts, and hides a document left with no page', async () => {
    const dry = await runPapers({ ...base(), mode: 'dry-run', filesDir: exportDir })
    expect(dry.report.status).toBe('succeeded')
    expect(await h.count('files', `t.purpose = 'kertas_page'`)).toBe(0) // a dry-run copies nothing
    const apply = await runPapers({ ...base(), mode: 'apply', filesDir: exportDir })
    expect(apply.report.status).toBe('succeeded')

    // headers: 6 staged, 2 rejected (kertas 9, no title)
    expect(await h.count('paper_documents', `t.legacy_source = 'cloud'`)).toBe(4)
    const rec = apply.report.recon.find((r) => r.entity === 'paper_documents')
    expect(rec).toMatchObject({ sourceCount: 6, loaded: 4, rejected: 2 })

    // pages: 3 loaded; the missing file, bad kind, bad position, refused path and the orphan are rejected
    expect(await h.count('paper_document_pages')).toBe(3)
    const files = await h.q<{ purpose: string; mime: string; legacy_id: string }>(`select purpose, mime, legacy_id from files where purpose = 'kertas_page' order by legacy_id`)
    expect(files.map((f) => f.legacy_id)).toEqual(['paper_document_pages.path:11', 'paper_document_pages.path:12', 'paper_document_pages.path:13'])
    expect(files.map((f) => f.mime)).toEqual(['image/png', 'image/png', 'image/jpeg'])
    const rejects = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where entity = 'paper_document_pages' and run_id = $1::bigint order by legacy_id::bigint`,
      [apply.report.runId],
    )
    expect(rejects.map((r) => [r.legacy_id, r.reason, r.column_name])).toEqual([
      ['21', 'INVALID_VALUE', 'path'],
      ['31', 'INVALID_VALUE', 'kind'],
      ['32', 'INVALID_VALUE', 'position'],
      ['33', 'INVALID_VALUE', 'path'],
      ['41', 'ORPHAN_PARENT', 'paper_document_id'],
    ])

    // the loaded document: order, sizes, subject and V2 publication kept
    const pages = await h.q<{ kind: string; position: number; width: number; height: number }>(
      `select p.kind, p.position, p.width, p.height from paper_document_pages p join paper_documents d on d.id = p.paper_document_id where d.legacy_id = '1' order by p.kind, p.position`,
    )
    expect(pages).toEqual([
      { kind: 'paper', position: 1, width: 794, height: 1123 },
      { kind: 'paper', position: 2, width: 794, height: 1123 },
      { kind: 'scheme', position: 1, width: 794, height: 1123 },
    ])
    const d = await h.q<{ legacy_id: string; subject_id: string | null; year: number | null; negeri: string | null; page_count: number; scheme_page_count: number; published: boolean; marks_total: number }>(
      `select legacy_id, subject_id::text, year, negeri, page_count, scheme_page_count, published_at is not null as published, marks_total from paper_documents where legacy_source = 'cloud' order by legacy_id::bigint`,
    )
    expect(d.map((x) => x.legacy_id)).toEqual(['1', '2', '5', '6'])
    expect(d[0]).toMatchObject({ page_count: 2, scheme_page_count: 1, published: true, marks_total: 100 })
    expect(d[0]?.subject_id).not.toBeNull()
    // doc 2: published in V2 but no page could be loaded: hidden, never published empty
    expect(d[1]).toMatchObject({ page_count: 0, scheme_page_count: 0, published: false })
    // doc 5: no subject, junk year, no negeri; doc 6: subject maps to nothing (header still loads, Draf)
    expect(d[2]).toMatchObject({ subject_id: null, year: null, negeri: null, published: false })
    expect(d[3]?.subject_id).toBeNull()
    expect(apply.documents).toEqual({ recounted: expect.any(Number), unpublishedEmpty: 1 })
    expect(apply.questions.notes.counters.get('paper_documents.hidden_without_pages')).toBe(1)
    expect(apply.questions.notes.counters.get('files.paper_document_pages.path.rejected.missing')).toBe(1)
  })

  it('is idempotent: a second run adds nothing, copies nothing and keeps a V3 admin\'s Sembunyi', async () => {
    const before = [await h.count('paper_documents'), await h.count('paper_document_pages'), await h.count('files', `t.purpose = 'kertas_page'`)]
    // a V3 admin hides document 1 after the load
    await sql(`update paper_documents set published_at = null where legacy_id = '1'`)
    const again = await runPapers({ ...base(), mode: 'apply', filesDir: exportDir })
    expect(again.report.status).toBe('succeeded')
    expect([await h.count('paper_documents'), await h.count('paper_document_pages'), await h.count('files', `t.purpose = 'kertas_page'`)]).toEqual(before)
    expect(await h.count('paper_documents', `t.legacy_id = '1' and t.published_at is null`)).toBe(1)
    expect(again.questions.notes.counters.get('files.paper_document_pages.path.copied') ?? 0).toBe(0)
  })

  it('finaliseDocuments is idempotent and only touches the source it is given', async () => {
    const first = await finaliseDocuments(h.pool, 'cloud')
    const second = await finaliseDocuments(h.pool, 'cloud')
    expect(first.unpublishedEmpty).toBe(0)
    expect(second).toEqual({ recounted: 0, unpublishedEmpty: 0 })
    expect(await finaliseDocuments(h.pool, 'my')).toEqual({ recounted: 0, unpublishedEmpty: 0 })
  })
})
