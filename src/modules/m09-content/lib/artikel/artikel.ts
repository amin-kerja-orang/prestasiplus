/**
 * S15 / S16 reader helpers (SRS M09 FR-M09-22..39; BR-M09-01, BR-M09-09, BR-M09-10). Copy is the
 * exact live BM text (SRS §8.1, URS FN-M09-2.1 .. 2.3).
 */

import { CATEGORY_OPTIONS } from '../admin-articles-notes'

export { queryPage, queryText } from '../admin-articles-notes'

export const ARTIKEL_PATH = '/artikel'
export const ARTIKEL_PAGE_SIZE = 18

export const ARTIKEL_COPY = {
  headerTitle: 'Artikel',
  headerSubtitle: 'Tips belajar, berita pendidikan, motivasi dan panduan',
  hotHeading: 'Artikel Paling Hangat',
  searchPlaceholder: 'Cari artikel...',
  guestSearchPlaceholder: 'Cari artikel menarik...',
  all: 'Semua',
  pickCategory: 'Pilih Kategori:',
  emptyTitle: 'Tiada Artikel Dijumpai',
  emptyBody: 'Cuba ubah carian atau pilih kategori lain.',
  emptyAction: 'Lihat Semua Artikel',
  badgeFeatured: 'HOT',
  hotFeatured: 'PILIHAN',
  hotPopular: 'POPULAR',
  heroChip: 'Terkini & Menarik',
  heroTitle: 'Artikel Pilihan',
  breadcrumbDashboard: 'Dashboard',
  breadcrumbArtikel: 'Artikel',
  featuredChip: 'Pilihan',
  readers: 'Pembaca',
  likes: 'Suka',
  shareTitle: 'Kongsi Artikel Ini 🎉',
  shareBody: 'Kongsi dengan kawan-kawan supaya mereka pun dapat belajar!',
  copied: 'Link Disalin!',
  related: 'Artikel Berkaitan',
  latest: 'Artikel Terkini',
  seeAll: 'Lihat Semua Artikel',
  loadFailed: 'Ralat memuatkan data. Sila cuba semula.',
} as const

/** Category pills in live order. */
export const ARTIKEL_CATEGORIES = CATEGORY_OPTIONS

/** The four bold topics of the guest hero line (FN-M09-2.2.2). */
export const HERO_TOPICS = ['tips belajar', 'berita pendidikan', 'motivasi', 'panduan'] as const

/** Query of a list state: `search` and `category` kept, `page` only beyond the first. */
export function listQuery(state: {
  search?: string
  category?: string
  page?: number
}): Record<string, string> {
  const out: Record<string, string> = {}
  if (state.search) out.search = state.search
  if (state.category) out.category = state.category
  if (state.page && state.page > 1) out.page = String(state.page)
  return out
}

/** Breadcrumb label: the title cut at 40 characters + "..." when longer (FN-M09-2.3.2). */
export function breadcrumbTitle(title: string): string {
  return title.length > 40 ? `${title.slice(0, 40)}...` : title
}

/** Share links (FR-M09-35). */
export function shareLinks(title: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    twitter: `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`,
  }
}
