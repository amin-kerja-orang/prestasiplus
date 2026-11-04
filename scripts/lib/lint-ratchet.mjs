// Lint ratchet (card S0-T04): pure helpers behind `scripts/lint.mjs`.
// `config/lint-baseline.json` holds the known ESLint / Stylelint error counts per file + rule. A run fails only
// when a count rises above the baseline or a new file+rule pair appears. The baseline only shrinks.
//
// A "finding" is { file, line, rule, message } (errors only, never warnings). `file` is repo-relative with `/`.
import { relative } from 'node:path'

export const BASELINE_NOTE =
  'Lint ratchet baseline (S0-T04): error counts per file + rule. It only shrinks: each sector removes its own entries ' +
  'when it fixes them (npm run lint -- --update-baseline). Never add entries; new errors must be fixed, not baselined.'

export const TOOLS = ['eslint', 'stylelint']

/** Repo-relative path with `/` separators. */
export const relPath = (root, abs) => relative(root, abs).split('\\').join('/')

/** ESLint JSON formatter output -> findings (severity 2 only). Fatal/parse errors have no ruleId. */
export function eslintFindings(results, root) {
  const out = []
  for (const r of results ?? []) {
    const file = relPath(root, r.filePath)
    for (const m of r.messages ?? []) {
      if (m.severity !== 2) continue
      out.push({ file, line: m.line ?? 0, rule: m.ruleId ?? (m.fatal ? '(fatal)' : '(no-rule)'), message: m.message })
    }
  }
  return out
}

/** Stylelint results (the array written by lint-ds-css --json-out) -> findings (errors only). */
export function stylelintFindings(results, root) {
  const out = []
  for (const r of results ?? []) {
    const file = relPath(root, r.source ?? r.filePath ?? '')
    for (const w of r.warnings ?? []) {
      if (w.severity !== 'error') continue
      out.push({ file, line: w.line ?? 0, rule: w.rule ?? '(no-rule)', message: w.text })
    }
    for (const w of r.parseErrors ?? [])
      out.push({ file, line: w.line ?? 0, rule: w.stylelintType ?? '(parse-error)', message: w.text })
  }
  return out
}

const sortObj = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))

/** findings -> { file: { rule: n } }, keys sorted. */
export function countsOf(findings) {
  const acc = {}
  for (const f of findings) {
    acc[f.file] ??= {}
    acc[f.file][f.rule] = (acc[f.file][f.rule] ?? 0) + 1
  }
  return sortObj(Object.fromEntries(Object.entries(acc).map(([k, v]) => [k, sortObj(v)])))
}

export const entryCount = (counts) => Object.values(counts ?? {}).reduce((n, rules) => n + Object.keys(rules).length, 0)

/**
 * Compare findings with the baseline counts of one tool.
 * failures: pairs above baseline (or new); each carries every finding of that pair (file:line:rule).
 * shrinks: pairs below baseline (including pairs that disappeared).
 */
export function compare(baseCounts, findings) {
  const base = baseCounts ?? {}
  const cur = countsOf(findings)
  const failures = []
  const shrinks = []
  for (const [file, rules] of Object.entries(cur))
    for (const [rule, count] of Object.entries(rules)) {
      const was = base[file]?.[rule] ?? 0
      if (count > was)
        failures.push({ file, rule, count, base: was, items: findings.filter((f) => f.file === file && f.rule === rule) })
    }
  for (const [file, rules] of Object.entries(base))
    for (const [rule, was] of Object.entries(rules)) {
      const count = cur[file]?.[rule] ?? 0
      if (count < was) shrinks.push({ file, rule, count, base: was })
    }
  return { ok: failures.length === 0, failures, shrinks }
}

/**
 * New baseline counts for one tool from the current findings. Without allowGrow it refuses (returns refused[])
 * when any pair would rise or appear; the caller then keeps the old baseline.
 */
export function updateCounts(baseCounts, findings, { allowGrow = false } = {}) {
  const { failures } = compare(baseCounts, findings)
  if (failures.length && !allowGrow) return { counts: baseCounts ?? {}, refused: failures }
  return { counts: countsOf(findings), refused: [] }
}

/** Assemble the baseline file object (note first, then one section per tool). */
export function makeBaseline(perTool) {
  const out = { note: BASELINE_NOTE }
  for (const t of TOOLS) out[t] = perTool[t] ?? {}
  return out
}

export const formatFailure = (tool, f) =>
  [
    `${tool}: ${f.file} [${f.rule}] ${f.count} error(s), baseline ${f.base}`,
    ...f.items.map((i) => `    ${f.file}:${i.line}:${i.rule}  ${i.message}`),
  ].join('\n')

export const SHRINK_HINT = 'baseline can shrink: run `npm run lint -- --update-baseline`'
