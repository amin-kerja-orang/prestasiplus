/**
 * Guest public layout content (F-20; M09 URS FN-M09-2.2.1, 2.2.6, 6.2.1, 6.2.4; SRS FR-M09-29,
 * FR-M09-31, FR-M09-39, FR-M09-82). All copy is the exact live BM text.
 *
 * Live renders one guest layout on `/artikel` and `/video` (discovery M09 §2.14, §2.17). The two
 * pages differ only in the top-bar section label, the tab title and the CTA copy; the top bar
 * links and the footer are identical. The section is picked from the route path:
 * - `/artikel` → articles (OBSERVED); `/artikel/:slug` → articles too (INFERRED, L-7,
 *   FR-M09-39: the guest detail page was not observed);
 * - exactly `/video` → videos (OBSERVED; build-plan F-20 scope). Whether a guest `/video/:id`
 *   uses this layout is decided by M09-T3, so it gets no section here.
 * Any other path renders the layout without a section label or CTA.
 */

export type PublicSectionKey = 'artikel' | 'video'

export interface PublicCtaCopy {
  /** Decorative emoji, in live DOM order. */
  decorations: readonly string[]
  heading: string
  body: string
}

export interface PublicSection {
  key: PublicSectionKey
  /** Top-bar section label: emoji span + text span, after the "|" separator. */
  emoji: string
  label: string
  /**
   * Guest tab title (live uses an em dash here, unlike the logged-in titles). The M09 routes put
   * it in `meta.guestTitle`; the router applies it when the public layout is resolved.
   */
  guestTitle: string
  cta: PublicCtaCopy
}

/** CTA button and note, shared by both sections (FN-M09-2.2.6, 6.2.4). */
export const PUBLIC_CTA_BUTTON = 'Daftar Percuma Sekarang'
export const PUBLIC_CTA_NOTE = '100% Percuma • Tiada Kad Kredit Diperlukan'

export const PUBLIC_SECTIONS: Readonly<Record<PublicSectionKey, PublicSection>> = {
  artikel: {
    key: 'artikel',
    emoji: '📰',
    label: 'Artikel',
    guestTitle: 'Artikel — PRESTASIPLUS',
    cta: {
      decorations: ['📚', '✨', '🎯', '🚀', '⭐', '🎉'],
      heading: 'Nak Baca Lebih Banyak?',
      body: 'Daftar percuma dan dapat akses penuh ke semua artikel, latih tubi interaktif, ganjaran menarik dan banyak lagi!',
    },
  },
  video: {
    key: 'video',
    emoji: '🎬',
    label: 'Video',
    guestTitle: 'Video Pembelajaran — PRESTASIPLUS',
    cta: {
      decorations: ['🎬', '📚', '🎯', '🚀', '🎓'],
      heading: 'Nak Tonton Lebih Banyak?',
      body: 'Daftar percuma dan dapat akses penuh ke semua video, latih tubi interaktif, ganjaran menarik dan banyak lagi!',
    },
  },
}

/** The guest section for a route path, or `null` when the path is neither articles nor videos. */
export function publicSectionFor(path: string): PublicSection | null {
  if (path === '/artikel' || path.startsWith('/artikel/')) return PUBLIC_SECTIONS.artikel
  if (path === '/video') return PUBLIC_SECTIONS.video
  return null
}

export interface PublicLink {
  label: string
  to: string
}

/** Top-bar links (FN-M09-2.2.1, 6.2.1). */
export const PUBLIC_TOP_LINKS = {
  login: { label: 'Log Masuk', to: '/login' },
  register: { label: 'Daftar Percuma', to: '/register' },
} as const satisfies Record<string, PublicLink>

/** Footer links, in live order (FN-M09-2.2.6). */
export const PUBLIC_FOOTER_LINKS: readonly PublicLink[] = [
  { label: 'Utama', to: '/' },
  { label: 'Artikel', to: '/artikel' },
  { label: 'Video', to: '/video' },
  { label: 'Log Masuk', to: '/login' },
  { label: 'Daftar', to: '/register' },
]

export const PUBLIC_COPYRIGHT =
  '© 2026 PRESTASIPLUS by GCM Technologies Sdn Bhd. Hak Cipta Terpelihara.'
