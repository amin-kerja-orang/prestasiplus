/**
 * `migrate:terbit` (the Terbit pass as its own command, run with node from the API build) and the retired `--terbit` flag of `migrate:papers`.
 */
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { parseArgs } from '../../../src/migration/cli'
import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import { parsePapersArgs } from '../../../src/migration/load/papers/command'
import { parseTerbitArgs } from '../../../src/migration/load/papers/terbit-command'

const SLOT_OUT = '/app/apps/api/.migration-out'

describe('migrate:terbit arguments', () => {
  it('accepts the argv slot.sh produces (--apply and --out-dir)', () => {
    const prepared: string[] = []
    const { args } = parseArgs(['migrate:terbit', '--apply', '--out-dir', SLOT_OUT])
    expect(args.mode).toBe('apply')
    expect(parseTerbitArgs(args, (d) => (prepared.push(d), d)).outDir).toBe(resolve(SLOT_OUT))
    expect(prepared).toEqual([resolve(SLOT_OUT)])
  })

  it('refuses an unknown flag and a positional argument', () => {
    expect(() => parseTerbitArgs(parseArgs(['migrate:terbit', '--nope=1']).args, (d) => d)).toThrow(ApplyGuardError)
    expect(() => parseTerbitArgs({ mode: 'dry-run', flags: new Map(), positional: ['x'] }, (d) => d)).toThrow(/flags only/)
  })
})

describe('migrate:papers no longer takes --terbit', () => {
  it('points to migrate:terbit', () => {
    expect(() => parsePapersArgs(parseArgs(['migrate:papers', '--apply', '--terbit']).args, (d) => d)).toThrow(/migrate:terbit/)
  })
})
