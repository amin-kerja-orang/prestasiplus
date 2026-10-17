/**
 * The Phosphor Duotone glyph of a subject (design system 10.1). The M03 `icon` value (Lucide name,
 * Font Awesome class or emoji) is matched by keyword; anything else is the books glyph. Class names
 * are written out in full so the icon bundler finds them.
 */

const GLYPHS: readonly { match: RegExp; glyph: string }[] = [
  { match: /calc|math|sigma|function|percent|ruler/, glyph: 'i-ph-calculator-duotone' },
  { match: /language|translate|globe|speech|message|comment/, glyph: 'i-ph-translate-duotone' },
  { match: /landmark|scroll|history|hourglass|monument|castle/, glyph: 'i-ph-scroll-duotone' },
  {
    match: /flask|atom|microscope|vial|dna|beaker|test-tube|science|leaf|seedling/,
    glyph: 'i-ph-flask-duotone',
  },
  { match: /book|read|text|pen|file|graduation/, glyph: 'i-ph-book-open-text-duotone' },
]

export const SUBJECT_FALLBACK_GLYPH = 'i-ph-books-duotone'

const NON_ASCII = /[^\x00-\x7F]/

/** The emoji of an icon value, or '' when it is not one. */
export function subjectEmoji(icon: string | null | undefined): string {
  const v = icon?.trim() ?? ''
  return NON_ASCII.test(v) ? v : ''
}

/** The Phosphor class of a subject's icon value. */
export function subjectGlyph(icon: string | null | undefined): string {
  const v = (icon ?? '').toLowerCase()
  return GLYPHS.find((g) => g.match.test(v))?.glyph ?? SUBJECT_FALLBACK_GLYPH
}
