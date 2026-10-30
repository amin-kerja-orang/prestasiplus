/** Argument parsing of the K1 draft script (pure, tested). The message of a usage error never contains an argument value. */
import type { RunOptions } from './run'
import { K1_TARGETS } from './targets'

export class UsageError extends Error {}

export const USAGE = `Usage (run on the host, inside the migrate image; DATABASE_URL comes from the environment):
  npm run bijak:k1-drafts -w @pp/api -- [--apply] [--sets=1|2] [--subjects=MAT,SEJ,PHY,SN]
      [--sn-code=<paper code>] [--replace-blueprints] [--actor-id=<Admin Pusat user id>]

  Default is a DRY-RUN: it prints counts only and writes nothing. --apply creates the Spec blueprints (when missing) and
  DRAFT papers; it never publishes. Re-running creates nothing twice (drafts are found by their title or their questions).
  Sains has no paper code in the repo: pass --sn-code (or have a Sains K1 blueprint) or it is blocked.
  No password or token is read or accepted; the database is the one of DATABASE_URL.`

const KNOWN = new Set(['apply', 'sets', 'subjects', 'sn-code', 'replace-blueprints', 'actor-id', 'help'])
const SECRET_WORDS = /pass|secret|token|cookie|session|email|login/i

export function parseArgs(argv: readonly string[]): RunOptions | 'help' {
  const flags = new Map<string, string | true>()
  for (const arg of argv) {
    const m = /^--([a-z][a-z-]*)(?:=(.*))?$/.exec(arg)
    if (!m) throw new UsageError('Arguments are --flag or --flag=value only.')
    const name = m[1] as string
    if (SECRET_WORDS.test(name)) throw new UsageError('This script accepts no credential argument.')
    if (!KNOWN.has(name)) throw new UsageError(`Unknown flag --${name}.`)
    if (flags.has(name)) throw new UsageError(`--${name} given twice.`)
    flags.set(name, m[2] ?? true)
  }
  if (flags.has('help')) return 'help'
  const str = (name: string): string | undefined => {
    const v = flags.get(name)
    if (v === undefined) return undefined
    if (v === true || v === '') throw new UsageError(`--${name} needs a value.`)
    return v
  }
  const bool = (name: string): boolean => {
    const v = flags.get(name)
    if (v === undefined) return false
    if (v !== true) throw new UsageError(`--${name} takes no value.`)
    return true
  }

  const setsText = str('sets') ?? '2'
  if (setsText !== '1' && setsText !== '2') throw new UsageError('--sets must be 1 or 2.')

  const all = K1_TARGETS.map((t) => t.subject)
  const subjects = (str('subjects') ?? all.join(',')).split(',').map((s) => s.trim())
  if (subjects.some((s) => !all.includes(s)) || new Set(subjects).size !== subjects.length) {
    throw new UsageError(`--subjects must be a list of: ${all.join(', ')}.`)
  }

  const snCode = str('sn-code')
  if (snCode !== undefined && !/^[0-9A-Za-z]{2,10}\/[0-9]$/.test(snCode)) throw new UsageError('--sn-code must look like 1234/1.')
  const actorId = str('actor-id')
  if (actorId !== undefined && !/^[1-9][0-9]{0,17}$/.test(actorId)) throw new UsageError('--actor-id must be a user id (digits).')

  return { apply: bool('apply'), sets: Number(setsText), subjects, snCode, actorId, replaceBlueprints: bool('replace-blueprints') }
}
