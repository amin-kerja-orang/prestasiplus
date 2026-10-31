/**
 * The one browser-tab title format (user decision 2026-10-29, `docs/design/v2-copy-glossary.md`):
 * `{Page Name} | PRESTASIPLUS`. Every writer of `document.title` goes through `formatTabTitle`.
 */

export const BRAND = 'PRESTASIPLUS'

/** Used only when a page has no name at all; the brand alone is never a tab title. */
export const FALLBACK_PAGE_NAME = 'Halaman'

const SEP = '[|\\-\\u2013\\u2014:]'
// "... | PRESTASIPLUS", "... - PRESTASIPLUS", "... — PRESTASIPLUS"
const TRAILING_BRAND = new RegExp(`\\s*(?:${SEP}\\s*)?${BRAND}\\s*$`, 'i')
// "PRESTASIPLUS - ...", "PRESTASIPLUS | ...", "PRESTASIPLUS ..."
const LEADING_BRAND = new RegExp(`^\\s*${BRAND}\\b\\s*(?:${SEP}\\s*)?`, 'i')
// legacy module suffix: "Tahap 1: Reaksi — Kirkpatrick"
// and the legacy "- Admin" / "- Admin Panel" qualifier
const TRAILING_MODULE = /\s+[–—]\s+Kirkpatrick\s*$|\s+-\s+Admin(?:\s+Panel)?\s*$/i

/** Strips legacy brand/module prefixes and suffixes from a page name. */
export function cleanPageName(raw: string | null | undefined): string {
  let name = (raw ?? '').replace(/\s+/g, ' ').trim()
  let previous: string
  do {
    previous = name
    name = name.replace(TRAILING_BRAND, '').replace(TRAILING_MODULE, '')
    // keep a brand-only name intact so the fallback below can decide
    if (name.replace(/\s+/g, '').toUpperCase() !== BRAND) name = name.replace(LEADING_BRAND, '')
    name = name.trim()
  } while (name !== previous)
  return name
}

/** `{Page Name} | PRESTASIPLUS`. An empty or brand-only name falls back to a generic page name. */
export function formatTabTitle(name: string | null | undefined): string {
  let clean = cleanPageName(name)
  if (clean === '' || clean.toUpperCase() === BRAND) clean = FALLBACK_PAGE_NAME
  return `${clean} | ${BRAND}`
}
