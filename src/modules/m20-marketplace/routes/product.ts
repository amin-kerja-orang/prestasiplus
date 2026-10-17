import type { RouteRecordRaw } from 'vue-router'

/**
 * M20 route fragment: S7 product page (`/marketplace/:slug`) and the W hand-off route
 * (`/marketplace/:slug/whatsapp`, no screen, D14), M20-T3. User shell for S7 (every signed-in
 * role); W has no shell (it runs in the new tab and replaces itself with the `wa.me` URL). S7 sets
 * its header subtitle (category) and tab title ("{product} - Marketplace PRESTASIPLUS") from the
 * loaded product. Paths such as `/marketplace/cart` match `:slug`, the API answers 404 and the page
 * renders the global 404 page (FR-M20-09, AC-M20-24.3).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/marketplace/:slug',
    name: 'm20.product',
    component: () => import('../pages/ProductDetailPage.vue'),
    props: (route) => ({ slug: String(route.params.slug) }),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Marketplace - PRESTASIPLUS',
      header: { title: 'Marketplace' },
      module: 'M20',
      v2: true,
    },
  },
  {
    path: '/marketplace/:slug/whatsapp',
    name: 'm20.whatsapp',
    component: () => import('../pages/WhatsappHandoffPage.vue'),
    props: (route) => ({ slug: String(route.params.slug) }),
    meta: {
      layout: 'bare',
      access: 'auth',
      title: 'Marketplace - PRESTASIPLUS',
      module: 'M20',
      v2: true,
    },
  },
]

export default routes
