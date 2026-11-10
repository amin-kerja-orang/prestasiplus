import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_ROUTES } from '../components/admin/copy'

/**
 * M20 admin route fragment (S7-T08; R1-ADM-P2-12 and P2-13): products list / create / edit and sellers list / detail.
 * Admin shell, role `admin` only (any other signed-in role follows the `/admin/*` router rule). `create` is a static
 * segment and wins over `:id`. An unknown product or seller id is handled by the page (back to the list with the
 * API's message).
 */
const meta = (title: string, header: { title: string; subtitle: string }) => ({
  layout: 'admin' as const,
  access: 'auth' as const,
  roles: ['admin'] as ['admin'],
  title,
  header,
  module: 'M20' as const,
  v2: true as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/marketplace/products',
    name: ADMIN_ROUTES.products,
    component: () => import('../pages/AdminProdukPage.vue'),
    meta: meta('Marketplace — Produk', {
      title: 'Marketplace — Produk',
      subtitle: 'Pengurusan produk pasaran',
    }),
  },
  {
    path: '/admin/marketplace/products/create',
    name: ADMIN_ROUTES.productCreate,
    component: () => import('../pages/ProdukFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Produk Marketplace - PRESTASIPLUS', {
      title: 'Tambah Produk Marketplace',
      subtitle: 'Tambah produk baharu ke Marketplace',
    }),
  },
  {
    path: '/admin/marketplace/products/:id/edit',
    name: ADMIN_ROUTES.productEdit,
    component: () => import('../pages/ProdukFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: String(route.params.id) }),
    meta: meta('Edit Produk Marketplace - PRESTASIPLUS', {
      title: 'Edit Produk Marketplace',
      subtitle: 'Kemaskini produk Marketplace',
    }),
  },
  {
    path: '/admin/marketplace/sellers',
    name: ADMIN_ROUTES.sellers,
    component: () => import('../pages/AdminPenjualPage.vue'),
    meta: meta('Marketplace — Penjual', {
      title: 'Marketplace — Penjual',
      subtitle: 'Pengurusan penjual pasaran',
    }),
  },
  {
    path: '/admin/marketplace/sellers/:id',
    name: ADMIN_ROUTES.seller,
    component: () => import('../pages/PenjualDetailPage.vue'),
    props: (route) => ({ id: String(route.params.id) }),
    meta: meta('Semak Penjual - PRESTASIPLUS', {
      title: 'Semak Penjual',
      subtitle: 'Maklumat Perniagaan',
    }),
  },
]

export default routes
