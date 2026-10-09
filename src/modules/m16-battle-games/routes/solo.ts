import type { RouteRecordRaw } from 'vue-router'

/**
 * M16 route fragment: S13–S19 single-player games, Roda Nasib, Jutawan Ilmu and the provisional Jutawan
 * game page (M16-T5). User shell, every logged-in role (FR-M16-05). The shell header is the page title
 * with "Selamat datang kembali" (DV-M16-01, URS FN-M16-1.1.3); the tab titles are the live ones
 * (URS FN-M16-1.1.4), with their emoji.
 */
const SUBTITLE = 'Selamat datang kembali'

const routes: RouteRecordRaw[] = [
  {
    path: '/permainan/betul-salah',
    name: 'permainan-betul-salah',
    component: () => import('../pages/SoloBetulSalahPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Betul atau Salah ✅ — PRESTASIPLUS',
      header: { title: 'Betul atau Salah', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/cabaran-kilat',
    name: 'permainan-cabaran-kilat',
    component: () => import('../pages/SoloCabaranKilatPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Cabaran Kilat ⚡ — PRESTASIPLUS',
      header: { title: 'Cabaran Kilat', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/tembak-jawapan',
    name: 'permainan-tembak-jawapan',
    component: () => import('../pages/SoloTembakJawapanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tembak Jawapan 🎯 — PRESTASIPLUS',
      header: { title: 'Tembak Jawapan', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/susun-jawapan',
    name: 'permainan-susun-jawapan',
    component: () => import('../pages/SoloSusunJawapanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Susun Jawapan 🧩 — PRESTASIPLUS',
      header: { title: 'Susun Jawapan', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/kad-memori',
    name: 'permainan-kad-memori',
    component: () => import('../pages/SoloKadMemoriPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Kad Memori — PRESTASIPLUS',
      header: { title: 'Kad Memori', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/roda-nasib',
    name: 'permainan-roda-nasib',
    component: () => import('../pages/RodaNasibPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Roda Nasib — PRESTASIPLUS',
      header: { title: 'Roda Nasib', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/jutawan',
    name: 'permainan-jutawan',
    component: () => import('../pages/JutawanPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Jutawan Ilmu 💰 — PRESTASIPLUS',
      header: { title: 'Jutawan Ilmu', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
  {
    path: '/permainan/jutawan/main',
    name: 'permainan-jutawan-main',
    component: () => import('../pages/JutawanMainPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Jutawan Ilmu 💰 — PRESTASIPLUS',
      header: { title: 'Jutawan Ilmu', subtitle: SUBTITLE },
      module: 'M16',
    },
  },
]

export default routes
