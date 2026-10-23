/**
 * Shared boot of the BE-30 Part B DB specs (`migrate:verify`, rollback): the activity harness (private database, staging
 * loaded from the `cloud-tiny` fixture, seeds), then `migrate:core` and `migrate:activity` applied for real. The test
 * probe group of the activity helper is left out, so the run holds exactly the entities of the production registry.
 */
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { runCore } from '../../../src/migration/load'
import { ACTIVITY_GROUPS } from '../../../src/migration/load/activity'
import { AS_OF, bootActivity, PROBE_GROUP, type ActivityHarness } from '../activity/helpers'
import { REPO_ROOT } from '../staging/helpers'

export { AS_OF, REPO_ROOT, PROBE_GROUP }

/** A fresh folder under `<repo>/.migration-out` (git-ignored), which `prepareOutputDir` accepts. */
export function tempOutDir(): { path: string; cleanup(): void } {
  const root = join(REPO_ROOT, '.migration-out')
  mkdirSync(root, { recursive: true })
  const path = mkdtempSync(join(root, 'verify-test-'))
  return { path, cleanup: () => rmSync(path, { recursive: true, force: true }) }
}

export const realGroups = () => ACTIVITY_GROUPS.filter((g) => g !== PROBE_GROUP)

/** Core then activity, dry-run then apply each; throws when a run does not succeed. Returns the apply run ids. */
export async function migrateAll(h: ActivityHarness): Promise<string[]> {
  const base = { pool: h.env.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, batchSize: 2 }
  const ids: string[] = []
  for (const mode of ['dry-run', 'apply'] as const) {
    const core = await runCore({ ...base, mode })
    if (core.report.status !== 'succeeded') throw new Error(`core ${mode} did not succeed`)
    if (mode === 'apply') ids.push(core.report.runId)
  }
  for (const mode of ['dry-run', 'apply'] as const) {
    const act = await h.run(mode, { groups: realGroups() })
    if (act.report.status !== 'succeeded') throw new Error(`activity ${mode} did not succeed`)
    if (mode === 'apply') ids.push(act.report.runId)
  }
  return ids
}

/** Row count of every table that carries a legacy pair (by the catalogue, so a new table is covered). */
export async function legacyTableCounts(h: ActivityHarness): Promise<Record<string, number>> {
  const tables = await h.q<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'legacy_source' ORDER BY 1`,
  )
  const out: Record<string, number> = {}
  for (const { table_name: t } of tables) out[t] = await h.count(`"${t}"`)
  return out
}

export { bootActivity }
