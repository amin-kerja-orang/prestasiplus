import { Book, LayoutGrid, Pen, PencilRuler, Shirt, Tablet } from '@lucide/vue'
import type { Component } from 'vue'

/** Category slug -> Lucide icon (SRS M20 v1.2 §10.1; the live `fa-*` name is in each comment). */
const ICONS: Record<string, Component> = {
  'peralatan-sekolah': PencilRuler, // fa-pencil-ruler
  'buku-rujukan': Book, // fa-book
  'uniform-pakaian': Shirt, // fa-tshirt
  stationery: Pen, // fa-pen
  digital: Tablet, // fa-tablet-alt
  'lain-lain': LayoutGrid, // fa-th-large
}

export function categoryIcon(slug: string): Component {
  return ICONS[slug] ?? LayoutGrid
}
