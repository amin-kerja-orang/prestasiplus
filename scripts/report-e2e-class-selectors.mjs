// Lists E2E specs that select by CSS class, per module (V2-T04), so restyles can be planned.
//   node scripts/report-e2e-class-selectors.mjs            summary table
//   node scripts/report-e2e-class-selectors.mjs --detail   plus file:line and selector
//   node scripts/report-e2e-class-selectors.mjs --json     machine-readable
//   node scripts/report-e2e-class-selectors.mjs --module m05-practice
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

import { buildReport } from './lib/e2e-class-selectors.mjs'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const args = process.argv.slice(2)
const moduleArg = args.includes('--module') ? args[args.indexOf('--module') + 1] : null

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : walk(p)
    return /\.(spec|test)\.[cm]?[jt]s$/.test(name) ? [p] : []
  })
}

const files = walk(join(ROOT, 'e2e'))
  .map((p) => relative(ROOT, p).replaceAll('\\', '/'))
  .filter((f) => !moduleArg || f.startsWith(`e2e/${moduleArg}/`))
  .map((file) => ({ file, source: readFileSync(join(ROOT, file), 'utf8') }))

const report = buildReport(files)

if (args.includes('--json')) {
  console.log(JSON.stringify(report, null, 2))
} else {
  const rows = Object.entries(report.modules).sort(([a], [b]) => a.localeCompare(b))
  const w = Math.max(6, ...rows.map(([m]) => m.length))
  console.log(`${'module'.padEnd(w)}  specs  with-class  hits`)
  for (const [m, e] of rows)
    console.log(
      `${m.padEnd(w)}  ${String(e.specs).padStart(5)}  ${String(e.specsWithClassSelectors).padStart(10)}  ${String(e.hits).padStart(4)}`,
    )
  const t = report.totals
  console.log(
    `${'TOTAL'.padEnd(w)}  ${String(t.specs).padStart(5)}  ${String(t.specsWithClassSelectors).padStart(10)}  ${String(t.hits).padStart(4)}`,
  )
  if (args.includes('--detail')) {
    for (const [m, e] of rows) {
      for (const f of e.files) {
        console.log(`\n${f.file}`)
        for (const h of f.hits)
          console.log(`  :${h.line} [${h.kind}${h.structural ? ', structural' : ''}] ${h.selector}`)
      }
      void m
    }
  }
}
