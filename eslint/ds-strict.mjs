// Reader for the strict-file ratchet list (config/ds-strict.json, V2-T04). Shared by
// eslint.config.ts and the lint scripts so both tools see the same file set.
// Entry shape: { glob, level: 'page' | 'ds' }. A bare string means level 'page'.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

/** Normalises raw JSON (old string entries included) to `{ strict: {glob, level}[], exempt: string[] }`. */
export function normalizeDsStrict(raw) {
  const strict = (Array.isArray(raw?.strict) ? raw.strict : [])
    .map((e) =>
      typeof e === 'string'
        ? { glob: e, level: 'page' }
        : { glob: String(e?.glob ?? ''), level: e?.level === 'ds' ? 'ds' : 'page' },
    )
    .filter((e) => e.glob)
  const exempt = (Array.isArray(raw?.exempt) ? raw.exempt : []).filter((s) => typeof s === 'string')
  return { strict, exempt }
}

export function readDsStrict(file = 'config/ds-strict.json') {
  return normalizeDsStrict(JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8')))
}

/** Globs of a level. */
export const globsOf = (strict, level) => strict.filter((e) => e.level === level).map((e) => e.glob)

/** Expands one `{a,b}` group (no nesting) so each alternative is classified as file or directory. */
function expandBraces(g) {
  const m = /^(.*){([^{}]*)}(.*)$/.exec(g)
  return m ? m[2].split(',').map((alt) => `${m[1]}${alt}${m[3]}`) : [g]
}

/** Globs that match only `.css` and `.vue` files below each entry (for Stylelint). */
export function styleGlobs(globs) {
  return globs.flatMap(expandBraces).map((g) => {
    if (/\.(css|vue)$/.test(g)) return g
    const base = g.endsWith('/**') ? g : `${g.replace(/\/$/, '')}/**`
    return `${base}/*.{css,vue}`
  })
}

/**
 * Ratchet comparison: what is missing or loosened in `current` compared to `floor`.
 * A floor entry must stay, and a 'page' entry must not become 'ds'. Exemptions may only shrink.
 */
export function ratchetViolations(current, floor) {
  const out = []
  for (const f of floor.strict) {
    const c = current.strict.find((e) => e.glob === f.glob)
    if (!c) out.push(`strict entry removed: ${f.glob}`)
    else if (f.level === 'page' && c.level === 'ds')
      out.push(`strict entry relaxed from page to ds: ${f.glob}`)
  }
  for (const e of current.exempt) if (!floor.exempt.includes(e)) out.push(`exemption added: ${e}`)
  return out
}
