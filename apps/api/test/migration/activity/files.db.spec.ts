/**
 * BE-29 AC9 (BE-MIG-09): content files against a real PostgreSQL, with synthetic files in a temp directory outside the
 * repository. The only staged file column that has a v2 target is `banners.image_path` (-> `banners.image_file_id`).
 *
 * The export holds a SHA256SUMS manifest. Cases: a good copy and rewrite, a missing file, a checksum mismatch, a path
 * traversal, an absolute path, a symlinked file, a symlinked directory, a file the manifest does not list, a wrong type; no
 * manifest (refused), a directory inside the repository (refused); a second run copies nothing and changes nothing.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { AnyEntityStep } from '../../../src/migration/kit/runner'
import { contentGroup } from '../../../src/migration/load/activity/part-b'
import { migrateActivity } from '../../../src/migration/load/activity/command'
import { makeJpeg, makePdf, makePng } from '../../files/fixtures'
import { AS_OF, bootActivity, type ActivityHarness } from './helpers'

const sha = (b: Buffer | string): string => createHash('sha256').update(b).digest('hex')
const groups = [contentGroup]
const only = ['banners']

let h: ActivityHarness
let root = ''
let exportDir = ''
let storageDir = ''
let env: Record<string, string> = {}
const repoScratch: string[] = []

const A = makePng({ width: 2 })
const B = makeJpeg()
const PDF = makePdf()

const files = async (): Promise<{ id: string; legacy_id: string; purpose: string; mime: string; storage_key: string; sha256: string; public_id: string; size_bytes: string }[]> =>
  h.q(`select id::text, legacy_id, purpose, mime, storage_key, sha256, public_id, size_bytes::text from files where legacy_source = 'cloud' order by legacy_id`)

const objects = (): string[] => {
  const walk = (d: string): string[] =>
    existsSync(d) ? readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)])) : []
  return walk(storageDir).sort()
}

const opts = (extra: Record<string, unknown> = {}) => ({ groups, only, env, filesDir: exportDir, ...extra })

beforeAll(async () => {
  h = await bootActivity()
  root = mkdtempSync(join(tmpdir(), 'pp-ac9-'))
  exportDir = join(root, 'export')
  storageDir = join(root, 'storage')
  mkdirSync(join(exportDir, 'banners'), { recursive: true })
  env = { ...h.runEnv, FILE_STORAGE_DIR: storageDir }
  writeFileSync(join(root, 'outside.png'), A) // reachable only by traversal
  writeFileSync(join(exportDir, 'banners', 'a.png'), A)
  writeFileSync(join(exportDir, 'banners', 'b.jpg'), B)
  writeFileSync(join(exportDir, 'banners', 'bad.png'), makePng({ width: 3 }))
  writeFileSync(join(exportDir, 'banners', 'doc.png'), PDF)
  writeFileSync(join(exportDir, 'banners', 'unlisted.png'), A)
  symlinkSync(join(exportDir, 'banners', 'a.png'), join(exportDir, 'banners', 'link.png'))
  symlinkSync(join(exportDir, 'banners'), join(exportDir, 'linkdir'))
  const lines = [
    `${sha(A)}  banners/a.png`,
    `${sha(B)} *banners/b.jpg`,
    `${sha(A)}  banners/missing.png`,
    `${sha('something else')}  banners/bad.png`,
    `${sha(A)}  banners/link.png`,
    `${sha(A)}  linkdir/a.png`,
    `${sha(PDF)}  banners/doc.png`,
    `${sha(A)}  ../outside.png`,
    `${sha(A)}  /etc/passwd`,
  ]
  writeFileSync(join(exportDir, 'SHA256SUMS'), `${lines.join('\n')}\n`)

  const q = (sql: string) => h.env.pool.query(sql)
  for (const t of ['articles', 'banners', 'notes', 'videos', 'audio_kbat']) await q(`delete from staging_cloud.${t}`)
  const paths: Record<number, string | null> = {
    1: 'banners/a.png', 2: 'banners/b.jpg', 3: 'banners/missing.png', 4: 'banners/bad.png', 5: '../outside.png',
    6: '/etc/passwd', 7: 'banners/link.png', 8: 'banners/unlisted.png', 9: 'banners/doc.png', 10: null, 11: 'linkdir/a.png',
  }
  for (const [id, p] of Object.entries(paths)) {
    await h.env.pool.query(
      `insert into staging_cloud.banners (id, title, type, target, image_path, sort_order, is_active) values ($1, $2, 'hero', null, $3, 0, '1')`,
      [id, `Sepanduk ${id}`, p],
    )
  }
}, 600_000)

afterAll(async () => {
  await h?.close()
  if (root) rmSync(root, { recursive: true, force: true })
  for (const d of repoScratch) rmSync(d, { recursive: true, force: true })
})

describe('refusals before any work', () => {
  it('a directory without SHA256SUMS is refused (fail closed)', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'pp-ac9-empty-'))
    try {
      await expect(h.run('dry-run', opts({ filesDir: empty }))).rejects.toThrow(/SHA256SUMS/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })

  it('a malformed manifest line is refused', async () => {
    const d = mkdtempSync(join(tmpdir(), 'pp-ac9-bad-'))
    try {
      writeFileSync(join(d, 'SHA256SUMS'), 'not a checksum line\n')
      await expect(h.run('dry-run', opts({ filesDir: d }))).rejects.toThrow(/line 1 is not in sha256sum format/)
    } finally {
      rmSync(d, { recursive: true, force: true })
    }
  })

  it('a directory inside the repository, or one that holds it, is refused', async () => {
    const inside = resolve(process.cwd(), '.migration-out', `ac9-${process.pid}`)
    mkdirSync(inside, { recursive: true })
    repoScratch.push(inside)
    writeFileSync(join(inside, 'SHA256SUMS'), `${sha(A)}  a.png\n`)
    await expect(h.run('dry-run', opts({ filesDir: inside }))).rejects.toThrow(/outside the repository working tree/)
    await expect(h.run('dry-run', opts({ filesDir: resolve(process.cwd(), '..') }))).rejects.toThrow(/outside the repository working tree/)
  })

  it('a missing directory and a plain file are refused', async () => {
    await expect(h.run('dry-run', opts({ filesDir: join(root, 'nope') }))).rejects.toThrow(/existing, readable directory/)
    await expect(h.run('dry-run', opts({ filesDir: join(exportDir, 'SHA256SUMS') }))).rejects.toThrow(/existing, readable directory/)
  })

  it('an apply needs an absolute FILE_STORAGE_DIR outside the export', async () => {
    await h.run('dry-run', opts({ env: h.runEnv })) // a dry-run copies nothing and needs no storage
    await expect(h.run('apply', opts({ env: h.runEnv }))).rejects.toThrow(/FILE_STORAGE_DIR/)
    await expect(h.run('dry-run', opts({ env: { ...h.runEnv, FILE_STORAGE_DIR: join(exportDir, 'store') } }))).rejects.toThrow(/separate directories/)
    await expect(h.run('dry-run', opts({ env: { ...h.runEnv, FILE_STORAGE_DIR: 'relative/dir' } }))).rejects.toThrow(/absolute/)
  })
})

describe('without --files-dir', () => {
  it('references stay unset and the report says how many were not migrated', async () => {
    const lines: string[] = []
    const code = await migrateActivity.run(
      { mode: 'dry-run', flags: new Map([['group', 'content'], ['table', 'banners'], ['as-of', AS_OF], ['core-as-of', AS_OF]]), positional: [] },
      { pool: h.env.pool, env: h.runEnv, out: (l) => lines.push(l), err: (l) => lines.push(l) },
    )
    expect(code).toBe(0)
    expect(lines).toContain('files: not migrated (no --files-dir) 10 references')
    expect(await files()).toEqual([])
  })
})

describe('with --files-dir', () => {
  let dry: Awaited<ReturnType<ActivityHarness['run']>>
  let r1: Awaited<ReturnType<ActivityHarness['run']>>
  const rejected = async (runId: string): Promise<Record<string, string[]>> => {
    const rows = await h.q<{ legacy_id: string; reason: string; column_name: string }>(
      `select legacy_id, reason, column_name from etl_rejects where run_id = $1 and entity = 'banners' order by legacy_id::bigint`, [runId],
    )
    expect(new Set(rows.map((r) => `${r.reason}|${r.column_name}`))).toEqual(new Set(['INVALID_VALUE|image_path']))
    return { ids: rows.map((r) => r.legacy_id) }
  }

  it('a dry-run verifies everything and writes no object and no files row', async () => {
    dry = await h.run('dry-run', opts())
    expect(dry.report.status).toBe('succeeded')
    expect(await files()).toEqual([])
    expect(objects()).toEqual([])
    expect(dry.activity.notes.counters.get('files.banners.image_path.copied')).toBe(2)
  })

  it('a batch that fails after the copy leaves no object and no files row behind', async () => {
    const failAfterLoad = (steps: AnyEntityStep[]): AnyEntityStep[] =>
      steps.map((st) => ({
        ...st,
        async load(rows: never[], ctx: never) {
          await st.load(rows, ctx) // the files are copied here
          throw new Error('batch failed after the copy')
        },
      }))
    await expect(h.run('apply', opts({ transformSteps: failAfterLoad }))).rejects.toThrow(/batch failed after the copy/)
    expect(objects()).toEqual([])
    expect(await files()).toEqual([])
    expect(await h.count('banners')).toBe(0)
  })

  it('copies the good files, rewrites the reference, and rejects every bad one with no reference', async () => {
    r1 = await h.run('apply', opts())
    expect(r1.report.status).toBe('succeeded')
    expect((await rejected(r1.report.runId)).ids).toEqual(['3', '4', '5', '6', '7', '8', '9', '11'])
    const c = r1.activity.notes.counters
    expect(c.get('files.banners.image_path.copied')).toBe(2)
    expect(c.get('files.banners.image_path.present') ?? 0).toBe(0)
    expect(Object.fromEntries([...c].filter(([k]) => k.includes('.rejected.')))).toEqual({
      'files.banners.image_path.rejected.path': 2,
      'files.banners.image_path.rejected.unlisted': 1,
      'files.banners.image_path.rejected.missing': 1,
      'files.banners.image_path.rejected.checksum': 1,
      'files.banners.image_path.rejected.unsafe': 2,
      'files.banners.image_path.rejected.type': 1,
    })

    const banners = await h.q<{ legacy_id: string; image_file_id: string | null }>(`select legacy_id, image_file_id::text from banners order by legacy_id::bigint`)
    expect(banners.map((b) => b.legacy_id)).toEqual(['1', '2', '10']) // a rejected row is not loaded: no dangling reference
    const rows = await files()
    expect(rows.map((f) => f.legacy_id)).toEqual(['banners.image_path:1', 'banners.image_path:2'])
    expect(banners.find((b) => b.legacy_id === '1')?.image_file_id).toBe(rows[0]?.id)
    expect(banners.find((b) => b.legacy_id === '2')?.image_file_id).toBe(rows[1]?.id)
    expect(banners.find((b) => b.legacy_id === '10')?.image_file_id).toBeNull()
    expect(rows.map((f) => [f.purpose, f.mime])).toEqual([['cms_image', 'image/png'], ['cms_image', 'image/jpeg']])
    expect(rows[0]?.storage_key).toBe(`cms-image/${sha(A)}-banners-1.png`)
    expect(rows[1]?.storage_key).toBe(`cms-image/${sha(B)}-banners-2.jpg`)
    // The object is in the storage and the row describes the stored bytes.
    for (const f of rows) {
      const stored = readFileSync(join(storageDir, f.storage_key))
      expect(sha(stored)).toBe(f.sha256)
      expect(String(stored.length)).toBe(f.size_bytes)
      expect(f.public_id).toMatch(/^[A-Za-z0-9_-]{22}$/)
    }
    expect(objects()).toHaveLength(2)
  })

  it('never wrote a path, a name or file content to the rejects or the report notes', async () => {
    const text = JSON.stringify(await h.q(`select * from etl_rejects where entity = 'banners'`)) + JSON.stringify([...r1.activity.notes.counters])
    for (const needle of ['a.png', 'b.jpg', 'missing.png', 'bad.png', 'outside', '/etc/passwd', 'link.png', 'linkdir', 'unlisted.png', 'doc.png', 'banners/', root]) {
      expect(text, needle).not.toContain(needle)
    }
  })

  it('a second run copies nothing already present and changes nothing', async () => {
    const before = { files: await files(), hashes: await h.contentHashes(), mtimes: objects().map((o) => statSync(o).mtimeMs) }
    await h.run('dry-run', opts())
    const r2 = await h.run('apply', opts())
    expect(r2.report.status).toBe('succeeded')
    expect(r2.activity.notes.counters.get('files.banners.image_path.copied') ?? 0).toBe(0)
    expect(r2.activity.notes.counters.get('files.banners.image_path.present')).toBe(2)
    expect(await files()).toEqual(before.files) // same ids, same public ids
    expect(await h.contentHashes()).toEqual(before.hashes)
    expect(objects().map((o) => statSync(o).mtimeMs)).toEqual(before.mtimes)
    for (const row of r2.report.recon) expect(row.eligibleCount - row.loaded - row.rejected, row.entity).toBe(0)
  })

  it('a stored object that went missing is copied again under the same key (resume-safe), the row id is kept', async () => {
    const before = await files()
    rmSync(join(storageDir, before[0]?.storage_key as string))
    await h.run('dry-run', opts())
    const r3 = await h.run('apply', opts())
    expect(r3.activity.notes.counters.get('files.banners.image_path.copied')).toBe(1)
    expect(r3.activity.notes.counters.get('files.banners.image_path.present')).toBe(1)
    expect(await files()).toEqual(before)
    expect(objects()).toHaveLength(2)
  })

  it('the command prints the file summary line (counts only)', async () => {
    const lines: string[] = []
    const code = await migrateActivity.run(
      { mode: 'dry-run', flags: new Map([['group', 'content'], ['table', 'banners'], ['as-of', AS_OF], ['core-as-of', AS_OF], ['files-dir', exportDir]]), positional: [] },
      { pool: h.env.pool, env, out: (l) => lines.push(l), err: (l) => lines.push(l) },
    )
    expect(code).toBe(0)
    expect(lines).toContain('files: would copy (dry-run, nothing written) 0, already present 2, rejected 8; not migrated (no v2 target) 0 references')
    expect(lines.join('\n')).not.toContain(exportDir)
  })

  it('a changed source file gets a new key, and the replaced object is removed after the commit', async () => {
    const before = await files()
    const oldKey = before[0]?.storage_key as string
    const A2 = makePng({ width: 5 })
    writeFileSync(join(exportDir, 'banners', 'a.png'), A2)
    const sums = readFileSync(join(exportDir, 'SHA256SUMS'), 'utf8').replace(`${sha(A)}  banners/a.png`, `${sha(A2)}  banners/a.png`)
    writeFileSync(join(exportDir, 'SHA256SUMS'), sums)
    await h.run('dry-run', opts())
    const r = await h.run('apply', opts())
    expect(r.activity.notes.counters.get('files.banners.image_path.copied')).toBe(1)
    const after = await files()
    expect(after[0]?.id).toBe(before[0]?.id)
    expect(after[0]?.storage_key).toBe(`cms-image/${sha(A2)}-banners-1.png`)
    expect(existsSync(join(storageDir, oldKey))).toBe(false)
    expect(objects()).toHaveLength(2)
  })
})
