/**
 * The restricted output of `migrate:core` (Q11): legacy ids of accounts that need a person to look at them (a NULL
 * password hash, or flagged for a reset but left with no username and no e-mail). These are ids of real people, so they
 * are NOT aggregate data: they go only to this file (mode 0600, `wx`, never replacing a file or writing through a link)
 * and never to stdout, `etl_*` rows or the recon report. Same custody as `deleted-at-source-*.json` of
 * `verify/render.ts`: keep it in `.migration-out/` (git-ignored), never commit or attach it, delete it within 7 days
 * (runbook, real-data custody rule).
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { prepareOutputDir } from '../profile'

export const DEFAULT_OUT_DIR = join(fileURLToPath(new URL('../../../../../', import.meta.url)), '.migration-out')

/** Writes the non-empty id lists of `CoreNotes.restricted`; returns the path, or undefined when there is nothing to write. */
export function writeRestrictedIds(
  restricted: ReadonlyMap<string, readonly string[]>,
  meta: { runId: string; generatedAt: string; interrupted?: boolean },
  outDir: string = DEFAULT_OUT_DIR,
): string | undefined {
  const lists = Object.fromEntries([...restricted].filter(([, ids]) => ids.length > 0).sort(([a], [b]) => (a < b ? -1 : 1)))
  if (Object.keys(lists).length === 0) return undefined
  const dir = prepareOutputDir(outDir)
  const stamp = meta.generatedAt.replace(/\.\d+Z$/, 'Z').replace(/[-:TZ]/g, '').slice(0, 14)
  const file = join(dir, `core-login-gaps-${stamp}-${randomBytes(4).toString('hex')}.json`)
  const body = { generatedAt: meta.generatedAt, runId: meta.runId, ...(meta.interrupted ? { interrupted: true } : {}), ids: lists }
  writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
  return file
}
