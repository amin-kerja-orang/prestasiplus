/**
 * The "Alat Soalan" block of Sumbang Soalan (FR-GUR-44-8; D-T06-1): six tool tiles in the V2 order with the V2 titles
 * and captions. A tile renders only when its target route is registered AND the viewer's role may open it, so no dead
 * link ships before the tool modules land (S6-T14, S6-T16..T20); the tile appears by itself once its route exists.
 */
import type { DsAccent } from '@/ds'

export interface AlatTile {
  to: string
  title: string
  caption: string
  /** Phosphor base name for `DsIconChip`. */
  icon: string
  accent: DsAccent
}

export const ALAT_SOALAN: readonly AlatTile[] = [
  {
    to: '/guru/soalan-guru',
    title: 'Soalan & Rujukan',
    caption: 'Soalan peribadi + rujukan',
    icon: 'book-open',
    accent: 'action',
  },
  {
    to: '/guru/soalan-berstruktur',
    title: 'Soalan Berstruktur',
    caption: 'Soalan subjektif & esei',
    icon: 'list-numbers',
    accent: 'win',
  },
  {
    to: '/admin/soalan-gambar',
    title: 'Soalan Gambar Rajah',
    caption: 'Soalan perlu gambar rajah',
    icon: 'images',
    accent: 'heat',
  },
  {
    to: '/guru/databank',
    title: 'Databank Soalan',
    caption: 'Layari bank soalan SPM',
    icon: 'database',
    accent: 'friend',
  },
  {
    to: '/guru/set-soalan',
    title: 'Set Soalan',
    caption: 'Cipta set soalan kustom',
    icon: 'clipboard-text',
    accent: 'trial',
  },
  {
    to: '/guru/kertas-peperiksaan',
    title: 'Kertas Peperiksaan',
    caption: 'Muat naik & kongsi kertas',
    icon: 'file-text',
    accent: 'action',
  },
]

/**
 * Whether the viewer's role may open a resolved route: a route without `meta.roles` is open to every role; with
 * `roles` the role must be listed (a guest never is).
 */
export function roleMayOpen(roles: readonly string[] | undefined, role: string | null): boolean {
  return roles === undefined || (role !== null && roles.includes(role))
}
