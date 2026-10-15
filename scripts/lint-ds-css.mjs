// Runs Stylelint over the css/vue files in config/ds-strict.json, per level (V2-T04).
//   node scripts/lint-ds-css.mjs [--fix]      exit 1 on any warning
import stylelint from 'stylelint'

import { globsOf, readDsStrict, styleGlobs } from '../eslint/ds-strict.mjs'
import config, { dsConfig } from '../stylelint.config.mjs'

const fix = process.argv.includes('--fix')
const { strict, exempt } = readDsStrict()
let errored = false
let checked = 0

for (const [level, cfg] of [
  ['page', config],
  ['ds', dsConfig],
]) {
  const globs = globsOf(strict, level)
  if (!globs.length) continue
  const result = await stylelint.lint({
    files: styleGlobs(globs),
    config: cfg,
    // Tests and fixtures are not design-system code.
    ignorePattern: [...exempt, '**/__tests__/**'],
    allowEmptyInput: true,
    fix,
    formatter: 'string',
  })
  if (result.report.trim()) console.log(result.report)
  checked += result.results.filter((r) => !r.ignored).length
  errored ||= result.errored
}

console.log(`lint:ds:css - ${checked} strict css/vue file(s) checked, ${errored ? 'FAILED' : 'ok'}`)
process.exit(errored ? 1 : 0)
