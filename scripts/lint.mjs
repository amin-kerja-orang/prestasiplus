// `npm run lint` / `npm run lint:fix`: runs ESLint, the design-system Stylelint and, last, the placeholder-string check
// (scripts/check-placeholders.mjs, card S0-T04; PLACEHOLDER_CHECK_MODE=report|fail is passed through from the environment).
// All three run every time (one failing does not hide the others), and the exit code is non-zero if any of them failed.
//
// Lint ratchet (S0-T04): ESLint and Stylelint errors are compared with `config/lint-baseline.json` (counts per file +
// rule). Only NEW errors fail (a count above the baseline, or a new file+rule pair). A tool crash (exit other than
// 0/1, e.g. 2 or OOM 134, or no JSON output) always fails. Warnings are never counted.
//   node scripts/lint.mjs [--fix]
//   node scripts/lint.mjs --update-baseline [--allow-grow]   rewrite the baseline from the current tree; refuses to
//                                                            grow any count (or add a pair) without --allow-grow
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SHRINK_HINT, compare, entryCount, eslintFindings, formatFailure, makeBaseline, stylelintFindings, updateCounts,
} from './lib/lint-ratchet.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const BASELINE = join(ROOT, 'config', 'lint-baseline.json')

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, env: process.env }).status ?? 1

/** Run one tool that writes JSON to `jsonFile`. Returns { findings } or { crash } (exit not 0/1, or unreadable JSON). */
function runTool(name, cmd, args, jsonFile, toFindings) {
  rmSync(jsonFile, { force: true })
  const code = run(cmd, args)
  if (code !== 0 && code !== 1) return { crash: `${name} crashed (exit ${code})` }
  if (!existsSync(jsonFile)) return { crash: `${name} produced no JSON output (exit ${code})` }
  try {
    return { findings: toFindings(JSON.parse(readFileSync(jsonFile, 'utf8')), ROOT) }
  } catch (e) {
    return { crash: `${name} JSON output unreadable: ${e.message}` }
  }
}

function main(argv) {
  const fix = argv.includes('--fix')
  const update = argv.includes('--update-baseline')
  const allowGrow = argv.includes('--allow-grow')
  const tmp = mkdtempSync(join(tmpdir(), 'lint-ratchet-'))
  const baseline = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {}

  const results = {
    eslint: runTool('eslint', 'npx', ['eslint', '.', '-f', 'json', '-o', join(tmp, 'eslint.json'), ...(fix ? ['--fix'] : [])],
      join(tmp, 'eslint.json'), eslintFindings),
    stylelint: runTool('stylelint', 'node',
      ['scripts/lint-ds-css.mjs', `--json-out=${join(tmp, 'stylelint.json')}`, ...(fix ? ['--fix'] : [])],
      join(tmp, 'stylelint.json'), stylelintFindings),
  }
  rmSync(tmp, { recursive: true, force: true })

  const crashes = Object.values(results).flatMap((r) => (r.crash ? [r.crash] : []))
  for (const c of crashes) console.error(`lint crash: ${c}`)

  if (update) {
    if (crashes.length) return 1
    const next = {}
    let refused = false
    for (const [tool, { findings }] of Object.entries(results)) {
      const u = updateCounts(baseline[tool], findings, { allowGrow })
      next[tool] = u.counts
      for (const f of u.refused) {
        refused = true
        console.error(`refused to grow baseline: ${formatFailure(tool, f)}`)
      }
    }
    if (refused) {
      console.error('baseline NOT written. Fix the new errors, or pass --allow-grow if growth is intended and approved.')
      return 1
    }
    writeFileSync(BASELINE, `${JSON.stringify(makeBaseline(next), null, 2)}\n`)
    console.log(`lint baseline written: eslint ${entryCount(next.eslint)} entries, stylelint ${entryCount(next.stylelint)} entries`)
    return 0
  }

  let failed = crashes.length > 0
  let shrinkable = 0
  for (const [tool, r] of Object.entries(results)) {
    if (r.crash) continue
    const cmp = compare(baseline[tool], r.findings)
    shrinkable += cmp.shrinks.length
    for (const f of cmp.failures) console.error(formatFailure(tool, f))
    if (!cmp.ok) failed = true
    console.log(
      `lint ${tool}: ${r.findings.length} error(s), ${cmp.failures.length} new pair(s) above baseline, ${cmp.shrinks.length} below baseline`,
    )
  }
  if (shrinkable) console.log(SHRINK_HINT)

  const placeholders = run('node', ['scripts/check-placeholders.mjs'])
  if (failed || placeholders)
    console.error(`lint failed: ratchet ${failed ? 'FAILED' : 'ok'}, placeholder check exit ${placeholders}`)
  return failed || placeholders ? 1 : 0
}

// Main guard: importing this file (tests) runs nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) process.exit(main(process.argv.slice(2)))
