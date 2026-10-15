// `npm run lint` / `npm run lint:fix`: runs ESLint and the design-system Stylelint, both every
// time (one failing does not hide the other), and exits non-zero if either failed.
//   node scripts/lint.mjs [--fix]
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const fix = process.argv.includes('--fix')
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1

const eslint = run('npx', ['eslint', '.', ...(fix ? ['--fix'] : [])])
const css = run('node', ['scripts/lint-ds-css.mjs', ...(fix ? ['--fix'] : [])])
if (eslint || css) console.error(`lint failed: eslint exit ${eslint}, stylelint exit ${css}`)
process.exit(eslint || css ? 1 : 0)
