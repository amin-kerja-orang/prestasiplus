import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { afterAll, describe, expect, it } from 'vitest'

const SCRIPT = fileURLToPath(new URL('../../../scripts/rehearsal/mig07-make-delta.mjs', import.meta.url))
const TINY_DIR = fileURLToPath(new URL('./tiny/', import.meta.url))
const INSIDE_REPO = fileURLToPath(new URL('../../../.migration-out/mig07-delta-must-not-exist', import.meta.url))

const tmp = mkdtempSync(join(tmpdir(), 'pp-mig07-delta-'))
afterAll(() => rmSync(tmp, { recursive: true, force: true }))

const run = (src: string, dst: string, ...extra: string[]) => spawnSync(process.execPath, [SCRIPT, src, dst, ...extra], { encoding: 'utf8' })
const ndjson = (dir: string, t: string) => readFileSync(join(dir, `${t}.ndjson`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l) as Record<string, unknown>)
const manifestOf = (dir: string) => JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { tables: Record<string, { rows: number; file: string }> }

describe('mig07-make-delta.mjs', () => {
  it('writes a fresh SHA256SUMS (sha256sum format, sorted, every file but itself), mode 0700 dir and 0600 files', () => {
    const dst = join(tmp, 'ok')
    const r = run(TINY_DIR, dst)
    expect(r.status, r.stderr).toBe(0)
    const names = readdirSync(dst)
    expect(names).toContain('SHA256SUMS')
    expect(names).toContain('manifest.json')
    expect(names).not.toContain('anomalies.json') // the source's one would be stale
    const lines = readFileSync(join(dst, 'SHA256SUMS'), 'utf8').split('\n')
    expect(lines.pop()).toBe('') // ends with a newline
    const listed = lines.map((l) => {
      const m = /^([0-9a-f]{64})  (\S.*)$/.exec(l)
      expect(m, l).not.toBeNull()
      return [(m as RegExpExecArray)[1], (m as RegExpExecArray)[2]] as [string, string]
    })
    const sorted = names.filter((n) => n !== 'SHA256SUMS').sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    expect(listed.map(([, n]) => n)).toEqual(sorted)
    for (const [hash, name] of listed) expect(hash === createHash('sha256').update(readFileSync(join(dst, name))).digest('hex'), name).toBe(true)
    // The rewritten manifest's row counts are the real line counts of every table file, and the changed tables moved.
    const m = manifestOf(dst)
    const before = manifestOf(TINY_DIR)
    for (const [t, e] of Object.entries(m.tables)) if (existsSync(join(dst, `${t}.ndjson`))) expect(ndjson(dst, t).length, t).toBe(e.rows) // a table with no file keeps the source's entry
    expect(m.tables.users.rows).toBe(before.tables.users.rows + 100) // +100 added, none of the ids 17000-17049 exists in tiny
    expect(m.tables.schools.rows).toBe(before.tables.schools.rows + 5)
    expect(m.tables.practice_sessions.rows).toBe(before.tables.practice_sessions.rows + 500)
    expect(m.tables.coin_transactions.rows).toBe(before.tables.coin_transactions.rows + 300)
    expect(m.tables.questions.rows).toBe(before.tables.questions.rows) // untouched
    // Not the source's checksum file (the delta changes data, so the hashes of the changed tables differ).
    expect(readFileSync(join(dst, 'SHA256SUMS'), 'utf8')).not.toBe(readFileSync(join(TINY_DIR, 'SHA256SUMS'), 'utf8'))
    if (process.platform !== 'win32') {
      expect(statSync(dst).mode & 0o777).toBe(0o700)
      for (const n of names) expect(statSync(join(dst, n)).mode & 0o777, n).toBe(0o600)
    }
  })

  it('refuses an output directory inside the repository (exit 2, nothing written)', () => {
    const r = run(TINY_DIR, INSIDE_REPO)
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/inside the repository/)
    expect(existsSync(INSIDE_REPO)).toBe(false)
  })

  it('refuses an output directory that reaches the repository through a symlink (exit 2, nothing written)', () => {
    if (process.platform === 'win32') return
    const link = join(tmp, 'link-into-repo')
    symlinkSync(dirname(SCRIPT), link) // the scripts directory is inside the repository
    const r = run(TINY_DIR, join(link, 'new-delta-must-not-exist'))
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/inside the repository/)
    expect(existsSync(join(dirname(SCRIPT), 'new-delta-must-not-exist'))).toBe(false)
  })

  it('refuses when no .git ancestor is found (exit 2, nothing written)', () => {
    const lone = join(tmp, 'no-git')
    mkdirSync(lone)
    const copy = join(lone, 'mig07-make-delta.mjs')
    copyFileSync(SCRIPT, copy)
    const out = join(tmp, 'no-git-out')
    const r = spawnSync(process.execPath, [copy, TINY_DIR, out], { encoding: 'utf8' })
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/no \.git ancestor/)
    expect(existsSync(out)).toBe(false)
  })

  it('--delete <table>=<n> removes n more rows (highest ids, never an admin user) and keeps the manifest in step', () => {
    const base = join(tmp, 'plain')
    expect(run(TINY_DIR, base).status).toBe(0)
    const dst = join(tmp, 'breach')
    const r = run(TINY_DIR, dst, '--delete', 'users=40', '--delete=coin_transactions=5')
    expect(r.status, r.stderr).toBe(0)
    const plainUsers = ndjson(base, 'users')
    const users = ndjson(dst, 'users')
    expect(users.length).toBe(plainUsers.length - 40)
    const gone = plainUsers.filter((u) => !users.some((k) => k.id === u.id))
    expect(gone).toHaveLength(40)
    const minGone = Math.min(...gone.map((u) => u.id as number))
    const sourceIds = new Set(ndjson(TINY_DIR, 'users').map((u) => u.id))
    expect(gone.every((u) => sourceIds.has(u.id))).toBe(true) // rows the run itself added are never picked
    expect(users.filter((u) => (u.id as number) > minGone).every((u) => u.role === 'admin' || !sourceIds.has(u.id))).toBe(true) // above the cut: only admins and added rows
    expect(users.some((u) => u.role === 'admin')).toBe(true)
    expect(gone.every((u) => u.role !== 'admin')).toBe(true)
    const m = manifestOf(dst)
    expect(m.tables.users.rows).toBe(users.length)
    expect(m.tables.coin_transactions.rows).toBe(ndjson(base, 'coin_transactions').length - 5)
    const summary = JSON.parse(r.stdout) as Record<string, { extraDeleted?: number; after: number }>
    expect(summary.users.extraDeleted).toBe(40)
    expect(summary.users.after).toBe(users.length)
    // SHA256SUMS is written after the deletion, so it matches the files.
    for (const l of readFileSync(join(dst, 'SHA256SUMS'), 'utf8').split('\n').filter(Boolean)) {
      const [hash, name] = l.split('  ') as [string, string]
      expect(hash === createHash('sha256').update(readFileSync(join(dst, name))).digest('hex'), name).toBe(true)
    }
  })

  it('--delete refuses a bad value, an unknown table, too many rows and an unknown option (exit 2, nothing written)', () => {
    const cases: [string[], RegExp][] = [
      [['--delete', 'users=0'], /positive integer/],
      [['--delete', 'users'], /positive integer/],
      [['--delete', 'no_such_table=1'], /no such table/],
      [['--delete', 'users=100000'], /eligible rows/],
      [['--frobnicate'], /unknown option/],
    ]
    cases.forEach(([args, re], i) => {
      const out = join(tmp, `bad-delete-${i}`)
      const r = run(TINY_DIR, out, ...args)
      expect(r.status, args.join(' ')).toBe(2)
      expect(r.stderr).toMatch(re)
      expect(existsSync(out)).toBe(false)
    })
  })

  it('refuses a non-empty output directory and a source that is not synthetic', () => {
    const full = join(tmp, 'full')
    expect(run(TINY_DIR, full).status).toBe(0)
    const again = run(TINY_DIR, full)
    expect(again.status).toBe(2)
    expect(again.stderr).toMatch(/not empty/)

    const real = join(tmp, 'not-synthetic')
    expect(run(TINY_DIR, real).status).toBe(0)
    const manifest = JSON.parse(readFileSync(join(real, 'manifest.json'), 'utf8')) as Record<string, unknown>
    manifest.synthetic = false
    writeFileSync(join(real, 'manifest.json'), JSON.stringify(manifest))
    const r = run(real, join(tmp, 'from-not-synthetic'))
    expect(r.status).toBe(2)
    expect(r.stderr).toMatch(/synthetic/)
  })
})
