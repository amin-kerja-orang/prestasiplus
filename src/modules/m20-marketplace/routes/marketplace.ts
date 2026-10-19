import type { RouteRecordRaw } from 'vue-router'

/**
 * M20 route fragment: S6 buyer marketplace (`/marketplace`) and S8 public shop
 * (`/marketplace/penjual/:id`), M20-T2. User shell, every signed-in role (FR-M20-08); a guest goes to
 * `/login` by the shared guard. S6 header and tab title are static (FN-M20-1.1.3, 1.1.4); S8 sets
 * its subtitle (shop name) and tab title ("{shop} - Marketplace PRESTASIPLUS") from the loaded shop.
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/marketplace',
    name: 'm20.marketplace',
    component: () => import('../pages/MarketplacePage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Marketplace - PRESTASIPLUS',
      header: { title: 'Marketplace', subtitle: 'Peralatan sekolah untuk pelajar 🛒' },
      module: 'M20',
      v2: true,
    },
  },
  {
    path: '/marketplace/penjual/:id',
    name: 'm20.shop',
    component: () => import('../pages/PenjualShopPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Kedai Penjual - Marketplace PRESTASIPLUS',
      header: { title: 'Kedai Penjual' },
      module: 'M20',
      v2: true,
    },
  },
]

export default routes
