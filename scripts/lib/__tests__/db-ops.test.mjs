// Unit tests of the BE-33 backup helpers (`scripts/lib/db-ops.mjs`): the outside-repo guard, argument
// parsing, the docker exec target, owner-only file modes and retention. Pure filesystem work in
// os.tmpdir(); docker is never invoked.
import {
  mkdirSync, mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, symlinkSync, utimesSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import {
  DIR_MODE, FILE_MODE, FILE_PREFIX, FILE_SUFFIX, OpsError, REPO_ROOT, applyRetention, assertOutsideRepo,
  ensureBackupDir, execTarget, humanSize, openPartialDump, parseArgs, timestamp, writeShaFile,
} from '../db-ops.mjs'

const isWin = process.platform === 'win32'
const mode = (p) => statSync(p).mode & 0o777

let root
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'pp-dbops-test-'))
})
afterAll(() => {
  rmSync(root, { recursive: true, force: true })
})

let seq = 0
const fresh = () => {
  const d = join(root, `case-${++seq}`)
  mkdirSync(d, { recursive: true })
  return d
}

describe('assertOutsideRepo', () => {
  it('refuses the repo root itself', () => {
    expect(() => assertOutsideRepo(REPO_ROOT)).toThrow(OpsError)
  })

  it('refuses an existing path inside the repo with exit code 3', () => {
    let err
    try {
      assertOutsideRepo(join(REPO_ROOT, 'scripts'))
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(OpsError)
    expect(err.exitCode).toBe(3)
    expect(err.message).toMatch(/inside the repository/)
  })

  it('refuses a not-yet-existing path inside the repo', () => {
    expect(() => assertOutsideRepo(join(REPO_ROOT, 'does-not-exist-yet', 'backups'))).toThrow(OpsError)
  })

  it('refuses a path that reaches the repo through ".." segments', () => {
    expect(() => assertOutsideRepo(join(REPO_ROOT, 'scripts', '..', 'backups'))).toThrow(OpsError)
  })

  it('refuses a symlink in os.tmpdir() that points into the repo', () => {
    const link = join(fresh(), 'link-to-repo')
    try {
      symlinkSync(join(REPO_ROOT, 'scripts'), link, isWin ? 'junction' : 'dir')
    } catch (e) {
      if (isWin) return // junction creation can still be denied on locked-down Windows hosts
      throw e
    }
    expect(() => assertOutsideRepo(link)).toThrow(OpsError)
    // A not-yet-existing child below the symlink resolves into the repo too.
    expect(() => assertOutsideRepo(join(link, 'new-backups'))).toThrow(OpsError)
  })

  it('accepts an existing plain directory outside the repo and returns its real path', () => {
    const d = fresh()
    expect(assertOutsideRepo(d)).toBe(realpathSync(d))
  })

  it('accepts a non-existent path outside the repo (nearest ancestor resolved, tail appended)', () => {
    const d = fresh()
    const target = join(d, 'not', 'yet', 'created')
    expect(assertOutsideRepo(target)).toBe(join(realpathSync(d), 'not', 'yet', 'created'))
  })
})

describe('parseArgs', () => {
  it('parses --key value, --key=value and bare flags', () => {
    expect(parseArgs(['--dir', '/x', '--keep=30', '--max-age-days', '60', '--keep-db'])).toEqual({
      dir: '/x',
      keep: '30',
      'max-age-days': '60',
      'keep-db': true,
    })
  })

  it('treats a flag followed by another flag as bare', () => {
    expect(parseArgs(['--container', '--keep', '3'])).toEqual({ container: true, keep: '3' })
  })

  it('returns an empty object for no arguments', () => {
    expect(parseArgs([])).toEqual({})
  })

  it('rejects a positional argument with exit code 2', () => {
    let err
    try {
      parseArgs(['--dir', '/x', 'stray'])
    } catch (e) {
      err = e
    }
    expect(err).toBeInstanceOf(OpsError)
    expect(err.exitCode).toBe(2)
  })
})

describe('execTarget', () => {
  const saved = process.env.DB_CONTAINER
  afterEach(() => {
    if (saved === undefined) delete process.env.DB_CONTAINER
    else process.env.DB_CONTAINER = saved
  })

  it('uses docker exec into the named container with --container', () => {
    delete process.env.DB_CONTAINER
    expect(execTarget({ container: 'c1' })).toEqual({
      label: 'container c1',
      base: ['docker', 'exec', '-i', 'c1'],
    })
  })

  it('falls back to DB_CONTAINER when --container is absent', () => {
    process.env.DB_CONTAINER = 'envbox'
    expect(execTarget({}).base).toEqual(['docker', 'exec', '-i', 'envbox'])
  })

  it('--container wins over DB_CONTAINER', () => {
    process.env.DB_CONTAINER = 'envbox'
    expect(execTarget({ container: 'flagbox' }).label).toBe('container flagbox')
  })

  it('defaults to the compose db service of this repo', () => {
    delete process.env.DB_CONTAINER
    const t = execTarget({})
    expect(t.label).toBe('compose service db')
    expect(t.base).toEqual([
      'docker', 'compose', '-f', join(REPO_ROOT, 'compose.yaml'), '--project-directory', REPO_ROOT, 'exec', '-T', 'db',
    ])
  })
})

describe('timestamp and humanSize', () => {
  it('formats a UTC compact timestamp', () => {
    expect(timestamp(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('20260102T030405Z')
  })

  it('formats sizes with binary units', () => {
    expect(humanSize(512)).toBe('512 B')
    expect(humanSize(1536)).toBe('1.5 KiB')
    expect(humanSize(5 * 1024 ** 2)).toBe('5.0 MiB')
    expect(humanSize(3 * 1024 ** 3)).toBe('3.00 GiB')
  })
})

describe('backup file modes (BE-33: personal data of minors, owner-only)', () => {
  it('declares 0700 for the directory and 0600 for files', () => {
    expect(DIR_MODE).toBe(0o700)
    expect(FILE_MODE).toBe(0o600)
  })

  it.skipIf(isWin)('creates the backup directory (and parents) as 0700', () => {
    const dir = join(fresh(), 'a', 'backups')
    ensureBackupDir(dir)
    expect(mode(dir)).toBe(0o700)
  })

  it.skipIf(isWin)('writes the partial dump file as 0600', async () => {
    const dir = fresh()
    const partial = join(dir, `${FILE_PREFIX}x${FILE_SUFFIX}.partial`)
    const out = openPartialDump(partial)
    await new Promise((res) => out.end('PGDMP'.padEnd(120, 'x'), res))
    expect(mode(partial)).toBe(0o600)
  })

  it.skipIf(isWin)('writes the .sha256 sidecar as 0600 with "<sha>  <name>\\n"', () => {
    const dir = fresh()
    const name = `${FILE_PREFIX}20260102T030405Z${FILE_SUFFIX}`
    const finalPath = join(dir, name)
    const sha = 'a'.repeat(64)
    writeShaFile(finalPath, sha, name)
    expect(mode(`${finalPath}.sha256`)).toBe(0o600)
    expect(readFileSync(`${finalPath}.sha256`, 'utf8')).toBe(`${sha}  ${name}\n`)
  })
})

describe('applyRetention', () => {
  const DAY = 86400
  const nowSec = () => Date.now() / 1000
  /** Create a dump (+ sidecar) whose mtime is `ageDays` old. */
  const dump = (dir, label, ageDays) => {
    const f = `${FILE_PREFIX}${label}${FILE_SUFFIX}`
    writeFileSync(join(dir, f), 'x'.repeat(10))
    writeFileSync(join(dir, `${f}.sha256`), 'y'.repeat(10))
    const t = nowSec() - ageDays * DAY
    utimesSync(join(dir, f), t, t)
    return f
  }
  const names = (dir) => readdirSync(dir).sort()

  it('keeps the newest N dumps and removes the older ones with their sidecars', () => {
    const dir = fresh()
    const f1 = dump(dir, '1', 1)
    const f2 = dump(dir, '2', 2)
    const f3 = dump(dir, '3', 3)
    const f4 = dump(dir, '4', 4)
    const r = applyRetention(dir, 2, 0)
    expect(r).toEqual({ kept: 2, removed: [f3, f4] })
    expect(names(dir)).toEqual([f1, `${f1}.sha256`, f2, `${f2}.sha256`].sort())
  })

  it('keeps everything when the count is within --keep and age limit is off', () => {
    const dir = fresh()
    dump(dir, '1', 400)
    dump(dir, '2', 800)
    expect(applyRetention(dir, 14, 0)).toEqual({ kept: 2, removed: [] })
    expect(readdirSync(dir)).toHaveLength(4)
  })

  it('also removes dumps older than --max-age-days', () => {
    const dir = fresh()
    const f1 = dump(dir, '1', 1)
    const f2 = dump(dir, '2', 5)
    const f3 = dump(dir, '3', 40)
    const r = applyRetention(dir, 10, 30)
    expect(r).toEqual({ kept: 2, removed: [f3] })
    expect(names(dir)).toEqual([f1, `${f1}.sha256`, f2, `${f2}.sha256`].sort())
  })

  it('never deletes the newest dump, even when it is older than the age limit', () => {
    const dir = fresh()
    const f1 = dump(dir, '1', 90)
    const f2 = dump(dir, '2', 100)
    const r = applyRetention(dir, 1, 30)
    expect(r).toEqual({ kept: 1, removed: [f2] })
    expect(names(dir)).toEqual([f1, `${f1}.sha256`])
  })

  it('touches only pp-backup-*.dump files', () => {
    const dir = fresh()
    const newest = dump(dir, 'new', 1)
    const old = dump(dir, 'old', 50)
    const bystanders = [
      'notes.txt',
      'other.dump', // wrong prefix
      `${FILE_PREFIX}z.dump.partial`, // in-flight partial
      `${FILE_PREFIX}z.txt`, // wrong suffix
      `${FILE_PREFIX}orphan.dump.sha256`, // sidecar without a matching dump entry
    ]
    for (const b of bystanders) {
      writeFileSync(join(dir, b), 'x'.repeat(10))
      const t = nowSec() - 500 * DAY
      utimesSync(join(dir, b), t, t)
    }
    const r = applyRetention(dir, 1, 30)
    expect(r).toEqual({ kept: 1, removed: [old] })
    expect(names(dir)).toEqual([...bystanders, newest, `${newest}.sha256`].sort())
  })

  it('returns an empty result for an empty directory', () => {
    expect(applyRetention(fresh(), 14, 0)).toEqual({ kept: 0, removed: [] })
  })
})
