// Finds E2E selectors that depend on CSS classes (V2-T04). Restyling a module to the design
// system changes its classes, so these specs must be fixed in the same task (v2-frontend.md §8).
// Pure functions; the CLI is scripts/report-e2e-class-selectors.mjs.

/** Playwright / DOM calls whose first string argument is a selector. */
const SELECTOR_CALL =
  /\b(?:locator|\$\$?|\$\$?eval|querySelector(?:All)?|waitForSelector|closest|matches)\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/g

/** Class-assertion calls that do not take a selector. */
const CLASS_ASSERT =
  /\b(?:toHaveClass|toContainClass|classList|getAttribute\(\s*['"]class['"]\s*\))/g

/** Selectors wrapping Nuxt UI structure: they may break when a component replaces the markup. */
const STRUCTURAL =
  /\[role=["']?(?:tab|tablist|tabpanel|dialog|alertdialog|menu|listbox)["']?\]|(?:^|[\s>+~])(?:table|thead|tbody|tr|td|th|dialog)\b/

const ENGINE_PREFIX = /^\s*(?:text|role|xpath|id|data-testid|internal:[a-z-]+)\s*=|^\s*\/\//

/**
 * Classifies one selector string.
 * @returns {'class' | 'attr-class' | null}
 */
export function classSelectorKind(selector) {
  const sel = selector.replace(/\$\{[^}]*\}/g, 'X')
  if (ENGINE_PREFIX.test(sel)) return null
  if (/\[\s*class\s*[~|^$*]?=/.test(sel)) return 'attr-class'
  const stripped = sel
    .replace(/:(?:has-text|text|text-is|text-matches)\((?:"[^"]*"|'[^']*'|[^)]*)\)/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/"[^"]*"|'[^']*'/g, '')
    .replace(/:nth-[a-z-]+\([^)]*\)/g, '')
  return /(?:^|[^\w.-])(?:[a-zA-Z][\w-]*)?\.[A-Za-z_][\w-]*/.test(stripped) ? 'class' : null
}

/**
 * @param {string} source spec file text
 * @returns {{ line: number, kind: string, selector: string, structural: boolean }[]}
 */
export function findClassSelectors(source) {
  const hits = []
  const lineAt = (index) => source.slice(0, index).split('\n').length
  for (const m of source.matchAll(SELECTOR_CALL)) {
    const kind = classSelectorKind(m[2] ?? '')
    if (kind)
      hits.push({
        line: lineAt(m.index),
        kind,
        selector: m[2],
        structural: STRUCTURAL.test(m[2] ?? ''),
      })
  }
  for (const m of source.matchAll(CLASS_ASSERT)) {
    hits.push({
      line: lineAt(m.index),
      kind: 'class-assertion',
      selector: m[0],
      structural: false,
    })
  }
  return hits.sort((a, b) => a.line - b.line)
}

/** Module key of a spec path: `e2e/m05-practice/x.spec.ts` -> `m05-practice`. */
export function moduleOf(relPath) {
  const parts = relPath.split('/')
  return parts[0] === 'e2e' && parts.length > 2 ? (parts[1] ?? 'other') : 'other'
}

/**
 * Groups per-file hits by module.
 * @param {{ file: string, source: string }[]} files
 */
export function buildReport(files) {
  const modules = {}
  for (const { file, source } of files) {
    const mod = moduleOf(file)
    const entry = (modules[mod] ??= { specs: 0, specsWithClassSelectors: 0, hits: 0, files: [] })
    entry.specs += 1
    const hits = findClassSelectors(source)
    if (hits.length) {
      entry.specsWithClassSelectors += 1
      entry.hits += hits.length
      entry.files.push({ file, hits })
    }
  }
  const totals = Object.values(modules).reduce(
    (t, m) => ({
      specs: t.specs + m.specs,
      specsWithClassSelectors: t.specsWithClassSelectors + m.specsWithClassSelectors,
      hits: t.hits + m.hits,
    }),
    { specs: 0, specsWithClassSelectors: 0, hits: 0 },
  )
  return { modules, totals }
}
