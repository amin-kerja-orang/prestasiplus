import type { RouteRecordRaw } from 'vue-router'

import { MEDIA_ROUTES } from '../lib/admin-media/common'

/**
 * M09 route fragment: S9–S11 banners, S12–S13 Audio KBAT sets with the two template downloads, and
 * S14 screenshot upload (SRS §2). Admin only (`/admin/*`, admin shell). Header and tab titles are
 * exact (FR-M09-51, 54, 58, 61, 119); S12 and S13 have a title and no subtitle (DV-M09-08). A
 * non-numeric banner `:id` falls through to the global 404; an unknown numeric id is handled by the
 * page (list + flash, FR-M09-53).
 */
const meta = (title: string, header?: { title: string; subtitle?: string }) => ({
  layout: 'admin' as const,
  access: 'auth' as const,
  roles: ['admin'] as ['admin'],
  title,
  ...(header ? { header } : {}),
  module: 'M09' as const,
  v2: true as const,
})

const routes: RouteRecordRaw[] = [
  {
    path: '/admin/banners',
    name: MEDIA_ROUTES.bannerList,
    component: () => import('../pages/BannerListPage.vue'),
    meta: meta('Pengurusan Banner - Admin PRESTASIPLUS', {
      title: 'Pengurusan Banner',
      subtitle: 'Urus banner promosi dan pengumuman',
    }),
  },
  {
    path: '/admin/banners/create',
    name: MEDIA_ROUTES.bannerCreate,
    component: () => import('../pages/BannerFormPage.vue'),
    props: { mode: 'create' },
    meta: meta('Tambah Banner - Admin PRESTASIPLUS', {
      title: 'Tambah Banner Baru',
      subtitle: 'Cipta banner promosi atau pengumuman',
    }),
  },
  {
    path: '/admin/banners/:id(\\d+)/edit',
    name: MEDIA_ROUTES.bannerEdit,
    component: () => import('../pages/BannerFormPage.vue'),
    props: (route) => ({ mode: 'edit', id: Number(route.params.id) }),
    meta: meta('Edit Banner - Admin PRESTASIPLUS', {
      title: 'Edit Banner',
      subtitle: 'Kemaskini maklumat banner',
    }),
  },
  {
    path: '/admin/audio-kbat',
    name: MEDIA_ROUTES.audioList,
    component: () => import('../pages/AudioSetListPage.vue'),
    meta: meta('Set Audio KBAT', { title: 'Set Audio KBAT' }),
  },
  {
    path: '/admin/audio-kbat/create',
    name: MEDIA_ROUTES.audioCreate,
    component: () => import('../pages/AudioSetCreatePage.vue'),
    meta: meta('Cipta Set Audio KBAT', { title: 'Cipta Set Audio KBAT' }),
  },
  {
    path: '/admin/audio-kbat/template',
    name: MEDIA_ROUTES.audioTemplate,
    component: () => import('../pages/AudioTemplatePage.vue'),
    props: { format: 'xlsx' },
    meta: meta('Set Audio KBAT', { title: 'Set Audio KBAT' }),
  },
  {
    path: '/admin/audio-kbat/template-word',
    name: MEDIA_ROUTES.audioTemplateWord,
    component: () => import('../pages/AudioTemplatePage.vue'),
    props: { format: 'docx' },
    meta: meta('Set Audio KBAT', { title: 'Set Audio KBAT' }),
  },
  {
    path: '/admin/tools/screenshots',
    name: MEDIA_ROUTES.screenshots,
    component: () => import('../pages/ScreenshotsPage.vue'),
    meta: meta('Upload Screenshot - Admin PRESTASIPLUS', {
      title: 'Upload Screenshot',
      subtitle: 'Tool admin untuk upload & urus gambar (private)',
    }),
  },
]

export default routes
