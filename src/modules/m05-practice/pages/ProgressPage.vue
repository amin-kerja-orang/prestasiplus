<script setup lang="ts">
/**
 * S8 `/practice/progress` "Kemajuan Saya" (M05 discovery 2.8; v2 learner theme). Period chips, four
 * stat tiles, then either the empty state or "Trend Ketepatan", "Topik Perlu Perhatian" and
 * "Prestasi Mengikut Subjek". An unknown `?period=` leaves every chip inactive with zero figures.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsChart, DsEmptyState, DsStatTile } from '@/ds'

import { fetchProgress } from '../api/practice'
import LoadError from '../components/quiz/LoadError.vue'

const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
const PERIODS = [
  { value: '7', label: '7 Hari' },
  { value: '30', label: '30 Hari' },
  { value: '90', label: '3 Bulan' },
  { value: 'all', label: 'Semua' },
] as const

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
  <div class="flex min-w-0 flex-col gap-4 md:gap-6" data-testid="progress-page">
    <div class="flex flex-col gap-1">
      <h1 class="text-title text-highlighted">Kemajuan Saya</h1>
      <p class="max-w-prose text-body text-muted">Pantau prestasi dan kenal pasti topik lemah</p>
    </div>

    <nav class="flex flex-wrap gap-2" aria-label="Tempoh" data-testid="progress-periods">
      <UButton
        v-for="p in PERIODS"
        :key="p.value"
        :to="{ path: '/practice/progress', query: { period: p.value } }"
        size="lg"
        class="min-h-11"
        :color="period === p.value ? 'primary' : 'neutral'"
        :variant="period === p.value ? 'solid' : 'soft'"
        :aria-current="period === p.value ? 'true' : undefined"
        :data-active="period === p.value ? 'true' : 'false'"
        data-testid="progress-period"
        >{{ p.label }}</UButton
      >
    </nav>

    <template v-if="data">
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="progress-stats">
        <DsStatTile :value="data.answered" unit="Soalan Dijawab" icon="i-ph-note-pencil" />
        <DsStatTile :value="accuracy" unit="Ketepatan Keseluruhan" icon="i-ph-target" />
        <DsStatTile :value="data.sessions" unit="Sesi Latihan" icon="i-ph-clipboard-text" />
        <DsStatTile :value="minutes" unit="Masa Berlatih" icon="i-ph-timer" />
      </div>

      <UCard v-if="!hasData" data-testid="progress-empty">
        <DsEmptyState
          title="Belum Ada Data"
          description="Mula buat latihan untuk lihat kemajuan kamu di sini!"
          icon="i-ph-chart-bar"
        >
          <template #actions>
            <UButton to="/practice" size="lg" class="min-h-11">Mula Latihan</UButton>
          </template>
        </DsEmptyState>
      </UCard>

      <template v-else>
        <UCard data-testid="progress-trend">
          <DsChart
            type="line"
            title="Trend Ketepatan"
            :labels="data.chart.labels"
            :series="[{ label: 'Ketepatan (%)', data: data.chart.accuracy }]"
            unit="%"
          />
        </UCard>

        <UCard v-if="data.weakSubjects.length > 0" data-testid="progress-weak">
          <h2 class="mb-3 flex items-center gap-2 text-subheading text-error">
            <UIcon name="i-ph-warning-duotone" class="size-5" aria-hidden="true" />
            Topik Perlu Perhatian
          </h2>
          <ul class="flex flex-col gap-2">
            <li
              v-for="w in data.weakSubjects"
              :key="w.code"
              class="flex flex-wrap items-center gap-3 rounded-card bg-elevated p-3"
              data-testid="progress-weak-row"
            >
              <span
                class="grid size-10 shrink-0 place-items-center rounded-full bg-error/10 text-label font-bold text-error"
                aria-hidden="true"
                >{{ w.name.slice(0, 2).toUpperCase() }}</span
              >
              <div class="min-w-0 flex-1">
                <p class="truncate text-label font-semibold text-highlighted">{{ w.name }}</p>
                <p class="text-caption text-muted">{{ w.answered }} soalan</p>
              </div>
              <span class="tabular font-bold text-error">{{ w.accuracyPct }}%</span>
              <UButton :to="`/practice/${w.code}`" size="md" class="min-h-11" variant="soft"
                >Ulang Kaji</UButton
              >
            </li>
          </ul>
        </UCard>

        <section class="flex flex-col gap-3" data-testid="progress-subjects">
          <h2 class="text-subheading text-highlighted">Prestasi Mengikut Subjek</h2>
          <ul class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <li v-for="s in data.subjects" :key="s.code" class="min-w-0">
              <UCard class="h-full" data-testid="progress-subject">
                <div class="flex items-center gap-3">
                  <span
                    class="grid size-10 shrink-0 place-items-center rounded-chip bg-primary/10 text-label font-bold text-primary-t"
                    aria-hidden="true"
                    >{{ s.name.slice(0, 2).toUpperCase() }}</span
                  >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-label font-semibold text-highlighted">{{ s.name }}</p>
                    <p class="text-caption text-muted">{{ s.answered }} soalan dijawab</p>
                  </div>
                  <span class="tabular font-bold" :class="tone(s.accuracyPct)"
                    >{{ s.accuracyPct }}%</span
                  >
                </div>
                <UProgress class="mt-3" :model-value="s.accuracyPct" :max="100" />
                <div class="mt-3 flex items-center gap-2 text-caption text-muted">
                  <span>Trend:</span>
                  <svg
                    v-if="s.trend.length > 0"
                    viewBox="0 0 120 30"
                    class="h-[30px] w-[120px] text-primary-t"
                    aria-hidden="true"
                  >
                    <polyline :points="spark(s.trend)" fill="none" stroke="currentColor" stroke-width="2" />
                  </svg>
                  <span v-if="s.trend.length >= 2" aria-hidden="true">{{
                    trendUp(s.trend) ? '▲' : '▼'
                  }}</span>
                </div>
                <p class="mt-2 text-caption text-muted">{{ s.correct }} betul · {{ s.wrong }} salah</p>
              </UCard>
            </li>
          </ul>
        </section>
      </template>
    </template>

    <LoadError
      v-else-if="error"
      :message="LOAD_ERROR"
      retry-testid="progress-retry"
      @retry="reload"
    />
  </div>
</template>
