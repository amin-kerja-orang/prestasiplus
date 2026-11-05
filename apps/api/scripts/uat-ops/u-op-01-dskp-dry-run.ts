/**
 * U-OP-01 wrapper for S4-T08 (PRD30 U-OP-01, `docs/ops/dskp-loader.md`): the DSKP loader as a DRY RUN, plus the counts per subject x level and
 * the verification SELECTs of the loader runbook. READ-ONLY and report-only: there is no `--apply`. The real load stays the loader's own command
 * (`npm run dskp:load -w @pp/api`), run by the UAT developer after the user approves this report (dry-run, report, approval, real run).
 *
 * Why a wrapper: the loader CLI's default is a REAL run (`cli.ts` parseArgs, `dryRun:false`); a bare `dskp:load` writes. This script never
 * calls the CLI: it calls `runDskpLoad(..., { dryRun: true })` with the flag fixed in code, `createMissingSubjects` off, and no argument can change either.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/u-op-01-dskp-dry-run.ts [--subject <code|file>[,<code|file>]] [--data-dir <folder>]
 *
 * Part 1, the loader dry run: one INFO line per subject x level (nodes insert / same / drift, TP descriptors insert / same); FAIL for a subject
 * that failed or a file not assigned to a subject. Part 2, read-only SELECTs inside `BEGIN READ ONLY`: the counts per offered subject x level (same
 * definition as API-DSKP-11 `repo.dskpReport`: `dimuatkan` when the pair has nodes, else `belum dimuatkan`; the latter is INFO, it lists what still needs
 * an extract) and the sanity checks, each PASS when 0: orphan parents, empty edition, TP outside 1-6, node levels outside T1-T5.
 * Choice: the runbook line "expected: T4, T5 only" is stale since S4-T09 (T1-T3 nodes arrive with the new extracts), so the level check is
 * "every node level is one of T1-T5" and the levels found are listed as INFO.
 * Output: counts, subject/level codes, file names and sha256 of the packaged extracts. No personal data, no connection string.
 * Exit code 0 ok, 1 a check FAILed, 2 usage or environment error.
 */
import type { Client } from 'pg'

import type { LoadReport } from '../../src/modules/curriculum/dskp/dskp-load'
import { exitCodeOf, formatLine, isMain, line, openDb, parseUatArgs, UsageError, writeReport, type CheckLine, type UatArgsSpec } from './lib'

export const SPEC: UatArgsSpec = {
  name: 'u-op-01-dskp-dry-run',
  allowApply: false,
  flags: { subject: { type: 'string' }, 'data-dir': { type: 'string' } },
}

/** The only levels a DSKP node may have (the loader drops Darjah units). */
export const NODE_LEVELS = ['T1', 'T2', 'T3', 'T4', 'T5'] as const

/** Part 1, pure: the loader report -> lines. */
export function loadLines(report: LoadReport): CheckLine[] {
  const out: CheckLine[] = []
  for (const s of report.subjects) {
    if (s.status === 'failed') {
      out.push(line('FAIL', `${s.code}: the dry run failed, nothing would be written (${s.error ?? 'no reason given'})`))
      continue
    }
    if (s.levels.length === 0) out.push(line('INFO', `${s.code}: no Tingkatan 1-5 rows in ${s.files.join(', ')}`))
    for (const l of s.levels) {
      out.push(
        line(
          'INFO',
          `${s.code} ${l.level}: nodes insert ${String(l.nodes.inserted)} / same ${String(l.nodes.unchanged)} / drift ${String(l.nodes.drift)}, TP descriptors insert ${String(l.tps.inserted)} / same ${String(l.tps.unchanged)}`,
        ),
      )
    }
    if (s.rejected.length > 0) out.push(line('INFO', `${s.code}: ${String(s.rejected.length)} TP rows rejected (skipped, counted)`))
  }
  for (const u of report.unassigned) out.push(line('FAIL', `${u.file}: not assigned to a subject (${u.error})`))
  const failed = report.subjects.filter((s) => s.status === 'failed').length
  const all = report.subjects.flatMap((s) => s.levels)
  const inserts = all.reduce((n, l) => n + l.nodes.inserted, 0)
  const tpInserts = all.reduce((n, l) => n + l.tps.inserted, 0)
  out.push(
    failed === 0 && report.unassigned.length === 0
      ? line('PASS', `loader dry run: ${String(report.subjects.length)} subjects from ${String(report.sources.length)} files, none failed`)
      : line('FAIL', `loader dry run: ${String(failed)} subjects failed, ${String(report.unassigned.length)} files unassigned`),
  )
  out.push(line('INFO', `would insert ${String(inserts)} nodes and ${String(tpInserts)} TP descriptors (0 on a second run after the real load)`))
  return out
}

/** One offered subject x level with its node counts (SQL below; same definition as `repo.dskpReport`). */
export interface CountRow {
  subject_code: string
  level_code: string
  nodes: number
  bab: number
  sk: number
  sp: number
  tp: number
  tp_general: number
}

export interface SanityResult {
  orphans: number
  emptyEdition: number
  tpOutside: number
  levels: string[]
}

export const COUNTS_SQL = `
  SELECT s.code AS subject_code, l.code AS level_code,
         COALESCE(n.total, 0)::int AS nodes, COALESCE(n.bab, 0)::int AS bab, COALESCE(n.sk, 0)::int AS sk, COALESCE(n.sp, 0)::int AS sp,
         (SELECT count(*) FROM curriculum_tp_descriptors d JOIN curriculum_nodes dn ON dn.id = d.node_id
           WHERE dn.subject_id = s.id AND dn.education_level_id = l.id)::int AS tp,
         (SELECT count(*) FROM curriculum_tp_descriptors g WHERE g.subject_id = s.id AND g.node_id IS NULL)::int AS tp_general
    FROM subject_levels sl
    JOIN subjects s ON s.id = sl.subject_id AND s.is_active
    JOIN education_levels l ON l.id = sl.education_level_id AND l.is_active AND l.stage <> 'primary'
    LEFT JOIN LATERAL (
      SELECT count(*) AS total, count(*) FILTER (WHERE c.kind = 'unit') AS bab,
             count(*) FILTER (WHERE c.kind = 'sk') AS sk, count(*) FILTER (WHERE c.kind = 'sp') AS sp
        FROM curriculum_nodes c WHERE c.subject_id = s.id AND c.education_level_id = l.id
    ) n ON true
   ORDER BY s.sort_order, s.id, l.sort_order, l.id`

/** The sanity SELECTs of `docs/ops/dskp-loader.md` (Verification), unchanged in meaning. */
export const SANITY_SQL = {
  orphans: `SELECT count(*)::int AS n FROM curriculum_nodes c WHERE parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM curriculum_nodes p WHERE p.id = c.parent_id)`,
  emptyEdition: `SELECT count(*)::int AS n FROM curriculum_nodes WHERE edition IS NULL OR edition = ''`,
  tpOutside: `SELECT count(*)::int AS n FROM curriculum_tp_descriptors WHERE tp NOT BETWEEN 1 AND 6`,
  levels: `SELECT DISTINCT l.code FROM curriculum_nodes n JOIN education_levels l ON l.id = n.education_level_id ORDER BY l.code`,
} as const

/** Part 2, pure: counts and sanity results -> lines. */
export function verificationLines(rows: readonly CountRow[], sanity: SanityResult): CheckLine[] {
  const out: CheckLine[] = []
  for (const r of rows) {
    out.push(
      r.nodes > 0
        ? line('INFO', `${r.subject_code} ${r.level_code}: dimuatkan, nodes ${String(r.nodes)} (Bab ${String(r.bab)}, SK ${String(r.sk)}, SP ${String(r.sp)}), TP descriptors ${String(r.tp)}, general TP ${String(r.tp_general)}`)
        : line('INFO', `${r.subject_code} ${r.level_code}: belum dimuatkan (no DSKP nodes yet)`),
    )
  }
  const loaded = rows.filter((r) => r.nodes > 0).length
  out.push(line('INFO', `${String(rows.length)} offered subject x level pairs: ${String(loaded)} dimuatkan, ${String(rows.length - loaded)} belum dimuatkan`))
  const zero = (n: number, what: string): CheckLine => (n === 0 ? line('PASS', `${what}: 0`) : line('FAIL', `${what}: ${String(n)}, expected 0`))
  out.push(zero(sanity.orphans, 'nodes whose parent is missing'))
  out.push(zero(sanity.emptyEdition, 'nodes with an empty edition'))
  out.push(zero(sanity.tpOutside, 'TP descriptors outside TP 1-6'))
  const stray = sanity.levels.filter((c) => !(NODE_LEVELS as readonly string[]).includes(c))
  out.push(
    stray.length === 0
      ? line('PASS', `node levels are within ${NODE_LEVELS.join(', ')}`)
      : line('FAIL', `nodes exist at levels outside ${NODE_LEVELS.join(', ')}: ${stray.join(', ')}`),
  )
  out.push(line('INFO', `levels with nodes: ${sanity.levels.length > 0 ? sanity.levels.join(', ') : 'none'}`))
  return out
}

/** Reads part 2 (call inside a read-only transaction). */
export async function collectVerification(client: Client): Promise<{ rows: CountRow[]; sanity: SanityResult }> {
  const rows = (await client.query<CountRow>(COUNTS_SQL)).rows
  const n = async (sql: string): Promise<number> => (await client.query<{ n: number }>(sql)).rows[0]?.n ?? 0
  const levels = (await client.query<{ code: string }>(SANITY_SQL.levels)).rows.map((r) => r.code)
  return {
    rows,
    sanity: { orphans: await n(SANITY_SQL.orphans), emptyEdition: await n(SANITY_SQL.emptyEdition), tpOutside: await n(SANITY_SQL.tpOutside), levels },
  }
}

/**
 * Part 1: the loader in dry-run mode. The flag is a literal; the loader and the Prisma client are imported here, not at the top, so a spec of the
 * pure parts above needs neither the generated client nor a database.
 */
export async function runLoaderDryRun(databaseUrl: string, opts: { only: string[]; dataDir: string | null }): Promise<LoadReport> {
  const { DSKP_DATA_DIR, readDskpSources, runDskpLoad } = await import('../../src/modules/curriculum/dskp/dskp-load')
  const { createPrismaClient } = await import('../../src/db/client')
  const sources = readDskpSources(opts.dataDir ?? DSKP_DATA_DIR)
  if (sources.length === 0) throw new UsageError('No *.json extract found in the data folder.')
  const prisma = createPrismaClient(databaseUrl)
  try {
    return await runDskpLoad(prisma, sources, { dryRun: true, only: opts.only, createMissingSubjects: false, now: new Date() })
  } finally {
    await prisma.$disconnect()
  }
}

async function main(): Promise<number> {
  const started = new Date()
  let db: Awaited<ReturnType<typeof openDb>> | undefined
  try {
    const args = parseUatArgs(process.argv.slice(2), SPEC)
    const only = typeof args.values.subject === 'string' ? args.values.subject.split(',').filter(Boolean) : []
    const dataDir = typeof args.values['data-dir'] === 'string' ? args.values['data-dir'] : null
    db = await openDb()
    const lines: CheckLine[] = [line('INFO', 'DRY RUN only: the loader runs with dryRun fixed to true; nothing is written')]
    lines.push(...loadLines(await runLoaderDryRun(process.env.DATABASE_URL as string, { only, dataDir })))
    const v = await db.readOnly((c) => collectVerification(c))
    lines.push(...verificationLines(v.rows, v.sanity))
    for (const l of lines) console.log(formatLine(l))
    console.log(`INFO report written: ${writeReport('u-op-01-dskp-dry-run', lines, { now: started })}`)
    return exitCodeOf(lines)
  } catch (e) {
    // Never print the connection string: a driver message can quote it, so the screen gets our own message, or only the error class and code.
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'unknown'
    console.error(e instanceof UsageError ? e.message : `DSKP dry run failed before it finished (${e instanceof Error ? e.name : 'error'}, code ${code}; no data was written).`)
    return 2
  } finally {
    await db?.close()
  }
}

if (isMain(import.meta.url)) void main().then((code) => process.exit(code))
