import type { PageHeader } from '@/composables/usePageMeta'

/**
 * Live admin-layout default header, shown where neither the page (`usePageMeta`) nor the route
 * (`meta.header`) sets one (shells.md §2.3). DV-SH-03 only replaces it on pages whose module gives
 * a title.
 */
export const DEFAULT_ADMIN_HEADER: Readonly<PageHeader> = Object.freeze({
  title: 'Papan Pemuka',
  subtitle: 'Selamat datang, Admin',
})
