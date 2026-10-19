<script setup lang="ts">
/**
 * S5 `/prestasi/kelas/{id}` "Dashboard Kelas" (M08-T7; FR-M08-31…36, BR-M08-10). An unknown class or one
 * the viewer may not open is the standard 404 (FR-M08-07). The shell header is "{kelas}" with the
 * subtitle "{sekolah} · {subjek} · {tahun}" (FR-M08-03).
 */
import { computed, watchEffect } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import type { TableColumn } from '@nuxt/ui'

import {
  DsBackLink,
  DsChart,
  DsDataTable,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPageHeader,
  DsPanel,
  DsStatRow,
  DsStack,
  DsGrid,
  DsHeading,
  DsText,
} from '@/ds'
import { usePageMeta } from '@/composables/usePageMeta'
import { formatNumber } from '@/lib/number'
import { diffForHumans } from '@/lib/time'

import { fetchClassDashboard } from '../api/class'
import { fetchOwnClasses } from '../api/performance'
import ClassHeadcountBlock from '../components/prestasi/ClassHeadcountBlock.vue'
import { classAccuracySeries, classSessionSeries } from '../lib/prestasi/class-chart'
import { capPct, pctTrim, plain } from '../lib/prestasi/format'
import { isLoadError, useRouteData, LOAD_ERROR } from '../lib/prestasi/load'
import { useStatItems, type StatSpec } from '../lib/stat-items'

const statItems = useStatItems()

const route = useRoute()
const router = useRouter()
const pageMeta = usePageMeta()
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

const stats = computed<StatSpec[]>(() => {
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
    <DsLoadError v-if="loadFailed" :message="LOAD_ERROR" testid="page-error" @retry="reload()" />

    <template v-else-if="data">
      <DsPageHeader
        :show-title="true"
        :title="data.class.name"
        :subtitle="subtitle"
        title-testid="class-name"
        subtitle-testid="class-sub"
      >
        <template #breadcrumb>
          <DsBackLink
            to="/prestasi/kelas"
            label="Kembali ke senarai kelas"
            title="Kembali ke senarai kelas"
            data-testid="back-link"
          />
        </template>
        <template #subtitle>
          {{ subtitle }} · Kod: <b class="tabular text-primary-t">{{ data.class.joinCode }}</b>
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
      </DsPageHeader>

      <DsStatRow :items="statItems(stats)" data-testid="stat-cards" :cols="5" prefix="stat" />

      <ClassHeadcountBlock v-if="data.headcount" :block="data.headcount" />

      <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-3">
        <DsPanel class="min-w-0 lg:col-span-1" data-testid="attention">
          <DsStack gap="sm">
            <DsHeading :level="2" variant="subheading">
              ⚠️ Perlu Perhatian
              <DsText variant="label" tone="error" data-testid="attention-count"
                >({{ data.attention.length }})</DsText
              >
            </DsHeading>
            <DsStack gap="xs" class="max-h-96 overflow-y-auto" data-testid="attention-list">
              <RouterLink
                v-for="a in data.attention"
                :key="a.userId"
                :to="`/prestasi/${a.userId}`"
                class="flex min-h-11 items-center gap-3 bg-soft p-3"
                :data-testid="`attention-${a.userId}`"
              >
                <span class="flex min-w-0 grow flex-col">
                  <DsText variant="label" tone="highlighted" wrap="anywhere">{{ a.name }}</DsText>
                  <DsText variant="caption" as="span">{{
                    a.accuracy === null
                      ? 'Belum mula berlatih'
                      : `${a.sessions} sesi · ${pctTrim(a.accuracy)} ketepatan`
                  }}</DsText>
                </span>
                <UBadge
                  v-if="a.accuracy === null"
                  color="neutral"
                  variant="subtle"
                  label="Tak Aktif"
                />
                <UBadge v-else color="error" variant="subtle" :label="pctTrim(a.accuracy)" />
              </RouterLink>
            </DsStack>
          </DsStack>
        </DsPanel>

        <DsPanel class="min-w-0 lg:col-span-2" data-testid="trend">
          <DsStack>
            <DsHeading :level="2" variant="subheading">📈 Trend Aktiviti Kelas (30 Hari)</DsHeading>
            <DsGrid v-if="data.trend.length > 0" :cols="{ base: 1, xl: 2 }">
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
            </DsGrid>
            <div v-else data-testid="trend-empty">
              <DsEmptyState title="Belum ada aktiviti dalam 30 hari terakhir." icon="tray" />
            </div>
          </DsStack>
        </DsPanel>
      </div>

      <DsStack as="section" gap="sm" data-testid="ranking-card">
        <DsHeading :level="2" variant="subheading">🏆 Kedudukan Murid</DsHeading>
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
            <DsText
              variant="label"
              tone="highlighted"
              :data-testid="`rank-row-${row.original.userId}`"
              >{{ row.original.name }}</DsText
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
      </DsStack>
    </template>
    <div
      v-else-if="!error"
      class="flex flex-col gap-4 md:gap-6"
      aria-busy="true"
      data-testid="page-loading"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
