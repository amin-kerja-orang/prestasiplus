// Runs Stylelint over the css/vue files in config/ds-strict.json (V2-T04). Exit 1 on any warning.
//   node scripts/lint-ds-css.mjs
import stylelint from 'stylelint'

import { readDsStrict, styleGlobs } from '../eslint/ds-strict.mjs'

const { strict, exempt } = readDsStrict()
const result = await stylelint.lint({
  files: styleGlobs(strict),
  // Tests and fixtures are not design-system code.
  ignorePattern: [...exempt, '**/__tests__/**'],
  allowEmptyInput: true,
  formatter: 'string',
})

if (result.report.trim()) console.log(result.report)
const files = result.results.filter((r) => !r.ignored).length
console.log(
  `lint:ds:css - ${files} strict css/vue file(s) checked, ${result.errored ? 'FAILED' : 'ok'}`,
)
process.exit(result.errored ? 1 : 0)
