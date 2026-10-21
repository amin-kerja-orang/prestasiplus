import type { RouteComponent, RouteRecordRaw } from 'vue-router'

import { isHttpMode } from '@/api/mode'

/**
 * M16 route fragment: S13–S19 single-player games, Roda Nasib, Jutawan Ilmu and the provisional Jutawan
 * game page (M16-T5). User shell, every logged-in role (FR-M16-05). The shell header is the page title
 * with "Selamat datang kembali" (DV-M16-01, URS FN-M16-1.1.3); the tab titles are the live ones
 * (URS FN-M16-1.1.4), with their emoji.
 */
const SUBTITLE = 'Selamat datang kembali'

/**
 * Interim (D58, issue #78): in http mode the 5 single-player engines cannot work (the real API sends no
 * answer key), so they show a notice until they call `POST /games/solo/{game}/check` and
 * `/games/solo/kad-memori/reveal`. Mock mode is unchanged.
 */
type LazyPage = () => Promise<{ default: RouteComponent }>
const soloPage = (load: LazyPage): LazyPage =>
  isHttpMode() ? () => import('../components/solo/SoloUnavailable.vue') : load

const routes: RouteRecordRaw[] = [
  {
    path: '/permainan/betul-salah',
    name: 'permainan-betul-salah',
    component: soloPage(() => import('../pages/SoloBetulSalahPage.vue')),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Betul atau Salah ✅ — PRESTASIPLUS',
      header: { title: 'Betul atau Salah', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/cabaran-kilat',
    name: 'permainan-cabaran-kilat',
    component: soloPage(() => import('../pages/SoloCabaranKilatPage.vue')),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Cabaran Kilat ⚡ — PRESTASIPLUS',
      header: { title: 'Cabaran Kilat', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/tembak-jawapan',
    name: 'permainan-tembak-jawapan',
    component: soloPage(() => import('../pages/SoloTembakJawapanPage.vue')),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Tembak Jawapan 🎯 — PRESTASIPLUS',
      header: { title: 'Tembak Jawapan', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/susun-jawapan',
    name: 'permainan-susun-jawapan',
    component: soloPage(() => import('../pages/SoloSusunJawapanPage.vue')),
    meta: {
      layout: 'user',
      access: 'auth',
      title: 'Susun Jawapan 🧩 — PRESTASIPLUS',
      header: { title: 'Susun Jawapan', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/kad-memori',
    name: 'permainan-kad-memori',
    component: soloPage(() => import('../pages/SoloKadMemoriPage.vue')),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Kad Memori — PRESTASIPLUS',
      header: { title: 'Kad Memori', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/roda-nasib',
    name: 'permainan-roda-nasib',
    component: () => import('../pages/RodaNasibPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Roda Nasib — PRESTASIPLUS',
      header: { title: 'Roda Nasib', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
    },
  },
  {
    path: '/permainan/jutawan',
    name: 'permainan-jutawan',
    component: () => import('../pages/JutawanPage.vue'),
    meta: {
      ownsH1: true,
      layout: 'user',
      access: 'auth',
      title: 'Jutawan Ilmu 💰 — PRESTASIPLUS',
      header: { title: 'Jutawan Ilmu', subtitle: SUBTITLE },
      module: 'M16',
      v2: true,
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
      v2: true,
    },
  },
]

export default routes
