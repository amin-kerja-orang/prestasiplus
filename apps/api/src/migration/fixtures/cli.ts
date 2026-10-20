/**
 * `fixtures:generate --size tiny|small|medium --seed N [--out <dir>]` (BE-35). Writes SYNTHETIC data only.
 *
 * Output location: a directory inside a `.migration-out` folder (default
 * `.migration-out/fixtures/<size>-<seed>`), or a directory under `apps/api/test/migration/fixtures/`
 * (the committed tiny sample). In the committed tree no file may be over 1 MB (BE-NFR-13). A non-empty
 * output directory is only reused when its `manifest.json` says `"synthetic": true`; then only the files
 * this tool writes are replaced.
 *
 * Exit codes: 0 ok, 1 failed, 2 usage.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prepareOutputDir } from '../profile'
import { FIXTURE_SIZES, fixtureFiles, generateFixture, SIZE_SPECS, type FixtureSize } from './generate'

export const FIXTURE_EXIT = { ok: 0, failed: 1, usage: 2 } as const
export const MAX_COMMITTED_FILE_BYTES = 1_000_000

export class FixtureUsageError extends Error {}
export class FixtureOutputError extends Error {}

const COMMITTED_ROOT = fileURLToPath(new URL('../../../test/migration/fixtures/', import.meta.url))

const real = (p: string): string => {
  try {
    return realpathSync.native(p)
  } catch {
    return resolve(p)
  }
}
const isInside = (child: string, parent: string): boolean => {
  const rel = relative(parent, child)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** Writes the fixture into `outDir` (see the module comment for what is allowed). Returns the file names written. */
export function writeFixture(size: FixtureSize, seed: number, outDir: string): string[] {
  const wanted = resolve(outDir)
  const committed = isInside(real(wanted), real(COMMITTED_ROOT))
  const fixture = generateFixture(size, seed)
  const files = fixtureFiles(fixture)
  if (committed) {
    for (const [name, content] of files) {
      if (Buffer.byteLength(content, 'utf8') > MAX_COMMITTED_FILE_BYTES) {
        throw new FixtureOutputError(`"${name}" would be over 1 MB; files under apps/api/test/migration/ must stay small. Use size tiny there, or write to .migration-out.`)
      }
    }
  }
  const dir = committed ? wanted : prepareOutputDir(wanted)
  mkdirSync(dir, { recursive: true })
  const existing = readdirSync(dir)
  if (existing.length > 0) {
    const manifestPath = join(dir, 'manifest.json')
    let synthetic = false
    try {
      synthetic = existsSync(manifestPath) && (JSON.parse(readFileSync(manifestPath, 'utf8')) as { synthetic?: unknown }).synthetic === true
    } catch {
      synthetic = false
    }
    if (!synthetic) throw new FixtureOutputError('The output directory is not empty and is not a synthetic fixture. Use a new directory.')
    for (const name of existing) if (/^[a-z][a-z0-9_]*\.ndjson$|^manifest\.json$|^anomalies\.json$/.test(name)) rmSync(join(dir, name), { force: true })
  }
  for (const [name, content] of files) writeFileSync(join(dir, name), content, { encoding: 'utf8', flag: 'wx' })
  return [...files.keys()]
}

export function runFixturesCli(argv: readonly string[], deps: { out?: (l: string) => void; err?: (l: string) => void } = {}): number {
  const out = deps.out ?? ((l: string) => console.log(l))
  const err = deps.err ?? ((l: string) => console.error(l))
  try {
    const flags = new Map<string, string>()
    for (let i = 0; i < argv.length; i++) {
      const token = argv[i] as string
      if (token === 'fixtures:generate') continue
      if (!token.startsWith('--')) throw new FixtureUsageError('Unexpected argument.')
      const eq = token.indexOf('=')
      const name = eq === -1 ? token.slice(2) : token.slice(2, eq)
      const value = eq === -1 ? argv[++i] : token.slice(eq + 1)
      if (value === undefined || value.startsWith('--') || value === '') throw new FixtureUsageError(`--${name.replace(/[^a-z-]/g, '')} needs a value.`)
      flags.set(name, value)
    }
    for (const name of flags.keys()) if (!['size', 'seed', 'out'].includes(name)) throw new FixtureUsageError('Unknown flag.')
    const size = flags.get('size') as FixtureSize | undefined
    if (!size || !FIXTURE_SIZES.includes(size)) throw new FixtureUsageError('Give --size tiny, small or medium.')
    const seedText = flags.get('seed') ?? '1'
    if (!/^\d{1,10}$/.test(seedText) || Number(seedText) > 0xffffffff) throw new FixtureUsageError('--seed must be an integer from 0 to 4294967295.')
    const seed = Number(seedText)
    const target = resolve(flags.get('out') ?? join('.migration-out', 'fixtures', `${size}-${seed}`))
    const files = writeFixture(size, seed, target)
    out(`Wrote the ${size} fixture (seed ${seed}, ${SIZE_SPECS[size].users} users): ${files.length} files in ${target}. Synthetic data only.`)
    return FIXTURE_EXIT.ok
  } catch (e) {
    if (e instanceof FixtureUsageError) {
      err(e.message)
      return FIXTURE_EXIT.usage
    }
    err(`fixtures:generate failed: ${e instanceof Error ? e.message : 'unexpected error'}`)
    return FIXTURE_EXIT.failed
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runFixturesCli(process.argv.slice(2))
}
