// Design-system strict lint only (V2-T04): ESLint then Stylelint over the files listed in
// config/ds-strict.json. `npm run lint` already includes both; this is the quick loop.
//   node scripts/lint-ds.mjs
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { readDsStrict } from '../eslint/ds-strict.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { strict, exempt } = readDsStrict()

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1

const eslintStatus = run('npx', [
  'eslint',
  '--no-error-on-unmatched-pattern',
  '--no-warn-ignored',
  ...strict.map((g) => `"${g}"`),
  ...exempt.flatMap((g) => ['--ignore-pattern', `"${g}"`]),
])
const cssStatus = run('node', ['scripts/lint-ds-css.mjs'])
process.exit(eslintStatus || cssStatus ? 1 : 0)
