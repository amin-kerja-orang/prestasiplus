// Strict design-system lint of the Portal Pentadbiran with a ratchet (rules R1-R14).
//   node scripts/lint-admin.mjs                    check: fails on NEW violations only
//   node scripts/lint-admin.mjs --report           violation counts per migration batch / area / rule
//   node scripts/lint-admin.mjs --json             full result as JSON
//   node scripts/lint-admin.mjs --write-baseline   rewrite config/ds-admin-lint.baseline.json (only lowers)
//   node scripts/lint-admin.mjs --write-baseline --force   allow raising / first creation
// Rules: a file on an `enforce` glob (config/ds-strict.json) tolerates nothing. Any other scope file may
// not exceed its baseline count per rule; a file absent from the baseline tolerates nothing. The file
// list goes to ESLint through the Node API, so the Windows command-line limit never applies.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { ESLint } from 'eslint'

import { adminStrictConfig, readAdminStrict } from '../eslint/admin-strict.mjs'
import { matcher } from '../eslint/lib/glob.mjs'
import { isTestPath, walk } from './lib/admin-routes.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
export const BASELINE_FILE = 'config/ds-admin-lint.baseline.json'

/** Every file the strict admin lint covers (repo-relative). */
export function scopeFiles(cfg = readAdminStrict()) {
  const inScope = matcher(cfg.scope)
  const exempt = matcher(cfg.exempt)
  return walk('src')
    .filter((p) => /\.(vue|ts)$/.test(p) && !isTestPath(p) && inScope(p) && !exempt(p))
    .sort()
}

/** Lints the scope. @returns {Promise<{ files: string[], byFile: Record<string, Record<string, number>>, messages: Record<string, {rule: string, line: number, message: string}[]> }>} */
export async function runAdminLint(files = scopeFiles()) {
  const eslint = new ESLint({
    cwd: ROOT,
    overrideConfigFile: true,
    overrideConfig: adminStrictConfig(),
    errorOnUnmatchedPattern: false,
  })
  const byFile = {}
  const messages = {}
  const results = await eslint.lintFiles(files)
  for (const r of results) {
    const file = r.filePath.slice(ROOT.length).replaceAll('\\', '/')
    for (const m of r.messages) {
      const rule = m.ruleId ?? 'parse-error'
      byFile[file] ??= {}
      byFile[file][rule] = (byFile[file][rule] ?? 0) + 1
      ;(messages[file] ??= []).push({ rule, line: m.line, message: m.message })
    }
  }
  return { files, byFile, messages }
}

export function readBaseline() {
  return existsSync(`${ROOT}${BASELINE_FILE}`)
    ? JSON.parse(readFileSync(`${ROOT}${BASELINE_FILE}`, 'utf8')).files ?? {}
    : {}
}

/** Violations that fail the build: enforce files with any finding, others above their baseline. */
export function newViolations(result, baseline = readBaseline(), cfg = readAdminStrict()) {
  const enforced = matcher(cfg.enforce.map((e) => e.glob))
  const out = []
  for (const [file, rules] of Object.entries(result.byFile)) {
    for (const [rule, n] of Object.entries(rules)) {
      const allowed = enforced(file) ? 0 : (baseline[file]?.[rule] ?? 0)
      if (n > allowed) out.push({ file, rule, count: n, allowed })
    }
  }
  return out
}

/** Baseline entries that can shrink or be removed (file deleted, now clean, or lower count). */
export function staleBaseline(result, baseline = readBaseline()) {
  const out = []
  for (const [file, rules] of Object.entries(baseline))
    for (const [rule, n] of Object.entries(rules)) {
      const now = result.byFile[file]?.[rule] ?? 0
      if (now < n) out.push({ file, rule, was: n, now })
    }
  return out
}

/** Counts per area (first match in `adminAreas`) and per rule. */
export function report(result, cfg = readAdminStrict()) {
  const areas = cfg.areas.map((a) => ({ ...a, match: matcher(a.globs), files: 0, total: 0, rules: {} }))
  const enforcedBatches = new Set()
  const enforced = matcher(cfg.enforce.map((e) => e.glob))
  for (const f of result.files) {
    const a = areas.find((x) => x.match(f))
    if (!a) continue
    a.files++
    if (enforced(f)) enforcedBatches.add(a.batch)
    for (const [rule, n] of Object.entries(result.byFile[f] ?? {})) {
      a.total += n
      a.rules[rule] = (a.rules[rule] ?? 0) + n
    }
  }
  const byRule = {}
  for (const rules of Object.values(result.byFile))
    for (const [rule, n] of Object.entries(rules)) byRule[rule] = (byRule[rule] ?? 0) + n
  return { areas: areas.sort((x, y) => x.batch - y.batch), byRule, enforcedBatches: [...enforcedBatches] }
}

function formatReport(result, rep) {
  const lines = [`ds admin lint - ${result.files.length} files in scope`, '', 'Violations per batch area:']
  for (const a of rep.areas)
    lines.push(
      `  batch ${a.batch}  ${a.name.padEnd(48)} ${String(a.files).padStart(4)} files  ${String(a.total).padStart(6)} violations`,
    )
  const total = rep.areas.reduce((s, a) => s + a.total, 0)
  lines.push(`  total${' '.repeat(54)}${String(total).padStart(13)} violations`, '', 'Per rule:')
  for (const [rule, n] of Object.entries(rep.byRule).sort((a, b) => b[1] - a[1]))
    lines.push(`  ${rule.padEnd(36)} ${String(n).padStart(6)}`)
  return lines.join('\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = new Set(process.argv.slice(2))
  const result = await runAdminLint()
  const cfg = readAdminStrict()
  if (args.has('--write-baseline')) {
    const enforced = matcher(cfg.enforce.map((e) => e.glob))
    const files = {}
    for (const [f, rules] of Object.entries(result.byFile)) if (!enforced(f)) files[f] = rules
    const prev = readBaseline()
    if (existsSync(`${ROOT}${BASELINE_FILE}`) && !args.has('--force')) {
      const raised = []
      for (const [f, rules] of Object.entries(files))
        for (const [r, n] of Object.entries(rules))
          if (n > (prev[f]?.[r] ?? 0)) raised.push(`${f} ${r}: ${prev[f]?.[r] ?? 0} -> ${n}`)
      if (raised.length) {
        console.error(`Refusing to raise the baseline:\n  ${raised.join('\n  ')}`)
        process.exit(1)
      }
    }
    const sorted = Object.fromEntries(Object.entries(files).sort(([a], [b]) => a.localeCompare(b)))
    writeFileSync(
      `${ROOT}${BASELINE_FILE}`,
      `${JSON.stringify(
        {
          $comment:
            'Frozen violations of the strict Portal Pentadbiran lint (R1-R14), per file and rule. Generated by `npm run lint:admin:baseline`; may only shrink. Files on an `enforce` glob are never listed.',
          files: sorted,
        },
        null,
        2,
      )}\n`,
    )
    console.log(`Wrote ${BASELINE_FILE} (${Object.keys(sorted).length} files)`)
    console.log(formatReport(result, report(result, cfg)))
  } else if (args.has('--report')) {
    console.log(formatReport(result, report(result, cfg)))
  } else if (args.has('--json')) {
    console.log(JSON.stringify({ ...result, report: report(result, cfg) }, null, 2))
  } else {
    const bad = newViolations(result)
    for (const v of bad) {
      console.error(`${v.file}: ${v.rule} ${v.count} (allowed ${v.allowed})`)
      for (const m of (result.messages[v.file] ?? []).filter((m) => m.rule === v.rule).slice(0, 5))
        console.error(`    line ${m.line}: ${m.message}`)
    }
    const stale = staleBaseline(result)
    const total = Object.values(result.byFile).reduce(
      (s, r) => s + Object.values(r).reduce((a, b) => a + b, 0),
      0,
    )
    console.log(
      `admin lint: ${result.files.length} files, ${total} violations (baselined), ${bad.length} NEW` +
        (stale.length ? `; ${stale.length} baseline entries can shrink (npm run lint:admin:baseline)` : ''),
    )
    process.exit(bad.length ? 1 : 0)
  }
}
