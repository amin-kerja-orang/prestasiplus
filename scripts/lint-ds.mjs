// Design-system strict lint only (V2-T04): ESLint over the files listed in config/ds-strict.json, the
// design-system Stylelint, and the strict Portal Pentadbiran ratchet (scripts/lint-admin.mjs).
// `npm run lint` already covers ESLint and Stylelint; this is the quick loop.
//   node scripts/lint-ds.mjs
// The file list goes to ESLint through the Node API (not as ~200 CLI globs), so it works on Windows
// (command-line limit) and on Linux CI alike.
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { ESLint } from 'eslint'

import { readDsStrict } from '../eslint/ds-strict.mjs'
import { matcher } from '../eslint/lib/glob.mjs'
import { walk } from './lib/admin-routes.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const { strict, exempt } = readDsStrict()

const isStrict = matcher(strict.map((e) => e.glob))
const isExempt = matcher(exempt)
const files = walk('src').filter((p) => /\.(vue|ts|js|css)$/.test(p) && isStrict(p) && !isExempt(p))

const eslint = new ESLint({ cwd: ROOT, errorOnUnmatchedPattern: false, warnIgnored: false })
const results = await eslint.lintFiles(files)
const formatter = await eslint.loadFormatter('stylish')
const text = await formatter.format(results)
if (text.trim()) console.log(text)
const errors = results.reduce((n, r) => n + r.errorCount, 0)
const eslintStatus = errors ? 1 : 0
console.log(`ds eslint: ${files.length} strict files, ${errors} errors`)

const run = (cmd, args) =>
  spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: true }).status ?? 1
const cssStatus = run('node', ['scripts/lint-ds-css.mjs'])
const adminStatus = run('node', ['scripts/lint-admin.mjs'])
process.exit(eslintStatus || cssStatus || adminStatus ? 1 : 0)
