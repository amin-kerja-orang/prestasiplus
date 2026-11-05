/**
 * U-OP-03 verification for S4-T05 (DM-12 / DM-13, FR-X3-1, FR-X3-2): Tingkatan 1-5 are the only active
 * education levels. READ-ONLY: it never writes and has no `--apply`. Self-contained for now (DOC DEFECT
 * answer on #449); S4-T03 / S4-T08 move it onto `uat-ops/lib.ts` later.
 *
 *   DATABASE_URL=... npx tsx apps/api/scripts/uat-ops/check-levels.ts [--api-url https://host]
 *
 * One line per check, `PASS` / `FAIL` / `INFO` / `SKIP`; exit code 1 when any check FAILs, 2 on a usage error.
 * Checks: (1) no active primary (Darjah) level; (2) the public "Tahap" count (active, non-primary) is 5;
 * (3) with `--api-url`, the learner picker `GET /api/education-levels` (API-DSKP-01) returns no primary level;
 * (4) INFO only: the hard-coded level lists in the four known files (they belong to S4-T06 / S5-T01).
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

export interface LevelRow {
  code: string
  stage: string
  is_active: boolean
}

export interface CheckLine {
  status: 'PASS' | 'FAIL' | 'INFO' | 'SKIP'
  text: string
}

/** The expected public "Tahap" count: Tingkatan 1 to 5 (FR-X3-2). */
export const EXPECTED_TAHAP = 5

/** The four files with a frozen level list (reported, never failed: S4-T06 / S5-T01 own them). */
export const HARD_CODED_LEVEL_FILES = [
  'apps/api/src/modules/practice/rules.ts',
  'apps/api/src/modules/curriculum/rules.ts',
  'src/modules/m05-practice/components/dashboard/dashboard-lib.ts',
  'apps/api/src/modules/exam/builder/builder.repository.ts',
] as const

/** Checks 1 and 2 on the `education_levels` rows (pure: unit-tested with an in-memory 11-level fixture). */
export function checkLevelRows(rows: readonly LevelRow[]): CheckLine[] {
  const activePrimary = rows.filter((r) => r.is_active && r.stage === 'primary').map((r) => r.code)
  const tahap = rows.filter((r) => r.is_active && r.stage !== 'primary').length
  return [
    activePrimary.length === 0
      ? { status: 'PASS', text: 'no active Darjah level' }
      : { status: 'FAIL', text: `active Darjah levels: ${activePrimary.join(', ')} (deactivate them in Tahap Pendidikan, U-OP-03)` },
    tahap === EXPECTED_TAHAP
      ? { status: 'PASS', text: `public Tahap count = ${String(tahap)}` }
      : { status: 'FAIL', text: `public Tahap count = ${String(tahap)}, expected ${String(EXPECTED_TAHAP)}` },
  ]
}

/** Check 3 on the picker body (`{ data: [{ code, stage }] }`). */
export function checkPicker(body: unknown): CheckLine {
  const data = (body as { data?: unknown } | null)?.data
  if (!Array.isArray(data)) return { status: 'FAIL', text: 'GET /api/education-levels: no data array in the response' }
  const primary = data
    .filter((l): l is { code?: unknown; stage?: unknown } => typeof l === 'object' && l !== null)
    .filter((l) => l.stage === 'primary')
    .map((l) => String(l.code))
  return primary.length === 0
    ? { status: 'PASS', text: `GET /api/education-levels: ${String(data.length)} levels, none primary` }
    : { status: 'FAIL', text: `GET /api/education-levels returns primary levels: ${primary.join(', ')}` }
}

/** Check 4: the lines of the known files that still hold a frozen level list (INFO only). */
export function hardCodedLevelLines(repoRoot: string): CheckLine[] {
  const pattern = /\[\s*'(T[1-5]|TINGKATAN_[1-5])'/
  return HARD_CODED_LEVEL_FILES.map((file) => {
    let text: string
    try {
      text = readFileSync(resolve(repoRoot, file), 'utf8')
    } catch {
      return { status: 'INFO', text: `${file}: not found` }
    }
    const hits = text.split('\n').flatMap((line, i) => (pattern.test(line) ? [String(i + 1)] : []))
    return { status: 'INFO', text: hits.length ? `${file}: frozen level list at line ${hits.join(', ')} (S4-T06 / S5-T01)` : `${file}: no frozen level list` }
  })
}

export function parseArgs(argv: readonly string[]): { apiUrl: string | null } {
  let apiUrl: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--api-url') {
      const value = argv[++i]
      if (!value) throw new Error('--api-url needs a value')
      apiUrl = value.replace(/\/+$/, '')
    } else if (arg === '--apply') {
      throw new Error('check-levels is read-only: there is no --apply')
    } else {
      throw new Error(`unknown argument ${String(arg)}`)
    }
  }
  return { apiUrl }
}

async function main(): Promise<number> {
  let args: { apiUrl: string | null }
  try {
    args = parseArgs(process.argv.slice(2))
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e))
    return 2
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('DATABASE_URL is not set.')
    return 2
  }
  const client = new pg.Client({ connectionString: url })
  await client.connect()
  const lines: CheckLine[] = []
  try {
    // Read-only transaction: the script cannot write even by mistake.
    await client.query('BEGIN READ ONLY')
    const { rows } = await client.query<LevelRow>('SELECT code, stage, is_active FROM education_levels ORDER BY sort_order, id')
    await client.query('ROLLBACK')
    lines.push(...checkLevelRows(rows))
  } finally {
    await client.end()
  }
  if (args.apiUrl) {
    try {
      const res = await fetch(`${args.apiUrl}/api/education-levels`)
      lines.push(res.ok ? checkPicker(await res.json()) : { status: 'FAIL', text: `GET /api/education-levels answered ${String(res.status)}` })
    } catch (e) {
      lines.push({ status: 'FAIL', text: `GET /api/education-levels failed: ${e instanceof Error ? e.message : String(e)}` })
    }
  } else {
    lines.push({ status: 'SKIP', text: 'learner picker (pass --api-url to check GET /api/education-levels)' })
  }
  lines.push(...hardCodedLevelLines(resolve(fileURLToPath(new URL('.', import.meta.url)), '../../../..')))
  for (const l of lines) console.log(`${l.status} ${l.text}`)
  return lines.some((l) => l.status === 'FAIL') ? 1 : 0
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  void main().then((code) => process.exit(code))
}
