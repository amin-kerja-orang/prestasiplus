import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: S20 Pertandingan Mingguan, S21 Uji Minda and S22 Sambung Kata (M16-T6b;
 * SRS M16 v1.6 §2, FR-M16-03/04/05). User shell, any logged-in role (a guest goes to `/login` by
 * the shared guard). Tab titles are the live ones (FN-M16-1.1.4); the shell header is the page
 * title with the user-portal subtitle "Selamat datang kembali" (DV-M16-01, DV-SH-03). S22 is the
 * handled 500 page (DV-M16-03): standalone, no shell; content and tab title OBSERVED (live 500
 * page; tab title "500 - Ralat Pelayan | PRESTASIPLUS",
 * docs/discovery/inventory/M07/S4-history.json:33).
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/permainan/pertandingan',
    name: 'm16.pertandingan',
    component: () => import('../pages/PertandinganPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Pertandingan Mingguan — PRESTASIPLUS',
      header: { title: 'Pertandingan Mingguan', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/uji-minda',
    name: 'm16.uji-minda',
    component: () => import('../pages/UjiMindaPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Uji Minda — Belum Ada Cabaran',
      header: { title: 'Uji Minda', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/sambung-kata',
    name: 'm16.sambung-kata',
    component: () => import('../pages/SambungKataPage.vue'),
    meta: {
      layout: 'bare',
      access: 'auth',
      title: '500 - Ralat Pelayan | PRESTASIPLUS',
      module: 'M16',
      v2: true,
    },
  },
]

export default routes
