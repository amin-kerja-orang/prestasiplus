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

/** Expands brace alternatives (`a/{b,c/**}` -> `a/b`, `a/c/**`); nested braces are expanded recursively. */
export function expandBraces(glob) {
  const open = glob.indexOf('{')
  if (open === -1) return [glob]
  let depth = 0
  let close = -1
  const cuts = []
  for (let i = open; i < glob.length; i += 1) {
    const ch = glob[i]
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        close = i
        break
      }
    } else if (ch === ',' && depth === 1) cuts.push(i)
  }
  if (close === -1) return [glob]
  const parts = []
  let from = open + 1
  for (const cut of [...cuts, close]) {
    parts.push(glob.slice(from, cut))
    from = cut + 1
  }
  const head = glob.slice(0, open)
  const tail = glob.slice(close + 1)
  return parts.flatMap((part) => expandBraces(`${head}${part}${tail}`))
}

/** A strict entry that names script files only (`admin/**\/*.ts`): nothing for Stylelint to read. */
const SCRIPT_FILE_GLOB = /\.(?:[cm]?[jt]sx?|json)$/

/**
 * Globs that match only `.css` and `.vue` files below each entry (for Stylelint). Brace alternatives
 * are expanded first, so each alternative is treated on its own: a file stays a file, a directory
 * (`timeline/**`) gets the `/*.{css,vue}` suffix, and script-only entries (`*.ts`) are dropped.
 */
export function styleGlobs(globs) {
  return globs
    .flatMap(expandBraces)
    .filter((g) => !SCRIPT_FILE_GLOB.test(g))
    .map((g) => {
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
