import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * The repository-wide dump guard (.github/workflows/no-dumps.yml): its script is extracted from the
 * workflow and run with bash against a good tree and several bad trees in throw-away git repos.
 */
const WORKFLOW = fileURLToPath(new URL('../../../../../.github/workflows/no-dumps.yml', import.meta.url))
const yml = readFileSync(WORKFLOW, 'utf8')

function extractScript(): string {
  const lines = yml.split(/\r?\n/)
  const at = lines.findIndex((l) => /^\s+run: \|\s*$/.test(l))
  if (at === -1) throw new Error('no run block in no-dumps.yml')
  const indent = (lines[at + 1] as string).match(/^\s*/)?.[0].length ?? 0
  const body: string[] = []
  for (const l of lines.slice(at + 1)) {
    if (l.trim() !== '' && (l.match(/^\s*/)?.[0].length ?? 0) < indent) break
    body.push(l.slice(indent))
  }
  return body.join('\n')
}

const bash = spawnSync('bash', ['--version'], { encoding: 'utf8' })
const hasBash = bash.status === 0
const git = spawnSync('git', ['--version'], { encoding: 'utf8' })
const hasGit = git.status === 0

let work: string
let script: string
beforeAll(() => {
  work = mkdtempSync(join(tmpdir(), 'pp-nodumps-'))
  script = join(work, 'guard.sh')
  writeFileSync(script, extractScript(), { mode: 0o755 })
})
afterAll(() => rmSync(work, { recursive: true, force: true }))

let n = 0
/** A fresh repo with the given tracked files (name -> content), then the guard run in it. */
function guard(files: Record<string, string | Buffer>) {
  const repo = join(work, `repo${++n}`)
  mkdirSync(repo)
  const sh = (args: string[]) => spawnSync('git', args, { cwd: repo, encoding: 'utf8' })
  sh(['init', '-q'])
  writeFileSync(join(repo, 'README.md'), 'ok')
  for (const [name, content] of Object.entries(files)) {
    const path = join(repo, name)
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, content)
  }
  sh(['add', '-A', '-f'])
  const r = spawnSync('bash', [script], { cwd: repo, encoding: 'utf8' })
  return { status: r.status, text: `${r.stdout}${r.stderr}` }
}

describe.skipIf(!hasBash || !hasGit)('no-dumps workflow guard', () => {
  it('has no paths filter and runs on push and pull_request', () => {
    expect(yml).toMatch(/^on:\s*\n\s+push:\s*\n\s+pull_request:/m)
    expect(yml).not.toMatch(/^\s*paths(-ignore)?:/m)
    expect(yml).toMatch(/actions\/checkout@v4\.2\.2/)
  })

  it('passes a clean tree, including a small file and an allow-listed large file', () => {
    const r = guard({ 'src/a.ts': 'export {}', 'docs/a.md': 'text' })
    expect(r.status, r.text).toBe(0)
    const big = guard({ 'packages/contract/openapi.json': Buffer.alloc(1_100_000, 0x61) })
    expect(big.status, big.text).toBe(0)
  })

  it.each([
    'db/prod.dump',
    'backup/x.sql.gz',
    'a/old.bak',
    'a/old.backup',
    'a/x.pgdump',
    'a/x.tar',
    'a/x.tar.gz',
    'a/x.tgz',
    'a/UPPER.DUMP',
    '.migration-out/report.json',
    'apps/api/.migration-out/rejects.csv',
  ])('fails on %s', (name) => {
    const r = guard({ [name]: 'x' })
    expect(r.status, r.text).toBe(1)
    expect(r.text).toContain(name)
  })

  it('fails on a pg_dump custom-format file under an innocent name, and on a large file not in the allowlist', () => {
    const pg = guard({ 'data/seed.dat': Buffer.concat([Buffer.from('PGDMP'), Buffer.alloc(100, 1)]) })
    expect(pg.status, pg.text).toBe(1)
    expect(pg.text).toMatch(/PGDMP/)
    const big = guard({ 'assets/huge.json': Buffer.alloc(1_100_000, 0x61) })
    expect(big.status, big.text).toBe(1)
    expect(big.text).toMatch(/over 1 MB/)
    // exactly at the limit is fine
    expect(guard({ 'assets/limit.json': Buffer.alloc(1_048_576, 0x61) }).status).toBe(0)
  })
})
