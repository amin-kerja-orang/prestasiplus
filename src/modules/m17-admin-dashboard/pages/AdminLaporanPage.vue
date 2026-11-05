<script setup lang="ts">
/**
 * M-06 `/admin/laporan` "Laporan - Admin Panel" (PRD-30 R1-ADM-M-06; FR-ADM-M06.1..M06.3; API-ADM-13).
 * Regions in order: the eight tiles, `Trend Aktiviti (14 hari)`, `Pecahan Aktiviti`, `Pelajar Paling Aktif
 * (Top 10)`, the notice when every teacher has accessed, and `Aktiviti Mengikut Sekolah`. Accuracy is a
 * whole-number percent rounded half up. Failed: "Tidak dapat dimuatkan." with `Cuba lagi`.
 */
import type { TableColumn } from '@nuxt/ui'
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsCallout,
  DsChart,
  DsDataTable,
  DsEmptyState,
  DsGrid,
  DsListRow,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStateView,
  DsStatTile,
} from '@/ds'
import { formatCount, formatPercent, percentOf } from '@/lib/number'

import { fetchAdminLaporan } from '../api/command-center'

const { data, error, loading, reload } = useApi((signal) => fetchAdminLaporan('30', { signal }))

const n = (v: number): string => formatCount(v)
const pct = (v: number): string => formatPercent(v, { decimals: 0 })

const empty = computed(() => {
  const t = data.value?.tiles
  return (
    t !== undefined && t.schools === 0 && t.pupils === 0 && t.teachers === 0 && t.activities === 0
  )
})
const trendLabels = computed(() => (data.value?.trend ?? []).map((p) => p.date))
const trendSeries = computed(() => {
  const trend = data.value?.trend ?? []
  return trend.some((p) => p.count > 0)
    ? [{ label: 'Aktiviti', data: trend.map((p) => p.count) }]
    : []
})
const allTeachersAccessed = computed(() => {
  const t = data.value?.tiles
  return t !== undefined && t.teachers > 0 && t.teachersAccessed >= t.teachers
})

interface PupilItem extends Record<string, unknown> {
  no: number
  name: string
  school: string
  activities: string
}
const pupilItems = computed<PupilItem[]>(() =>
  (data.value?.mostActive ?? []).map((p, i) => ({
    no: i + 1,
    name: p.name,
    school: p.school?.name ?? '-',
    activities: n(p.activities),
  })),
)
const pupilColumns: TableColumn<PupilItem>[] = [
  { accessorKey: 'no', header: '#' },
  { accessorKey: 'name', header: 'Pelajar' },
  { accessorKey: 'school', header: 'Sekolah' },
  { accessorKey: 'activities', header: 'Aktiviti' },
]
</script>

<template>
  <DsPage layout="report" data-testid="adm-laporan">
    <DsLoadError
      v-if="error && !data"
      message="Tidak dapat dimuatkan."
      retry-label="Cuba lagi"
      testid="adm-laporan-error"
      @retry="reload"
    />
    <DsStateView
      v-else-if="!data && loading"
      status="loading"
      skeleton="stats"
      :rows="4"
      data-testid="adm-laporan-loading"
    />
    <DsPanel v-else-if="empty" data-testid="adm-laporan-empty">
      <DsEmptyState size="sm" title="Tiada data laporan." icon="file-text" />
    </DsPanel>
    <template v-else-if="data">
      <DsGrid min-item="xs" gap="md" data-testid="adm-lp-tiles">
        <DsStatTile
          :value="data.tiles.schools"
          unit="Sekolah"
          icon="buildings"
          part-prefix="lp-schools"
        />
        <DsStatTile
          :value="data.tiles.teachers"
          unit="Guru"
          icon="chalkboard-teacher"
          part-prefix="lp-teachers"
        />
        <DsStatTile :value="data.tiles.pupils" unit="Murid" icon="users" part-prefix="lp-pupils" />
        <DsStatTile
          :value="`${n(data.tiles.pupilsAccessed)} / ${n(data.tiles.pupils)}`"
          unit="Murid Pernah Akses"
          :sub="pct(percentOf(data.tiles.pupilsAccessed, data.tiles.pupils))"
          icon="sign-in"
          part-prefix="lp-pupils-accessed"
        />
        <DsStatTile
          :value="`${n(data.tiles.teachersAccessed)} / ${n(data.tiles.teachers)}`"
          unit="Cikgu Pernah Akses"
          :sub="pct(percentOf(data.tiles.teachersAccessed, data.tiles.teachers))"
          icon="sign-in"
          part-prefix="lp-teachers-accessed"
        />
        <DsStatTile
          :value="data.tiles.pupilsPractised"
          unit="Murid Buat Latihan"
          icon="pencil-simple"
          part-prefix="lp-practised"
        />
        <DsStatTile
          :value="data.tiles.activities"
          unit="Jumlah Aktiviti"
          sub="30 hari lepas"
          icon="chart-line-up"
          part-prefix="lp-activity"
        />
        <DsStatTile
          :value="data.tiles.averageScore === null ? null : pct(data.tiles.averageScore)"
          unit="Skor Purata"
          sub="purata ketepatan sesi"
          icon="target"
          part-prefix="lp-score"
        />
      </DsGrid>

      <DsPanel as="section" data-testid="adm-lp-trend">
        <DsChart
          type="line"
          title="Trend Aktiviti (14 hari)"
          :labels="trendLabels"
          :series="trendSeries"
          empty-label="Tiada aktiviti dalam 14 hari lepas."
          table-label="Aktiviti setiap hari"
        />
      </DsPanel>

      <DsGrid min-item="md" gap="md">
        <DsPanel title="Pecahan Aktiviti" as="section" data-testid="adm-lp-breakdown">
          <DsEmptyState
            v-if="data.breakdown.length === 0"
            size="sm"
            title="Tiada aktiviti direkodkan."
          />
          <DsStack v-else as="ul" gap="sm">
            <DsListRow
              v-for="b in data.breakdown"
              :key="b.label"
              :title="b.label"
              :meta="b.count"
            />
          </DsStack>
        </DsPanel>

        <DsPanel title="Aktiviti Mengikut Sekolah" as="section" data-testid="adm-lp-schools">
          <DsEmptyState
            v-if="data.schoolActivity.length === 0"
            size="sm"
            title="Tiada aktiviti sekolah."
          />
          <DsStack v-else as="ul" gap="sm">
            <DsListRow
              v-for="(s, i) in data.schoolActivity"
              :key="s.schoolId"
              :rank="i + 1"
              :title="s.name"
              :sub="`${n(s.activePupils)} murid aktif`"
              :meta="s.activities"
            />
          </DsStack>
        </DsPanel>
      </DsGrid>

      <DsPanel title="Pelajar Paling Aktif (Top 10)" as="section" data-testid="adm-lp-pupils">
        <DsEmptyState v-if="pupilItems.length === 0" size="sm" title="Tiada aktiviti pelajar." />
        <DsDataTable
          v-else
          :data="pupilItems"
          :columns="pupilColumns"
          pager="none"
          variant="bare"
          caption="Pelajar Paling Aktif (Top 10)"
          card-title="name"
          :card-fields="[
            { key: 'school', label: 'Sekolah' },
            { key: 'activities', label: 'Aktiviti' },
          ]"
        />
      </DsPanel>

      <DsCallout v-if="allTeachersAccessed" tone="info" data-testid="adm-lp-teachers-notice">
        Semua guru telah mengakses platform.
      </DsCallout>
    </template>
  </DsPage>
</template>
