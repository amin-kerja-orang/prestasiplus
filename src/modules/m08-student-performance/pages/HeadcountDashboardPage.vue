<script setup lang="ts">
/**
 * S13 `/headcount/dashboard` "Dashboard Headcount" (M08-T6; FR-M08-82…86, BR-M08-22). Level filter,
 * 4 stat tiles and the "Keseluruhan On-Track" bar over the filtered configs, then one small chart per
 * config (placement SOURCE-DERIVED, PROPOSED; DV-11: "Jumlah Murid" follows the filter, live shows the
 * unfiltered server value).
 */
import { computed, ref } from 'vue'

import { DsChart, DsEmptyState, DsPage } from '@/ds'

import { fetchHeadcountDashboard } from '../api/headcount'
import PageHeader from '../components/shared/PageHeader.vue'
import PageLoadError from '../components/shared/PageLoadError.vue'
import PageSkeleton from '../components/shared/PageSkeleton.vue'
import StatGrid, { type StatItem } from '../components/shared/StatGrid.vue'
import { dashboardLevels, dashboardStats } from '../lib/headcount/format'
import { isLoadError, useRouteData } from '../lib/prestasi/load'

const { data, error, reload } = useRouteData((signal) => fetchHeadcountDashboard({ signal }))

/** null = "Semua", else the level id. */
const filterLevel = ref<number | null>(null)
const configs = computed(() => data.value?.configs ?? [])
const levels = computed(() => dashboardLevels(configs.value))
const filtered = computed(() =>
  filterLevel.value === null
    ? configs.value
    : configs.value.filter((c) => c.level === filterLevel.value),
)
const stats = computed(() => dashboardStats(filtered.value))

const tiles = computed<StatItem[]>(() => [
  { id: 'configs', label: 'Konfigurasi', value: stats.value.configs, icon: 'list-numbers' },
  { id: 'students', label: 'Jumlah Murid', value: stats.value.students, icon: 'users' },
  { id: 'on', label: 'On Track', value: stats.value.onTrack, icon: 'check-circle' },
  { id: 'off', label: 'Off Track', value: stats.value.offTrack, icon: 'warning', accent: 'heat' },
])

/** A gap (no AR yet) is a `null` point; the chart draws it as a break. */
const gaps = (v: (number | null)[]): number[] => v as number[]
</script>

<template>
  <DsPage data-testid="headcount-dashboard-page">
    <PageHeader title="Dashboard Headcount" subtitle="Ringkasan prestasi semua kelas anda">
      <template #actions>
        <UButton
          to="/headcount"
          color="neutral"
          variant="soft"
          icon="i-ph-list"
          label="Senarai Penuh"
          data-testid="hero-list"
        />
      </template>
    </PageHeader>

    <PageLoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <div class="flex flex-wrap items-center gap-2" role="group" aria-label="Tapis" data-testid="level-filter">
        <span class="inline-flex items-center gap-1 text-label text-muted"
          ><UIcon name="i-ph-funnel" class="size-5" />Tapis:</span
        >
        <UButton
          type="button"
          size="lg"
          :color="filterLevel === null ? 'primary' : 'neutral'"
          :variant="filterLevel === null ? 'solid' : 'soft'"
          :aria-pressed="filterLevel === null"
          :label="`Semua (${String(configs.length)})`"
          data-testid="filter-all"
          @click="filterLevel = null"
        />
        <UButton
          v-for="l in levels"
          :key="l.level"
          type="button"
          size="lg"
          :color="filterLevel === l.level ? 'primary' : 'neutral'"
          :variant="filterLevel === l.level ? 'solid' : 'soft'"
          :aria-pressed="filterLevel === l.level"
          :label="l.name"
          :data-testid="`filter-level-${String(l.level)}`"
          @click="filterLevel = l.level"
        />
      </div>

      <StatGrid :items="tiles" prefix="stat" />

      <UCard v-if="stats.tracked > 0" data-testid="overall-card">
        <div class="flex flex-col gap-3">
          <div class="flex items-baseline justify-between gap-3">
            <h2 class="text-subheading text-highlighted">Keseluruhan On-Track</h2>
            <span class="tabular text-heading text-highlighted" data-testid="overall-pct"
              >{{ stats.onPct }}%</span
            >
          </div>
          <UProgress
            :model-value="stats.onPct"
            :max="100"
            color="success"
            aria-label="Keseluruhan On-Track"
            data-testid="bar-on"
          />
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted" data-testid="legend">
            <span>On Track: {{ stats.onTrack }}</span>
            <span>Off Track: {{ stats.offTrack }}</span>
            <span>Tiada Data: {{ stats.noData }}</span>
          </div>
        </div>
      </UCard>

      <div v-if="configs.length === 0" data-testid="dashboard-empty">
        <DsEmptyState title="Belum ada headcount." icon="i-ph-clipboard-text" />
      </div>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="dashboard-charts">
        <UCard
          v-for="c in filtered"
          :key="c.id"
          class="min-w-0"
          :data-testid="`chart-card-${String(c.id)}`"
        >
          <DsChart
            type="line"
            :title="`${c.className} · ${c.subjectName} · ${String(c.year)}`"
            :labels="c.chart.labels"
            :series="[
              { label: 'Sasaran', data: gaps(c.chart.target), slot: 1 },
              { label: 'Sebenar (AR)', data: gaps(c.chart.actual), slot: 2 },
            ]"
            unit="%"
            :data-testid="`headcount-chart-${String(c.id)}`"
          />
        </UCard>
      </div>
    </template>
    <PageSkeleton v-else-if="!error" />
  </DsPage>
</template>
