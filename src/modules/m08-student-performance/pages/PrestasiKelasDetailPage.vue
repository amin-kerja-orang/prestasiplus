<script setup lang="ts">
/**
 * S5 `/prestasi/kelas/{id}` "Dashboard Kelas" (M08-T7; FR-M08-31…36, BR-M08-10). An unknown class or one
 * the viewer may not open is the standard 404 (FR-M08-07). The shell header is "{kelas}" with the
 * subtitle "{sekolah} · {subjek} · {tahun}" (FR-M08-03).
 */
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import { DsChart, DsDataTable, DsEmptyState, DsPage } from '@/ds'
import { usePageMeta } from '@/composables/usePageMeta'
import { formatNumber } from '@/lib/number'
import { diffForHumans } from '@/lib/time'

import { fetchClassDashboard } from '../api/class'
import { fetchOwnClasses } from '../api/performance'
import ClassHeadcountBlock from '../components/prestasi/ClassHeadcountBlock.vue'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import StatGrid, { type StatItem } from '../components/shared/StatGrid.vue'
import { usePhIcon } from '../lib/icons'
import { classAccuracySeries, classSessionSeries } from '../lib/prestasi/class-chart'
import { capPct, pctTrim, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
const icon = usePhIcon()
const classId = computed(() => Number(route.params.id))

const { data, error, reload } = useRouteData(
  (signal) => fetchClassDashboard(classId.value, { signal }),
  () => classId.value,
)
const own = useRouteData((signal) => fetchOwnClasses({ signal }))
const loadFailed = computed(() => isLoadError(error.value))

const subtitle = computed(() => {
  const c = data.value?.class
  if (!c) return ''
  return [c.school, c.subject, String(c.year)].filter((p) => p !== null && p !== '').join(' · ')
})
watchEffect(() => {
  const c = data.value?.class
  if (!c) return
  pageMeta.setTitle(`${c.name} — Dashboard Kelas`)
  pageMeta.setHeader({ title: c.name, subtitle: subtitle.value })
})

const classItems = computed(() =>
  (own.data.value ?? []).map((c) => ({ label: c.name, value: `/prestasi/kelas/${c.id}` })),
)
function switchClass(value: string | undefined): void {
  if (value) void router.push(value)
}

const accuracyChart = computed(() => classAccuracySeries(data.value?.trend ?? []))
const sessionChart = computed(() => classSessionSeries(data.value?.trend ?? []))

const minutes = (n: number): string =>
  `${formatNumber(n, { decimals: 1, dropZeroFraction: true })}m`

const stats = computed<StatItem[]>(() => {
  const s = data.value?.stats
  if (!s) return []
  return [
    { id: 'murid', label: 'Jumlah Murid', value: plain(s.students), icon: 'users' },
    {
      id: 'ketepatan',
      label: 'Purata Ketepatan',
      value: pctTrim(capPct(s.accuracy)),
      icon: 'target',
    },
    { id: 'sesi', label: 'Jumlah Sesi', value: plain(s.sessions), icon: 'lightning' },
    { id: 'soalan', label: 'Soalan Dijawab', value: plain(s.answered), icon: 'question' },
    { id: 'masa', label: 'Purata Masa/Sesi', value: minutes(s.avgMinutes), icon: 'clock' },
    { id: 'aktif', label: 'Aktif 7 Hari', value: plain(s.active7d), icon: 'fire', accent: 'heat' },
  ]
})

const MEDAL = ['🥇', '🥈', '🥉']
const HEADCOUNT = {
  on: { text: 'On Track', color: 'success' },
  below: { text: 'Below', color: 'error' },
  na: { text: 'N/A', color: 'neutral' },
} as const

const headcountColor = (h: 'on' | 'below' | 'na') => HEADCOUNT[h].color

interface Row extends Record<string, unknown> {
  userId: number
  rankText: string
  name: string
  sessions: number
  answered: number
  accuracyText: string
  headcount: 'on' | 'below' | 'na'
  headcountText: string
  lastActive: string
}
const rows = computed<Row[]>(() =>
  (data.value?.ranking ?? []).map((r) => ({
    userId: r.userId,
    rankText: MEDAL[r.rank - 1] ?? String(r.rank),
    name: r.name,
    sessions: r.sessions,
    answered: r.answered,
    accuracyText: r.accuracy === null ? '—' : pctTrim(r.accuracy),
    headcount: r.headcount,
    headcountText: HEADCOUNT[r.headcount].text,
    lastActive: r.lastActiveAt === null ? '—' : diffForHumans(r.lastActiveAt),
  })),
)
const columns: TableColumn<Row>[] = [
  { accessorKey: 'rankText', header: '#' },
  { accessorKey: 'name', header: 'Nama' },
  { accessorKey: 'sessions', header: 'Sesi' },
  { accessorKey: 'answered', header: 'Soalan' },
  { accessorKey: 'accuracyText', header: 'Ketepatan' },
  { accessorKey: 'headcountText', header: 'Headcount' },
  { accessorKey: 'lastActive', header: 'Terakhir Aktif' },
  { accessorKey: 'userId', header: 'Aksi' },
]
const cardFields = [
  { key: 'rankText', label: '#' },
  { key: 'sessions', label: 'Sesi' },
  { key: 'answered', label: 'Soalan' },
  { key: 'accuracyText', label: 'Ketepatan' },
  { key: 'headcountText', label: 'Headcount' },
  { key: 'lastActive', label: 'Terakhir Aktif' },
]
</script>

<template>
  <DsPage data-testid="prestasi-kelas-detail-page">
    <PageLoadError v-if="loadFailed" @retry="reload()" />

    <template v-else-if="data">
      <PageHeader
        :title="data.class.name"
        :subtitle="subtitle"
        title-testid="class-name"
        subtitle-testid="class-sub"
      >
        <template #leading>
          <UButton
            to="/prestasi/kelas"
            color="neutral"
            variant="ghost"
            size="lg"
            :icon="icon('arrow-left')"
            aria-label="Kembali ke senarai kelas"
            title="Kembali ke senarai kelas"
            data-testid="back-link"
          />
        </template>
        <template #subtitle>
          {{ subtitle }} · Kod: <b class="tabular text-primary">{{ data.class.joinCode }}</b>
        </template>
        <template #actions>
          <USelect
            :items="classItems"
            placeholder="Tukar Kelas..."
            aria-label="Tukar Kelas"
            size="lg"
            class="w-full sm:w-56"
            data-testid="switch-class"
            @update:model-value="(v: string | undefined) => switchClass(v)"
          />
        </template>
      </PageHeader>

      <StatGrid :items="stats" :columns="6" />

      <ClassHeadcountBlock v-if="data.headcount" :block="data.headcount" />

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <UCard class="min-w-0 lg:col-span-1" data-testid="attention">
          <div class="flex flex-col gap-3">
            <h2 class="text-subheading text-highlighted">
              ⚠️ Perlu Perhatian
              <span class="text-label text-error" data-testid="attention-count"
                >({{ data.attention.length }})</span
              >
            </h2>
            <div class="flex max-h-96 flex-col gap-2 overflow-y-auto" data-testid="attention-list">
              <RouterLink
                v-for="a in data.attention"
                :key="a.userId"
                :to="`/prestasi/${a.userId}`"
                class="flex min-h-11 items-center gap-3 bg-soft p-3"
                :data-testid="`attention-${a.userId}`"
              >
                <span class="flex min-w-0 grow flex-col">
                  <span class="text-label break-words text-highlighted">{{ a.name }}</span>
                  <span class="text-caption text-muted">{{
                    a.accuracy === null
                      ? 'Belum mula berlatih'
                      : `${a.sessions} sesi · ${pctTrim(a.accuracy)} ketepatan`
                  }}</span>
                </span>
                <UBadge
                  v-if="a.accuracy === null"
                  color="neutral"
                  variant="subtle"
                  label="Tak Aktif"
                />
                <UBadge v-else color="error" variant="subtle" :label="pctTrim(a.accuracy)" />
              </RouterLink>
            </div>
          </div>
        </UCard>

        <UCard class="min-w-0 lg:col-span-2" data-testid="trend">
          <div class="flex flex-col gap-4">
            <h2 class="text-subheading text-highlighted">📈 Trend Aktiviti Kelas (30 Hari)</h2>
            <div v-if="data.trend.length > 0" class="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <DsChart
                title="Purata Ketepatan (%)"
                type="line"
                :labels="accuracyChart.labels"
                :series="accuracyChart.series"
                unit="%"
                data-testid="class-trend-chart"
              />
              <DsChart
                title="Sesi"
                type="line"
                :labels="sessionChart.labels"
                :series="sessionChart.series"
              />
            </div>
            <div v-else data-testid="trend-empty">
              <DsEmptyState title="Belum ada aktiviti dalam 30 hari terakhir." icon="i-ph-tray" />
            </div>
          </div>
        </UCard>
      </div>

      <section class="flex min-w-0 flex-col gap-3" data-testid="ranking-card">
        <h2 class="text-subheading text-highlighted">🏆 Kedudukan Murid</h2>
        <DsDataTable
          :data="rows"
          :columns="columns"
          caption="Kedudukan murid"
          card-title="name"
          :card-fields="cardFields"
          :page-size="100"
          data-testid="ranking-table"
        >
          <template #name-cell="{ row }">
            <span
              class="text-label text-highlighted"
              :data-testid="`rank-row-${row.original.userId}`"
              >{{ row.original.name }}</span
            >
          </template>
          <template #accuracyText-cell="{ row }">
            <span data-testid="rank-acc">{{ row.original.accuracyText }}</span>
          </template>
          <template #headcountText-cell="{ row }">
            <UBadge
              :color="headcountColor(row.original.headcount)"
              variant="subtle"
              :label="row.original.headcountText"
              data-testid="rank-badge"
            />
          </template>
          <template #userId-cell="{ row }">
            <UButton
              :to="`/prestasi/${row.original.userId}`"
              color="neutral"
              variant="link"
              class="min-h-11"
              label="Lihat →"
            />
          </template>
          <template #card-actions="{ row }">
            <UButton
              :to="`/prestasi/${String(row.userId)}`"
              color="neutral"
              variant="soft"
              size="lg"
              label="Lihat →"
            />
          </template>
        </DsDataTable>
      </section>
    </template>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
