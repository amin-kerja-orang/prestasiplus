// L1 (consolidation plan): no module-local building blocks outside src/ds. A file whose name matches a
// local-kit pattern must be in config/ds-local-kits.baseline.json (genuine domain files only). The
// allowlist may only shrink: an entry whose file no longer exists fails the test (remove it).
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('../../', import.meta.url))

const NAME_PATTERNS = [
  /FormBar/,
  /RowMenu/,
  /ActiveFilters/,
  /PageHeader/,
  /PillNav/,
  /StatRow/,
  /LoadError/,
  /ErrorBox/,
]
const BASENAME_PATTERNS = [/^Admin/, /^CardTable/]
const DIR_PATTERNS = [/\/native\//]

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) {
      if (p === `${ROOT}src/ds`) continue
      walk(p, out)
    } else out.push(p)
  }
  return out
}

function isKit(rel) {
  if (/(^|\/)__tests__\//.test(rel) || /\.test\.[a-z]+$/.test(rel)) return false
  const base = rel.split('/').pop()
  return (
    NAME_PATTERNS.some((r) => r.test(base)) ||
    BASENAME_PATTERNS.some((r) => r.test(base)) ||
    DIR_PATTERNS.some((r) => r.test(`/${rel}`))
  )
}

const allowed = JSON.parse(readFileSync(`${ROOT}config/ds-local-kits.baseline.json`, 'utf8')).allowed
const found = walk(`${ROOT}src`)
  .map((p) => p.slice(ROOT.length))
  .filter(isKit)
  .sort()

describe('L1 no local kits outside src/ds', () => {
  it('has no file matching a local-kit name pattern that is not allowlisted', () => {
    const extra = found.filter((f) => !allowed.includes(f))
    expect(extra, `Use the DsXxx component instead of a local kit, or (domain only) allowlist: ${extra.join(', ')}`).toEqual([])
  })
  it('allowlist only shrinks: every entry still exists and still matches', () => {
    const stale = allowed.filter((f) => !existsSync(`${ROOT}${f}`) || !isKit(f))
    expect(stale, `Remove from config/ds-local-kits.baseline.json: ${stale.join(', ')}`).toEqual([])
  })
})
