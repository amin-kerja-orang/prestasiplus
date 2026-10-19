<script setup lang="ts">
/**
 * S8 `/practice/progress` "Kemajuan Saya" (M05 discovery 2.8; v2 learner theme). Period chips, four
 * stat tiles, then either the empty state or "Trend Ketepatan", "Topik Perlu Perhatian" and
 * "Prestasi Mengikut Subjek". An unknown `?period=` leaves every chip inactive with zero figures.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import {
  DsChart,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsPillNav,
  DsStatRow,
  type PillItem,
  type StatItem,
  DsStack,
  DsGrid,
  DsCluster,
  DsText,
  DsHeading,
} from '@/ds'

import { fetchProgress } from '../api/practice'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const PERIODS = [
  { value: '7', label: '7 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '90', label: '3 Bulan' },
  { value: 'all', label: 'Semua' },
] as const

const PERIOD_ITEMS: PillItem<string>[] = PERIODS.map((p) => ({
  key: p.value,
  label: p.label,
  to: { path: '/practice/progress', query: { period: p.value } },
}))

const route = useRoute()
const period = computed(() => {
  const p = route.query.period
  return typeof p === 'string' ? p : '30'
})

const { data, error, reload } = useApi(
  (signal) => fetchProgress(period.value, { signal }),
  () => period.value,
)

const hasData = computed(() => (data.value?.answered ?? 0) > 0)
const accuracy = computed(() =>
  data.value?.accuracyPct == null ? '0%' : `${data.value.accuracyPct}%`,
)
const minutes = computed(() => `${data.value?.minutes ?? 0}m`)

const stats = computed<StatItem[]>(() => [
  {
    key: 'answered',
    label: 'Soalan Dijawab',
    value: data.value?.answered ?? 0,
    icon: 'i-ph-note-pencil',
    accent: 'action',
  },
  {
    key: 'accuracy',
    label: 'Ketepatan Keseluruhan',
    value: accuracy.value,
    icon: 'i-ph-target',
    accent: 'win',
  },
  {
    key: 'sessions',
    label: 'Sesi Latihan',
    value: data.value?.sessions ?? 0,
    icon: 'i-ph-clipboard-text',
    accent: 'heat',
  },
  {
    key: 'minutes',
    label: 'Masa Berlatih',
    value: minutes.value,
    icon: 'i-ph-timer',
    accent: 'friend',
  },
])

/** Red below 50, amber 50-69, green from 70 (INFERRED bands, as live). */
function tone(pct: number): string {
  return pct < 50 ? 'text-error' : pct < 70 ? 'text-warning' : 'text-success'
}

/** Sparkline points in a 120 x 30 box: y = 2 + (max - v) / (max - min) * 26. */
function spark(values: number[]): string {
  if (values.length === 0) return ''
  const max = Math.max(...values)
  const min = Math.min(...values)
  const step = values.length > 1 ? 120 / (values.length - 1) : 0
  return values
    .map((v, i) => {
      const y = max === min ? 15 : 2 + ((max - v) / (max - min)) * 26
      return `${Math.round(i * step * 10) / 10},${Math.round(y * 10) / 10}`
    })
    .join(' ')
}
const trendUp = (values: number[]): boolean => values[values.length - 1]! >= values[0]!
</script>

<template>
  <DsPage
    title="Kemajuan Saya"
    subtitle="Pantau prestasi dan kenal pasti topik lemah"
    data-testid="progress-page"
  >
    <DsPillNav
      :items="PERIOD_ITEMS"
      :active="period"
      label="Tempoh"
      testid-prefix="progress-period"
      data-testid="progress-periods"
    />

    <template v-if="data">
      <DsStatRow :items="stats" :cols="4" prefix="progress-stat" data-testid="progress-stats" />

      <DsPanel v-if="!hasData" data-testid="progress-empty">
        <DsEmptyState
          title="Belum Ada Data"
          description="Mula buat latihan untuk lihat kemajuan kamu di sini!"
          icon="chart-bar"
        >
          <template #actions>
            <UButton to="/practice" size="lg" class="min-h-11">Mula Latihan</UButton>
          </template>
        </DsEmptyState>
      </DsPanel>

      <template v-else>
        <DsPanel data-testid="progress-trend">
          <DsChart
            type="line"
            title="Trend Ketepatan"
            :labels="data.chart.labels"
            :series="[{ label: 'Ketepatan (%)', data: data.chart.accuracy }]"
            unit="%"
          />
        </DsPanel>

        <DsPanel
          v-if="data.weakSubjects.length > 0"
          title="Topik Perlu Perhatian"
          icon="warning"
          accent="heat"
          data-testid="progress-weak"
        >
          <DsStack as="ul" gap="xs">
            <li v-for="w in data.weakSubjects" :key="w.code" class="min-w-0">
              <DsPanel
                tone="inset"
                class="flex flex-wrap items-center gap-3"
                data-testid="progress-weak-row"
              >
                <UAvatar :text="w.name.slice(0, 2).toUpperCase()" size="lg" aria-hidden="true" />
                <div class="min-w-0 flex-1">
                  <DsText variant="label" as="p" tone="highlighted" truncate>{{ w.name }}</DsText>
                  <DsText variant="caption">{{ w.answered }} soalan</DsText>
                </div>
                <DsText variant="label" tone="error" tabular>{{ w.accuracyPct }}%</DsText>
                <UButton :to="`/practice/${w.code}`" size="md" class="min-h-11" variant="soft"
                  >Ulang Kaji</UButton
                >
              </DsPanel>
            </li>
          </DsStack>
        </DsPanel>

        <DsStack as="section" gap="sm" data-testid="progress-subjects">
          <DsHeading :level="2" variant="subheading">Prestasi Mengikut Subjek</DsHeading>
          <DsGrid :cols="{ base: 1, md: 2, lg: 3 }" gap="sm" as="ul">
            <li v-for="s in data.subjects" :key="s.code" class="min-w-0">
              <DsPanel class="h-full" data-testid="progress-subject">
                <DsCluster :wrap="false">
                  <UAvatar :text="s.name.slice(0, 2).toUpperCase()" size="lg" aria-hidden="true" />
                  <div class="min-w-0 flex-1">
                    <DsText variant="label" as="p" tone="highlighted" truncate>{{ s.name }}</DsText>
                    <DsText variant="caption">{{ s.answered }} soalan dijawab</DsText>
                  </div>
                  <span class="tabular text-label" :class="tone(s.accuracyPct)"
                    >{{ s.accuracyPct }}%</span
                  >
                </DsCluster>
                <UProgress class="mt-3" :model-value="s.accuracyPct" :max="100" />
                <div class="mt-3 flex items-center gap-2 text-caption text-muted">
                  <span>Trend:</span>
                  <svg
                    v-if="s.trend.length > 0"
                    viewBox="0 0 120 30"
                    class="h-8 w-30 text-primary-t"
                    aria-hidden="true"
                  >
                    <polyline
                      :points="spark(s.trend)"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="2"
                    />
                  </svg>
                  <span v-if="s.trend.length >= 2" aria-hidden="true">{{
                    trendUp(s.trend) ? '▲' : '▼'
                  }}</span>
                </div>
                <p class="mt-2 text-caption text-muted">
                  {{ s.correct }} betul · {{ s.wrong }} salah
                </p>
              </DsPanel>
            </li>
          </DsGrid>
        </DsStack>
      </template>
    </template>

    <DsLoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="progress-retry"
      @retry="reload"
    />

    <DsStack v-else role="status" aria-label="Memuatkan kemajuan" data-testid="progress-loading">
      <DsGrid :cols="{ base: 2, lg: 4 }" gap="sm">
        <USkeleton v-for="i in 4" :key="i" class="h-24" />
      </DsGrid>
      <USkeleton class="h-64" />
    </DsStack>
  </DsPage>
</template>
