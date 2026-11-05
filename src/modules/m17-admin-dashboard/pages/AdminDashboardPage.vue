<script setup lang="ts">
/**
 * M-01 `/admin` "Dashboard - Admin Panel" (PRD-30 R1-ADM-M-01; FR-ADM-M01.1..M01.4; API-ADM-11).
 * Regions: the stat tiles (each links to its filtered list; the question counts come from the same query as
 * the Studio, so the figures agree), `Tindakan Pantas`, `Taburan Status Soalan` and `Pautan Pantas`.
 * `Soalan Terkini` needs data that `AdminDashboard` does not return and the sponsor tiles and CSV downloads
 * are not built in R1, so they are not drawn. The tiles come from one call: when it fails they all show
 * "Tidak dapat dimuatkan." with `Cuba lagi`.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsChart, DsGrid, DsListRow, DsLoadError, DsPage, DsPanel, DsStack, DsStatTile } from '@/ds'
import { formatCount } from '@/lib/number'

import { fetchAdminDashboard } from '../api/command-center'

const STUDIO = '/admin/studio'
const { data, error, loading, reload } = useApi((signal) => fetchAdminDashboard({ signal }))

const n = (v: number): string => formatCount(v)

const tiles = computed(() => {
  const d = data.value
  if (!d) return []
  const q = d.questions
  return [
    {
      key: 'aktif',
      unit: 'Soalan Aktif',
      value: q.total,
      sub: `Minggu ini: ${n(q.thisWeek)}`,
      icon: 'question',
      to: STUDIO,
    },
    {
      key: 'lulus',
      unit: 'Diluluskan',
      value: q.byStatus.approved,
      sub: `Aktif digunakan: ${n(q.byStatus.approved)}`,
      icon: 'check-circle',
      to: { path: STUDIO, query: { status: 'approved' } },
    },
    {
      key: 'semak',
      unit: 'Menunggu Semakan',
      value: q.byStatus.review,
      sub: 'Perlu tindakan',
      icon: 'hourglass',
      to: { path: STUDIO, query: { status: 'review' } },
    },
    {
      key: 'draf',
      unit: 'Draf',
      value: q.byStatus.draft,
      sub: 'Belum siap',
      icon: 'pencil-simple',
      to: { path: STUDIO, query: { status: 'draft' } },
    },
    {
      key: 'subjek',
      unit: 'Subjek',
      value: d.subjects.total,
      sub: `${n(d.subjects.active)} Aktif`,
      icon: 'books',
      to: '/admin/subjects',
    },
    {
      key: 'tahap',
      unit: 'Tahap Pendidikan',
      value: d.levels,
      sub: 'Tingkatan',
      icon: 'graduation-cap',
      to: '/admin/education-levels',
    },
    {
      key: 'pengguna',
      unit: 'Pengguna',
      value: d.users.total,
      sub: `${n(d.users.students)} Pelajar`,
      icon: 'users',
      to: '/admin/users',
    },
    {
      key: 'battle',
      unit: 'Battle Arena',
      value: d.battles.total,
      sub: `PvP Quiz Battles · ${n(d.battles.total)} Total · ${n(d.battles.active)} Aktif · ${n(d.battles.finished)} Selesai`,
      icon: 'sword',
    },
  ]
})

const statusLabels = ['Draf', 'Menunggu Semakan', 'Diluluskan', 'Diarkibkan']
const statusEmpty = computed(() => (data.value?.questions.total ?? 0) === 0)
const statusSeries = computed(() => {
  const s = data.value?.questions.byStatus
  return s && !statusEmpty.value
    ? [{ label: 'Soalan', data: [s.draft, s.review, s.approved, s.archived] }]
    : []
})

const quickActions = [
  { title: 'Tambah Soalan Baru', to: `${STUDIO}/questions/create` },
  { title: 'Tambah Subjek Baru', to: '/admin/subjects/create' },
  { title: 'Import & Semakan Soalan', to: '/admin/questions/import' },
]
const quickLinks = [
  { title: 'Kurikulum', to: '/admin/curriculum' },
  { title: 'Banner', to: '/admin/banners' },
  { title: 'Artikel', to: '/admin/articles' },
]
</script>

<template>
  <DsPage layout="dashboard" data-testid="adm-dashboard">
    <DsLoadError
      v-if="error && !data"
      message="Tidak dapat dimuatkan."
      retry-label="Cuba lagi"
      testid="adm-dashboard-error"
      @retry="reload"
    />
    <template v-else>
      <DsGrid min-item="xs" gap="md" data-testid="adm-tiles" aria-label="Ringkasan">
        <template v-if="!data">
          <DsStatTile v-for="i in 8" :key="i" :value="null" unit="" loading />
        </template>
        <DsStatTile
          v-for="t in tiles"
          :key="t.key"
          :value="t.value"
          :unit="t.unit"
          :sub="t.sub"
          :icon="t.icon"
          :loading="loading && !data"
          :part-prefix="`adm-tile-${t.key}`"
          v-bind="t.to ? { to: t.to } : {}"
        />
      </DsGrid>

      <DsGrid min-item="md" gap="md">
        <DsPanel title="Tindakan Pantas" as="section">
          <DsStack as="ul" gap="sm" data-testid="adm-actions">
            <DsListRow v-for="a in quickActions" :key="a.to" :title="a.title" :to="a.to" />
          </DsStack>
        </DsPanel>
        <DsPanel title="Pautan Pantas" as="section">
          <DsStack as="ul" gap="sm" data-testid="adm-links">
            <DsListRow v-for="a in quickLinks" :key="a.to" :title="a.title" :to="a.to" />
          </DsStack>
        </DsPanel>
      </DsGrid>

      <DsPanel as="section">
        <DsChart
          type="doughnut"
          title="Taburan Status Soalan"
          :labels="statusLabels"
          :series="statusSeries"
          :loading="!data"
          empty-label="Tiada soalan."
          table-label="Taburan Status Soalan"
          data-testid="adm-status-chart"
        />
      </DsPanel>
    </template>
  </DsPage>
</template>
