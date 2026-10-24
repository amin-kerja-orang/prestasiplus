/**
 * Shared boot of the `migrate:activity` DB specs (BE-29): one private database, `staging_cloud` loaded from the
 * BE-35 synthetic fixture (`cloud-tiny`), the seeds a seeded environment has, BE-28 `migrate:core` applied, and
 * then the activity pipeline on top.
 *
 * `PROBE_GROUP` is a tiny group that lives only in tests. It exercises the shared machinery (id-map lookup,
 * rejects, batches, checkpoints, upsert) without depending on the real groups, which Parts A and B register in
 * `src/migration/load/activity/groups.ts`. The specs run the probe AND whatever the registry holds: with the
 * registry empty they test the framework, with groups registered they cover those steps too.
 */
import { createHash } from 'node:crypto'

import type pg from 'pg'

import { runSeeds } from '../../../prisma/seed'
import { schoolPackagesSeed } from '../../../prisma/seed/core/school-packages'
import { curriculumSeed } from '../../../prisma/seed/curriculum'
import { upsertByLegacy } from '../../../src/migration/kit'
import type { AnyEntityStep, BatchContext, BatchResult } from '../../../src/migration/kit/runner'
import { runCore } from '../../../src/migration/load'
import {
  ACTIVITY_GROUPS,
  runActivity,
  type ActivityGroup,
  type ActivityRunOptions,
  type ActivityRunResult,
} from '../../../src/migration/load/activity'
import { readById } from '../../../src/migration/load/source'
import { loadStaging } from '../../../src/migration/staging/load'
import { DirReader } from '../../../src/migration/staging/readers'
import { createStagingDb, FIXTURE_DIR, stagingEnv, testOutDir, type StagingDb } from '../staging/helpers'

export const AS_OF = '2026-06-01'
export const PROBE_ENTITY = 'act_probe_wallets'
export const PROBE_TABLE = 'act_probe'

/** Columns of the staging tables that hold personal data or free text in the fixture (the log and leak scans). */
export const PII_COLUMNS: Record<string, readonly string[]> = {
  users: ['name', 'email', 'phone', 'ic', 'username', 'bio', 'teaching_subject', 'teaching_qualification'],
  schools: ['name'],
  support_tickets: ['subject', 'admin_reply'],
  timeline_entries: ['title', 'body'],
  feedback: ['comment'],
  notes: ['title', 'body'],
}

export interface ActivityHarness {
  env: StagingDb
  /** Environment of the runs: test mode, an IC key and the apply switch. */
  runEnv: Record<string, string>
  q<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>
  count(table: string, where?: string): Promise<number>
  /** Row count and a content hash per legacy-keyed table; ids and timestamps excluded (see `contentHashes`). */
  contentHashes(): Promise<Record<string, string>>
  /** Runs the activity pipeline: the registry groups (the probe is registered by the boot). */
  run(mode: 'dry-run' | 'apply', extra?: Partial<ActivityRunOptions>): Promise<ActivityRunResult>
  close(): Promise<void>
}

/** The probe: copies `student_wallets` rows into `act_probe` (user must be mapped, balance must not be negative). */
export const PROBE_GROUP: ActivityGroup = {
  name: 'activity',
  notMigrated: [{ table: 'act_probe_source', reason: 'test probe' }],
  steps: (a): AnyEntityStep[] => [
    {
      entity: PROBE_ENTITY,
      source: 'cloud',
      extract: (afterKey) => readById(a.pool, 'student_wallets', afterKey, a.pageSize),
      keyOf: (row: Record<string, string | null>) => row.id as string,
      async load(rows: Record<string, string | null>[], ctx: BatchContext): Promise<BatchResult> {
        const users = await ctx.idMap.resolveMany('users', rows.map((r) => r.user_id).filter((v): v is string => v !== null))
        const good = []
        for (const r of rows) {
          const legacyId = r.id as string
          const user = r.user_id == null ? undefined : users.get(r.user_id)
          if (user === undefined) {
            ctx.rejects.add({ entity: PROBE_ENTITY, legacyId, reason: 'ORPHAN_PARENT', column: 'user_id' })
            continue
          }
          if (Number(r.syiling_balance) < 0) {
            ctx.rejects.add({ entity: PROBE_ENTITY, legacyId, reason: 'INVALID_VALUE', column: 'syiling_balance' })
            continue
          }
          good.push({ legacyId, values: { user_ref: user, balance: r.syiling_balance } })
        }
        const res = await upsertByLegacy(ctx.db, { table: PROBE_TABLE, source: ctx.source, columns: ['user_ref', 'balance'], rows: good })
        return { inserted: res.inserted, updated: res.updated, unchanged: res.unchanged }
      },
    },
  ],
}

const PROBE_DDL = `
  create table ${PROBE_TABLE} (
    id bigint generated always as identity primary key,
    user_ref bigint,
    balance bigint,
    created_at timestamptz not null default now(),
    legacy_source text,
    legacy_id text,
    legacy_hash text,
    constraint uq_${PROBE_TABLE}_legacy unique (legacy_source, legacy_id)
  )`

export interface BootOptions {
  /** Run `migrate:core` (dry-run then apply) before the activity specs. Default true. */
  core?: boolean
}

export async function bootActivity(options: BootOptions = {}): Promise<ActivityHarness> {
  // Registered in the real registry so the CLI and `runActivity` defaults see it too (vitest isolates modules per file).
  if (!ACTIVITY_GROUPS.includes(PROBE_GROUP)) ACTIVITY_GROUPS.push(PROBE_GROUP)
  const env = await createStagingDb()
  const runEnv = { NODE_ENV: 'test', IC_HASH_KEY: 'fixture-ic-key-0123456789', PP_ALLOW_MIGRATE_APPLY: '1' }
  await loadStaging(env.pool, new DirReader(FIXTURE_DIR), { env: stagingEnv(env.db) })
  await runSeeds([schoolPackagesSeed, curriculumSeed], { prisma: env.db.prisma })
  // Same preparation as the BE-28 DB spec: pupils get a class label and level 1 is named like a seeded level.
  await env.pool.query(`update staging_cloud.users set kelas = '4 Amanah' where role = 'pelajar'`)
  await env.pool.query(`update staging_cloud.education_levels set name_bm = 'Darjah 1' where id = 1`)
  await env.pool.query(PROBE_DDL)
  if (options.core !== false) {
    const dry = await runCore({ pool: env.pool, env: runEnv, source: 'cloud', asOf: AS_OF, mode: 'dry-run', batchSize: 2 })
    if (dry.report.status !== 'succeeded') throw new Error('BE-28 dry-run did not succeed in the activity test boot.')
    const applied = await runCore({ pool: env.pool, env: runEnv, source: 'cloud', asOf: AS_OF, mode: 'apply', batchSize: 2, outDir: testOutDir() })
    if (applied.report.status !== 'succeeded') throw new Error('BE-28 apply did not succeed in the activity test boot.')
  }

  const q = async <T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> =>
    (await env.pool.query(sql, params)).rows as T[]

  return {
    env,
    runEnv,
    q,
    async count(table, where = 'true') {
      return Number((await q<{ n: string }>(`select count(*)::text as n from ${table} t where ${where}`))[0]?.n)
    },
    contentHashes: () => contentHashes(env.pool),
    run: (mode, extra = {}) =>
      runActivity({
        pool: env.pool,
        env: runEnv,
        source: 'cloud',
        asOf: AS_OF,
        coreAsOf: AS_OF,
        mode,
        batchSize: 2,
        ...extra,
      }),
    close: () => env.close(),
  }
}

/**
 * Content hash per table that carries `(legacy_source, legacy_id)`: the rows as JSON without the primary key, the
 * timestamps and every target-minted `*_id` column that is not a foreign key (a sequence value differs when a
 * rolled-back batch burned one); `legacy_id` stays. A foreign key (a single-column `FOREIGN KEY` constraint) IS
 * compared, as the legacy id of the row it points at: through the referenced table's own `legacy_id`, else through
 * `etl_id_map` (entity = referenced table, `new_id` = the key). A key that resolves through neither is compared as
 * `unmapped` (null stays null), so a dropped or re-pointed key still changes the hash while a minted id never does.
 * Two databases that hold the same migrated rows give the same hash.
 */
export async function contentHashes(pool: pg.Pool): Promise<Record<string, string>> {
  const tables = await pool.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'legacy_source'
     INTERSECT
     SELECT table_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'legacy_id'
     ORDER BY 1`,
  )
  const withLegacyId = new Set(tables.rows.map((r) => r.table_name))
  const out: Record<string, string> = {}
  for (const { table_name: t } of tables.rows) {
    const fks = await pool.query<{ col: string; ref_table: string; ref_col: string }>(
      `SELECT a.attname AS col, rc.relname AS ref_table, ra.attname AS ref_col
       FROM pg_constraint c
       JOIN pg_class tc ON tc.oid = c.conrelid JOIN pg_namespace n ON n.oid = tc.relnamespace
       JOIN pg_class rc ON rc.oid = c.confrelid
       JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
       JOIN pg_attribute ra ON ra.attrelid = c.confrelid AND ra.attnum = c.confkey[1]
       WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1 AND n.nspname = 'public' AND tc.relname = $1
       ORDER BY 1`,
      [t],
    )
    const dropped = ['id', 'created_at', 'updated_at']
    const mapped = fks.rows.map((fk) => {
      dropped.push(fk.col)
      const viaTable = withLegacyId.has(fk.ref_table)
        ? `(SELECT r.legacy_id FROM "${fk.ref_table}" r WHERE r."${fk.ref_col}" = x."${fk.col}" AND r.legacy_source = 'cloud' LIMIT 1)`
        : 'NULL'
      const viaMap = `(SELECT m.legacy_id FROM etl_id_map m WHERE m.legacy_source = 'cloud' AND m.entity = '${fk.ref_table}' AND m.new_id = x."${fk.col}"::text LIMIT 1)`
      return `jsonb_build_object('fk:${fk.col}', CASE WHEN x."${fk.col}" IS NULL THEN NULL ELSE coalesce(${viaTable}, ${viaMap}, 'unmapped') END)`
    })
    const res = await pool.query<{ n: string; h: string }>(
      `SELECT count(*)::text AS n, coalesce(string_agg(j::text, '|' ORDER BY j::text), '') AS h FROM (
         SELECT (SELECT jsonb_object_agg(e.k, e.v) FROM jsonb_each(to_jsonb(x)) AS e(k, v)
                 WHERE (e.k <> ALL ($1::text[]) AND e.k !~ '_id$') OR e.k = 'legacy_id')
                ${mapped.map((m) => `|| ${m}`).join(' ')} AS j
         FROM "${t}" x WHERE x.legacy_source = 'cloud') s`,
      [dropped],
    )
    const row = res.rows[0] as { n: string; h: string }
    out[t] = `${row.n}:${createHash('md5').update(row.h).digest('hex')}`
  }
  return out
}
