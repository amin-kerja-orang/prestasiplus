// E2E traceability check (overview §12.2, ADR-0011; build-plan F-22).
//
// SRS side: every `docs/requirements/srs/Mxx-*.md` defines the ids `E2E-Mxx-nn` in the first column
// of the tables in its "## 12." section. It counts as approved when its header Status cell starts
// with "Approved". A row's provisional level comes from, in order: an `@provisional` suffix on the
// id cell; the table's "Provisional"/"Prov." column ("yes…" = provisional, empty/"no" = not); or,
// for tables without that column, a provisional marker at the start of the scenario
// (`**Provisional …**`, `(provisional …)`), with "provisional" elsewhere in the row meaning "partly
// provisional". Parsing lives in `scripts/lib/e2e-trace.mjs` (unit tests in
// `scripts/lib/__tests__/`).
//
// Test side: the test list from `playwright test --list --reporter=json` (no web server is started).
// A test traces the ids in its full title (describe titles included), counted once, not per project.
//
// Errors (exit 1):
// - S1 an id defined twice; S2 a §12 id cell containing `E2E-M` that does not parse;
// - T1 an id in a test title that no SRS defines;
// - T2 an id traced by more than one test;
// - T3 an approved id with no test, for every module with at least one traced id (developer smoke
//   specs carry no ids before G5); `--all` (G5) checks every approved module;
// - T4 a traced test without its module tag (`@m01` for `E2E-M01-…`);
// - P1 a `@provisional` test without a `provisional` annotation giving the reason
//   (use `provisional(reason)` from `e2e/support/tags.ts`);
// - P2 a test tracing a provisional row without `@provisional`;
// - P3 a `@provisional` test whose traced rows are all not provisional (it would hide observed
//   behaviour from `test:e2e:observed`).
// Warnings: W1 partly provisional row traced by an untagged test; W2 id from a non-approved SRS;
// S3 another module's id in an SRS id column; S4 an unrecognised provisional cell.
//
// Usage: node scripts/check-e2e-trace.mjs [--all] [--verbose]
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'

import { checkTrace, parseSrs } from './lib/e2e-trace.mjs'

const require = createRequire(import.meta.url)
const args = new Set(process.argv.slice(2))
const CHECK_ALL = args.has('--all')
const VERBOSE = args.has('--verbose')
const SRS_DIR = 'docs/requirements/srs'

/** @type {string[]} */
const errors = []
/** @type {string[]} */
const warnings = []

/** @returns {Map<string, import('./lib/e2e-trace.mjs').SrsId>} */
function readSrsIds() {
  const ids = new Map()
  for (const file of readdirSync(SRS_DIR).filter((f) => /^M\d{2}-.+\.md$/.test(f))) {
    const path = join(SRS_DIR, file).replaceAll('\\', '/')
    const parsed = parseSrs(readFileSync(path, 'utf8'), { file: path, module: file.slice(1, 3) })
    errors.push(...parsed.errors)
    warnings.push(...parsed.warnings)
    for (const row of parsed.ids) {
      const prev = ids.get(row.id)
      if (prev)
        errors.push(
          `S1 ${row.id} is defined in ${prev.file}:${prev.line} and ${row.file}:${row.line}`,
        )
      else ids.set(row.id, row)
    }
  }
  return ids
}

/** @returns {import('./lib/e2e-trace.mjs').TestEntry[]} */
function listTests() {
  const cli = require.resolve('@playwright/test/cli')
  const result = spawnSync(process.execPath, [cli, 'test', '--list', '--reporter=json'], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  let report
  try {
    report = JSON.parse(result.stdout)
  } catch {
    console.error('check-e2e-trace: could not read the Playwright test list.')
    console.error(result.stderr || result.stdout)
    process.exit(2)
  }
  if (report.errors?.length) {
    for (const e of report.errors) console.error(`check-e2e-trace: ${e.message ?? String(e)}`)
    process.exit(2)
  }

  const tests = new Map()
  const walk = (suite, titles) => {
    const path = suite.title && !suite.title.endsWith('.ts') ? [...titles, suite.title] : titles
    for (const spec of suite.specs ?? []) {
      const title = [...path, spec.title].join(' › ')
      const key = `${spec.file}:${spec.line}:${spec.column}:${title}`
      const entry = tests.get(key) ?? {
        key,
        title,
        file: spec.file,
        line: spec.line,
        tags: new Set(),
        provisionalReason: null,
      }
      for (const tag of spec.tags ?? []) entry.tags.add(String(tag).replace(/^@/, ''))
      for (const t of spec.tests ?? []) {
        for (const a of t.annotations ?? []) {
          if (a.type === 'provisional' && a.description) entry.provisionalReason = a.description
        }
      }
      tests.set(key, entry)
    }
    for (const child of suite.suites ?? []) walk(child, path)
  }
  for (const suite of report.suites ?? []) walk(suite, [])
  return [...tests.values()]
}

const srs = readSrsIds()
const tests = listTests()
const result = checkTrace({ srs, tests, all: CHECK_ALL })
errors.push(...result.errors)
warnings.push(...result.warnings)

const rows = [...srs.values()]
const approved = rows.filter((r) => r.approved)
console.log(
  `check-e2e-trace: ${rows.length} SRS ids (${approved.length} approved, ` +
    `${approved.filter((r) => r.provisional === 'full').length} provisional, ` +
    `${approved.filter((r) => r.provisional === 'partial').length} partly provisional); ` +
    `${tests.length} tests (${tests.filter((t) => t.tags.has('provisional')).length} @provisional); ` +
    `${result.traced} ids traced; modules started: ${
      [...result.started]
        .sort()
        .map((m) => `M${m}`)
        .join(', ') || 'none'
    }; ${result.missing} missing, ${result.notStarted} in modules not started` +
    `${CHECK_ALL ? '' : ' (not checked; --all checks them)'}.`,
)
if (VERBOSE || warnings.length <= 20) for (const w of warnings) console.warn(`warning: ${w}`)
else console.warn(`${warnings.length} warnings (--verbose lists them)`)
for (const e of errors) console.error(`error: ${e}`)
if (errors.length > 0) {
  console.error(`check-e2e-trace: ${errors.length} error(s).`)
  process.exit(1)
}
console.log('check-e2e-trace: OK')
