/**
 * `migrate:core` command defaults (no database): the Malaysia-day `--as-of` and the best-effort git sha of the ledger.
 */
import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../../src/db/clock'
import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import type { CliContext, CommandArgs } from '../../../src/migration/kit'
import { CORE_KNOWN_FLAGS, defaultAsOf, migrateCore } from '../../../src/migration/load/command'
import { resolveGitSha } from '../../../src/migration/load/git-sha'

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678'

describe('migrate:core default --as-of', () => {
  it('is the Malaysia calendar day, not the UTC day', () => {
    expect(defaultAsOf(new FixedClock('2026-10-21T17:00:00Z'))).toBe('2026-10-22')
    expect(defaultAsOf(new FixedClock('2026-10-21T15:59:59Z'))).toBe('2026-10-21')
    expect(defaultAsOf(new FixedClock('2026-10-21T16:00:00Z'))).toBe('2026-10-22')
  })
})

describe('resolveGitSha', () => {
  const noGit = (): string => {
    throw new Error('git must not be called')
  }

  it('prefers PP_GIT_SHA, then GIT_SHA, and never calls git then', () => {
    expect(resolveGitSha({ PP_GIT_SHA: SHA, GIT_SHA: 'deadbeef' }, noGit)).toBe(SHA)
    expect(resolveGitSha({ GIT_SHA: SHA.toUpperCase() }, noGit)).toBe(SHA)
  })

  it('ignores a value that is not a commit id and falls back to git', () => {
    expect(resolveGitSha({ GIT_SHA: 'not a sha; rm -rf /' }, () => `${SHA}\n`)).toBe(SHA)
  })

  it('reads git when no variable is set', () => {
    expect(resolveGitSha({}, () => `${SHA}\n`)).toBe(SHA)
  })

  it('gives null, never an error, when git is missing or answers with something else', () => {
    expect(resolveGitSha({}, () => { throw new Error('spawn git ENOENT') })).toBeNull()
    expect(resolveGitSha({}, () => 'fatal: not a git repository')).toBeNull()
  })
})

describe('migrate:core refuses unknown flags (ORCH-FLAGS)', () => {
  // No pool: a refusal must come before any database work, so touching ctx.pool would throw a different error.
  const ctx = { pool: undefined, env: {}, out: () => {}, err: () => {} } as unknown as CliContext
  const args = (flags: [string, string | true][], positional: string[] = []): CommandArgs => ({ mode: 'dry-run', flags: new Map(flags), positional })

  it('reads only --as-of and --batch-size', () => {
    expect([...CORE_KNOWN_FLAGS].sort()).toEqual(['as-of', 'batch-size'])
  })

  it.each([
    [[['asof', '2026-10-29']]],
    [[['asof', true]]],
    [[['as-of', '2026-10-29'], ['out-dir', '/x/.migration-out']]],
    [[['table', 'users']]],
  ] as [string, string | true][][][])('a misspelt or foreign flag is a usage error before any work: %j', async (flags) => {
    const name = flags.find(([n]) => !CORE_KNOWN_FLAGS.has(n))?.[0]
    await expect(migrateCore.run(args(flags), ctx)).rejects.toThrow(new ApplyGuardError(`unknown flag --${name}.`))
  })

  it('a stray positional (a one-dash -asof value) is a usage error', async () => {
    await expect(migrateCore.run(args([], ['2026-10-29']), ctx)).rejects.toThrow(ApplyGuardError)
  })
})
