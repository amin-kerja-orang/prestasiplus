/**
 * `migrate:core` command defaults (no database): the Malaysia-day `--as-of` and the best-effort git sha of the ledger.
 */
import { describe, expect, it } from 'vitest'

import { FixedClock } from '../../../src/db/clock'
import { defaultAsOf } from '../../../src/migration/load/command'
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
