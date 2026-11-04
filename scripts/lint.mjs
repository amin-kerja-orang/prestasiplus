// `npm run lint` / `npm run lint:fix`: runs ESLint, the design-system Stylelint and, last, the placeholder-string check
// (scripts/check-placeholders.mjs, card S0-T04; PLACEHOLDER_CHECK_MODE=report|fail is passed through from the environment).
// All three run every time (one failing does not hide the others), and the exit code is non-zero if any of them failed.
//   node scripts/lint.mjs [--fix]
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const fix = process.argv.includes('--fix')
const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true, env: process.env }).status ?? 1

const eslint = run('npx', ['eslint', '.', ...(fix ? ['--fix'] : [])])
const css = run('node', ['scripts/lint-ds-css.mjs', ...(fix ? ['--fix'] : [])])
const placeholders = run('node', ['scripts/check-placeholders.mjs'])
if (eslint || css || placeholders)
  console.error(`lint failed: eslint exit ${eslint}, stylelint exit ${css}, placeholder check exit ${placeholders}`)
process.exit(eslint || css || placeholders ? 1 : 0)
