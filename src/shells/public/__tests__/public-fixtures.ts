import { defineComponent, h } from 'vue'

import type { ModuleManifest } from '@/app/modules'
import { usePageMeta } from '@/composables/usePageMeta'

import { PUBLIC_SECTIONS } from '../public-sections'

/** The logged-in tab title on live (the guest title differs). */
export const USER_TITLE = 'PRESTASIPLUS - Platform Latih Tubi Nasional'
/** A data-driven title the detail page sets itself (`usePageMeta().setTitle`). */
export const DETAIL_TITLE = 'Tajuk Artikel'

function page(testId: string, onSetup?: () => void) {
  return defineComponent({
    name: `Page_${testId}`,
    setup: () => {
      onSetup?.()
      return () => h('p', { 'data-testid': testId }, testId)
    },
  })
}

const PUBLIC_META = { layout: 'public-or-user', access: 'public' } as const

/** Test routes shaped like the M09 guest routes (the real ones come with M09-T2/T3). */
export const PUBLIC_REGISTRY: readonly ModuleManifest[] = [
  {
    id: 'M99',
    slug: 'm99-public-test',
    routes: [
      {
        path: '/artikel',
        component: page('artikel'),
        meta: { ...PUBLIC_META, title: USER_TITLE, guestTitle: PUBLIC_SECTIONS.artikel.guestTitle },
      },
      {
        path: '/artikel/:slug',
        component: page('artikel-detail', () => usePageMeta().setTitle(DETAIL_TITLE)),
        meta: { ...PUBLIC_META, title: USER_TITLE, guestTitle: PUBLIC_SECTIONS.artikel.guestTitle },
      },
      {
        path: '/video',
        component: page('video'),
        meta: {
          ...PUBLIC_META,
          title: 'Video Pembelajaran - PRESTASIPLUS',
          guestTitle: PUBLIC_SECTIONS.video.guestTitle,
        },
      },
      { path: '/lain', component: page('lain'), meta: { ...PUBLIC_META, title: 'Lain' } },
      { path: '/dashboard', component: page('dashboard'), meta: { layout: 'user' } },
    ],
  },
]
