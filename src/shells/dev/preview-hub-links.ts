/**
 * Data for the temporary preview hub (`PreviewHub.vue`, user decision D20). The Delivery Lead adds
 * a finished module's screens here and nowhere else. Remove the hub once M17 and M05 exist.
 */

import type { Role } from '@/stores/session-types'

export interface PreviewHubLink {
  /** Group heading, e.g. "M02 Pengguna & Sekolah". */
  module: string
  /** BM screen name. */
  label: string
  path: string
  /** Roles that see the link (the screen's own route guard still applies). */
  roles: readonly Role[]
}

const ADMIN: readonly Role[] = ['admin']
const ALL: readonly Role[] = ['admin', 'student', 'teacher', 'school_admin']
const M02 = 'M02 Pengguna & Sekolah'
const M03 = 'M03 Kurikulum'
const M04 = 'M04 Bank Soalan'
const M08 = 'M08 Prestasi Murid'
const M05 = 'M05 Latihan (Murid)'
const STUDENT: readonly Role[] = ['student']
const STUDENT_TEACHER: readonly Role[] = ['student', 'teacher']

export const PREVIEW_HUB_LINKS: readonly PreviewHubLink[] = [
  { module: M05, label: 'Latih Tubi — Senarai Subjek', path: '/practice', roles: STUDENT },
  { module: M05, label: 'Latih Tubi — Matematik', path: '/practice/MATH', roles: STUDENT },
  {
    module: M05,
    label: 'Latih Tubi — Kuiz Matematik (5 soalan)',
    path: '/practice/MATH/quiz?level=1&count=5',
    roles: STUDENT,
  },
  { module: M05, label: 'Soalan by Chapter', path: '/practice/chapter', roles: STUDENT_TEACHER },
  {
    module: M05,
    label: 'Soalan by Chapter — Matematik',
    path: '/practice/chapter/MATH',
    roles: STUDENT_TEACHER,
  },
  { module: M05, label: 'Soalan Aku Salah', path: '/practice/revision', roles: STUDENT },
  { module: M05, label: 'Ulang Kaji — Matematik', path: '/practice/revision/MATH', roles: STUDENT },
  { module: M02, label: 'Senarai Pengguna', path: '/admin/users', roles: ADMIN },
  { module: M02, label: 'Tambah Pengguna', path: '/admin/users/create', roles: ADMIN },
  { module: M02, label: 'Import Pengguna', path: '/admin/users/bulk-import', roles: ADMIN },
  { module: M02, label: 'Import Pelajar', path: '/admin/import-students', roles: ADMIN },
  { module: M02, label: 'Pelajar Komplimen', path: '/admin/comp-students', roles: ADMIN },
  { module: M02, label: 'Sekolah', path: '/admin/schools', roles: ADMIN },
  { module: M02, label: 'Langganan Sekolah', path: '/admin/school-subscriptions', roles: ADMIN },
  {
    module: M02,
    label: 'Butiran Langganan',
    path: '/admin/school-subscriptions/10',
    roles: ADMIN,
  },
  {
    module: M02,
    label: 'Invois Pembaharuan',
    path: '/admin/school-subscriptions/10/renewal-invoice',
    roles: ADMIN,
  },
  {
    module: M03,
    label: 'Kurikulum — Pilih Subjek & Tahap',
    path: '/admin/curriculum',
    roles: ADMIN,
  },
  {
    module: M03,
    label: 'Kurikulum Matematik Tingkatan 4',
    path: '/admin/curriculum?subject_id=3&education_level_id=10',
    roles: ADMIN,
  },
  {
    module: M03,
    label: 'Kurikulum Bahasa Melayu Darjah 1 (ada subtopik)',
    path: '/admin/curriculum?subject_id=1&education_level_id=1',
    roles: ADMIN,
  },
  {
    module: M03,
    label: 'Tambah Bab',
    path: '/admin/curriculum/chapters/create?subject_id=3&education_level_id=10',
    roles: ADMIN,
  },
  { module: M03, label: 'Edit Bab', path: '/admin/curriculum/chapters/91/edit', roles: ADMIN },
  {
    module: M03,
    label: 'Tambah Topik',
    path: '/admin/curriculum/topics/create?chapter_id=91',
    roles: ADMIN,
  },
  { module: M03, label: 'Edit Topik', path: '/admin/curriculum/topics/126/edit', roles: ADMIN },
  { module: M03, label: 'Senarai Subjek', path: '/admin/subjects', roles: ADMIN },
  { module: M03, label: 'Tambah Subjek', path: '/admin/subjects/create', roles: ADMIN },
  { module: M03, label: 'Edit Subjek', path: '/admin/subjects/3/edit', roles: ADMIN },
  { module: M03, label: 'Tahap Pendidikan', path: '/admin/education-levels', roles: ADMIN },
  {
    module: M03,
    label: 'Tambah Tahap Pendidikan',
    path: '/admin/education-levels/create',
    roles: ADMIN,
  },
  {
    module: M03,
    label: 'Edit Tahap Pendidikan',
    path: '/admin/education-levels/10/edit',
    roles: ADMIN,
  },
  { module: M04, label: 'Senarai Soalan', path: '/admin/questions', roles: ADMIN },
  { module: M04, label: 'Butiran Soalan', path: '/admin/questions/564159', roles: ADMIN },
  { module: M04, label: 'Tambah Soalan', path: '/admin/questions/create', roles: ADMIN },
  { module: M04, label: 'Edit Soalan', path: '/admin/questions/564159/edit', roles: ADMIN },
  { module: M04, label: 'Import CSV', path: '/admin/questions/import', roles: ADMIN },
  { module: M04, label: 'Sejarah Import', path: '/admin/questions/import-history', roles: ADMIN },
  { module: M04, label: 'Kualiti Soalan', path: '/admin/questions/quality', roles: ADMIN },
  { module: M04, label: 'Soalan Berstruktur', path: '/admin/structured-questions', roles: ADMIN },
  {
    module: M04,
    label: 'Butiran Soalan Berstruktur',
    path: '/admin/structured-questions/4454',
    roles: ADMIN,
  },
  { module: M04, label: 'Kertas Soalan Guru', path: '/admin/question-submissions', roles: ADMIN },
  { module: M04, label: 'Soalan Perlu Gambar Rajah', path: '/admin/soalan-gambar', roles: ADMIN },
  { module: M04, label: 'Master Notes', path: '/admin/master-notes', roles: ADMIN },
  { module: M04, label: 'Laporan Soalan (Admin)', path: '/admin/question-reports', roles: ADMIN },
  { module: M08, label: 'Prestasi Sekolah', path: '/prestasi/sekolah', roles: ALL },
  { module: M08, label: 'Dashboard Tingkatan 4', path: '/prestasi/tingkatan/t4', roles: ALL },
  { module: M08, label: 'Dashboard Tingkatan 5', path: '/prestasi/tingkatan/t5', roles: ALL },
  { module: M08, label: 'Dashboard Kelas 2001', path: '/prestasi/kelas/2001', roles: ADMIN },
  {
    module: M08,
    label: 'Analitik Kelas (kelas 4)',
    path: '/analitik/kelas?classroom_id=4',
    roles: ADMIN,
  },
  { module: M08, label: 'Analisa Item — Pilih Kelas', path: '/analisa-item/kelas', roles: ADMIN },
  { module: M08, label: 'Analisa Item Kelas 2001', path: '/analisa-item/kelas/2001', roles: ADMIN },
  {
    module: M08,
    label: 'Analisa Item Sekolah 8880',
    path: '/analisa-item/sekolah/8880',
    roles: ALL,
  },
  {
    module: M08,
    label: 'Analisa Item Sekolah 8765',
    path: '/analisa-item/sekolah/8765',
    roles: ALL,
  },
  { module: M08, label: 'Analitik Pembelajaran', path: '/analitik/pelajar', roles: ALL },
  { module: M08, label: 'Prestasi 360 (Murid 3001)', path: '/prestasi/3001', roles: ADMIN },
  { module: M08, label: 'Prestasi 360 (Murid 3201)', path: '/prestasi/3201', roles: ADMIN },
  { module: M08, label: 'Headcount — Senarai', path: '/headcount', roles: ALL },
  { module: M08, label: 'Headcount — Dashboard', path: '/headcount/dashboard', roles: ALL },
  { module: M08, label: 'Headcount — Jadual (config 213)', path: '/headcount/213', roles: ADMIN },
  {
    module: M08,
    label: 'Headcount — Ringkasan (config 213)',
    path: '/headcount/213/summary',
    roles: ADMIN,
  },
  {
    module: M08,
    label: 'Headcount — Murid 3201',
    path: '/headcount/student/3201',
    roles: ADMIN,
  },
  { module: M08, label: 'Kedudukan', path: '/ranking', roles: ALL },
  { module: M08, label: 'Papan Pendahulu', path: '/leaderboard', roles: ALL },
  { module: M08, label: 'Timeline Saya', path: '/timeline', roles: ALL },
  { module: M08, label: 'Tambah Post (Timeline)', path: '/timeline/create', roles: ALL },
  { module: M08, label: 'Profil Awam (Admin Demo)', path: '/pelajar/1', roles: ALL },
  { module: M08, label: 'Profil Awam (Pelajar Demo)', path: '/pelajar/2', roles: ALL },
]

export interface PreviewHubGroup {
  module: string
  links: PreviewHubLink[]
}

/** Links visible to `role`, grouped by module in first-seen order. Empty groups are dropped. */
export function groupLinksForRole(
  role: Role | null,
  links: readonly PreviewHubLink[] = PREVIEW_HUB_LINKS,
): PreviewHubGroup[] {
  if (role === null) return []
  const groups: PreviewHubGroup[] = []
  for (const link of links) {
    if (!link.roles.includes(role)) continue
    const group = groups.find((g) => g.module === link.module)
    if (group) group.links.push(link)
    else groups.push({ module: link.module, links: [link] })
  }
  return groups
}
