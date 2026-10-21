/**
 * Drift collector (v2-data-migration.md section 5 "derived data drift", card AC3 and AC4): the places where a
 * figure computed in v2 differs from the .cloud figure, or where .cloud data disagrees with itself (wallet vs
 * ledger, recomputed streak vs stored streak, ...). Parts A and B push entries; the command prints them and may
 * write them to a report file.
 *
 * Only counts and surrogate ids are ever stored. A kind is a code (`wallet_ledger_mismatch`), never text from
 * the data; an id passes `assertSurrogateLegacyId` (no e-mail, no 10-digit run).
 */
import { existsSync, lstatSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'

import { assertSurrogateLegacyId } from '../../kit/sql'
import { prepareOutputDir } from '../../profile'

const KIND = /^[a-z][a-z0-9_.:]{0,62}$/
const MAX_IDS_PRINTED = 200

export class DriftCollector {
  private readonly counts = new Map<string, number>()
  private readonly ids = new Map<string, string[]>()

  /** Counts `n` drifting rows of `kind` (no ids). */
  add(kind: string, n = 1): void {
    this.assertKind(kind)
    if (!Number.isInteger(n) || n < 0) throw new RangeError('DriftCollector.add: n must be a non-negative integer.')
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + n)
  }

  /** Counts one drifting row of `kind` and remembers its surrogate id (a v2 user id or a .cloud primary key). */
  addId(kind: string, id: string): void {
    this.assertKind(kind)
    assertSurrogateLegacyId(id, 'DriftCollector.addId')
    const list = this.ids.get(kind) ?? []
    list.push(id)
    this.ids.set(kind, list)
    this.counts.set(kind, (this.counts.get(kind) ?? 0) + 1)
  }

  get size(): number {
    return this.counts.size
  }

  count(kind: string): number {
    return this.counts.get(kind) ?? 0
  }

  idsOf(kind: string): readonly string[] {
    return this.ids.get(kind) ?? []
  }

  private assertKind(kind: string): void {
    if (!KIND.test(kind)) throw new RangeError('DriftCollector: a kind must be a lower-case code such as "wallet_ledger_mismatch".')
  }

  /** `drift <kind>: <n>` plus `drift ids <kind>: a,b,c` lines, sorted by kind. */
  lines(): string[] {
    const out: string[] = []
    for (const [kind, n] of [...this.counts].sort(([a], [b]) => (a < b ? -1 : 1))) {
      out.push(`drift ${kind}: ${n}`)
      const ids = this.ids.get(kind)
      if (ids && ids.length > 0) {
        out.push(`drift ids ${kind}: ${ids.slice(0, MAX_IDS_PRINTED).join(',')}${ids.length > MAX_IDS_PRINTED ? ',...' : ''}`)
      }
    }
    return out
  }

  /** Prints the lines through `out` (the CLI context writer). */
  print(out: (line: string) => void): void {
    for (const l of this.lines()) out(l)
  }
}

/**
 * Writes report lines to `file`, which must sit in a `.migration-out` folder (git-ignored) under the working
 * directory or the repository root. A symbolic link at the target is refused. Returns the written path.
 */
export function writeReportFile(file: string, lines: readonly string[]): string {
  const wanted = resolve(file)
  const dir = prepareOutputDir(dirname(wanted))
  const target = join(dir, basename(wanted))
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new RangeError('The report file is a symbolic link; refusing to write through it.')
  }
  writeFileSync(target, `${lines.join('\n')}\n`, { encoding: 'utf8', mode: 0o600 })
  return target
}
