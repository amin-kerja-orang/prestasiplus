// Reader for the strict-file ratchet list (config/ds-strict.json, V2-T04). Shared by
// eslint.config.ts and scripts/lint-ds-css.mjs so both tools see the same file set.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))

/** @returns {{ strict: string[], exempt: string[] }} */
export function readDsStrict(file = 'config/ds-strict.json') {
  const raw = JSON.parse(readFileSync(`${ROOT}${file}`, 'utf8'))
  const list = (v) => (Array.isArray(v) ? v.filter((s) => typeof s === 'string') : [])
  return { strict: list(raw.strict), exempt: list(raw.exempt) }
}

/** Globs that match only `.css` and `.vue` files below each strict entry (for Stylelint). */
export function styleGlobs(strict) {
  return strict.map((g) => {
    if (/\.(css|vue)$/.test(g)) return g
    const base = g.endsWith('/**') ? g : `${g.replace(/\/$/, '')}/**`
    return `${base}/*.{css,vue}`
  })
}
