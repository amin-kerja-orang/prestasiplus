import type { RouteRecordRaw } from 'vue-router'

/**
 * M10 route fragment: S3 Remedial Progress (`/guru/remedial-progress`), reached from the Command Center
 * "Rekod" link (URS FN-M10-2.3.1). User shell; Guru and Admin only (SRS §2).
 */
const routes: RouteRecordRaw[] = [
  {
    path: '/guru/remedial-progress',
    name: 'guru-remedial-progress',
    component: () => import('../pages/RemedialProgressPage.vue'),
    meta: {
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Remedial Progress Dashboard',
      header: {
        title: 'Remedial Progress Dashboard',
        subtitle: 'Jejak peningkatan pelajar melalui ujian pemulihan',
      },
      module: 'M10',
      v2: true,
    },
  },
]

export default routes
