import type { RouteRecordRaw } from 'vue-router'

import { ADMIN_TITLES as T } from '../lib/admin/copy'

/**
 * M14 admin route fragment: the V2 sidebar group "Gamifikasi" (Overview, Tier Config, Cabaran, Pelajar, Transaksi,
 * Kawalan Reward). Admin shell, platform admin only; titles and subtitles are V2's. Tier Config and Cabaran are
 * read only (decision D118-3).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/admin/gamification',
    name: 'm14.admin-overview',
    component: () => import('../pages/admin/AdminOverviewPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.overview.title,
      header: { title: T.overview.title, subtitle: T.overview.subtitle },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/admin/gamification/tiers',
    name: 'm14.admin-tiers',
    component: () => import('../pages/admin/AdminTiersPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.tiers.title,
      header: { title: T.tiers.title, subtitle: T.tiers.subtitle },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/admin/gamification/challenges',
    name: 'm14.admin-challenges',
    component: () => import('../pages/admin/AdminChallengesPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.challenges.title,
      header: { title: T.challenges.title, subtitle: T.challenges.subtitle },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/admin/gamification/students',
    name: 'm14.admin-students',
    component: () => import('../pages/admin/AdminStudentsPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.students.title,
      header: { title: T.students.title, subtitle: T.students.subtitle },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/admin/gamification/transactions',
    name: 'm14.admin-transactions',
    component: () => import('../pages/admin/AdminTransactionsPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.transactions.title,
      header: { title: T.transactions.title, subtitle: T.transactions.subtitle },
      module: 'M14',
      v2: true,
    },
  },
  {
    path: '/admin/reward-control',
    name: 'm14.admin-reward-control',
    component: () => import('../pages/admin/AdminRewardControlPage.vue'),
    meta: {
      layout: 'admin',
      access: 'auth',
      roles: ['admin'],
      title: T.rewardControl.title,
      header: { title: T.rewardControl.title, subtitle: T.rewardControl.subtitle },
      module: 'M14',
      v2: true,
    },
  },
]

export default routes
