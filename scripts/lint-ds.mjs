// Design-system strict lint only (V2-T04): ESLint then Stylelint over the files listed in
// config/ds-strict.json. `npm run lint` already includes both; this is the quick loop.
//   node scripts/lint-ds.mjs
//
// ESLint runs through its Node API, not a shell command: the strict list is a few hundred globs,
// far over the Windows `cmd` command-line limit (8191 characters) and awkward to quote per shell.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'

import { readDsStrict } from '../eslint/ds-strict.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { strict, exempt } = readDsStrict()

async function lintScripts() {
  const eslint = new ESLint({
    cwd: ROOT,
    warnIgnored: false,
    errorOnUnmatchedPattern: false,
    ignorePatterns: exempt,
  })
  const results = await eslint.lintFiles(strict.map((e) => e.glob))
  const formatter = await eslint.loadFormatter('stylish')
  const report = await formatter.format(results)
  if (report.trim()) console.log(report)
  const errors = results.reduce((n, r) => n + r.errorCount, 0)
  const warnings = results.reduce((n, r) => n + r.warningCount, 0)
  console.log(
    `lint:ds - ${results.length} strict file(s) checked by ESLint, ${errors} error(s), ${warnings} warning(s)`,
  )
  return errors > 0 ? 1 : 0
}

const eslintStatus = await lintScripts()
const cssStatus =
  spawnSync(process.execPath, ['scripts/lint-ds-css.mjs'], { cwd: ROOT, stdio: 'inherit' })
    .status ?? 1
process.exit(eslintStatus || cssStatus ? 1 : 0)
