// `npm run ds:debt` - the single source of design-system debt numbers (hardening spec 6.4).
//   node scripts/ds-debt.mjs                  readable summary
//   node scripts/ds-debt.mjs --json           full JSON on stdout (totals, byRule, detail)
//   node scripts/ds-debt.mjs --write-baseline write config/ds-debt.baseline.json (may only lower numbers)
//   node scripts/ds-debt.mjs --write-baseline --force   allow raising / initial creation
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { countByRuleFile, RULES, scanTree, totalsOf } from './lib/ds-debt-scan.mjs'

const BASELINE = fileURLToPath(new URL('../config/ds-debt.baseline.json', import.meta.url))

export function scanDebt() {
  const { files, hits } = scanTree()
  const byRule = countByRuleFile(hits)
  const detail = {}
  for (const h of hits) {
    detail[h.rule] ??= {}
    detail[h.rule][h.code] = (detail[h.rule][h.code] ?? 0) + 1
  }
  return { files: files.length, totals: totalsOf(byRule), byRule, detail }
}

/** Entries of `next` that exceed `prev`, or are absent from it. */
export function raises(prev, next) {
  const out = []
  for (const r of RULES)
    for (const [f, n] of Object.entries(next[r] ?? {}))
      if (n > (prev[r]?.[f] ?? 0)) out.push(`${r} ${f}: ${prev[r]?.[f] ?? 0} -> ${n}`)
  return out
}

function summary(res) {
  const lines = [`ds:debt - ${res.files} files scanned`, '']
  for (const r of RULES) {
    const files = Object.entries(res.byRule[r])
    lines.push(`${r.padEnd(22)} ${String(res.totals[r]).padStart(6)}  in ${files.length} files`)
    const det = Object.entries(res.detail[r] ?? {}).sort((a, b) => b[1] - a[1])
    if (det.length) lines.push('    ' + det.map(([k, v]) => `${k}:${v}`).join('  '))
  }
  lines.push('', 'Top files per rule:')
  for (const r of RULES) {
    const top = Object.entries(res.byRule[r])
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    if (top.length)
      lines.push(`  ${r}: ` + top.map(([f, n]) => `${f.replace('src/', '')} (${n})`).join(', '))
  }
  return lines.join('\n')
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const args = new Set(process.argv.slice(2))
  const res = scanDebt()
  if (args.has('--write-baseline')) {
    if (existsSync(BASELINE) && !args.has('--force')) {
      const prev = JSON.parse(readFileSync(BASELINE, 'utf8'))
      const bad = raises(prev, res.byRule)
      if (bad.length) {
        console.error('Refusing to raise the baseline:\n  ' + bad.join('\n  '))
        process.exit(1)
      }
    }
    writeFileSync(BASELINE, JSON.stringify(res.byRule, null, 2) + '\n')
    console.log(`Wrote ${BASELINE}`)
    console.log(summary(res))
  } else if (args.has('--json')) {
    console.log(JSON.stringify(res, null, 2))
  } else {
    console.log(summary(res))
  }
}
