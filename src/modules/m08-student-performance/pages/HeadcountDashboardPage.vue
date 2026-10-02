<script setup lang="ts">
/**
 * S13 `/headcount/dashboard` "Dashboard Headcount" (M08-T6; FR-M08-82…86, BR-M08-22). Level filter,
 * 4 stat cards and the "Keseluruhan On-Track" bar over the filtered configs, then one small chart per
 * config (placement SOURCE-DERIVED, PROPOSED; DV-11: "Jumlah Murid" follows the filter, live shows the
 * unfiltered server value).
 */
import { Funnel, Gauge, List } from '@lucide/vue'
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { ChartCanvas } from '@/components/chart'

import { fetchHeadcountDashboard } from '../api/headcount'
import HeadcountHero from '../components/headcount/HeadcountHero.vue'
import LoadError from '../components/headcount/LoadError.vue'
import { dashboardChartData, dashboardChartOptions } from '../lib/headcount/charts'
import { dashboardLevels, dashboardStats, onTrackTone } from '../lib/headcount/format'
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

const FILTER = 'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold transition'
const ACTIVE = 'bg-blue-600 text-white'
const INACTIVE = 'bg-slate-100 text-slate-600 hover:bg-slate-200'
</script>

<template>
  <div class="min-w-0 space-y-5" data-testid="headcount-dashboard-page">
    <HeadcountHero
      title="Dashboard Headcount"
      subtitle="Ringkasan prestasi semua kelas anda"
      :icon="Gauge"
    >
      <RouterLink
        to="/headcount"
        class="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white/20 px-4 text-xs font-semibold text-white transition hover:bg-white/30 sm:text-sm"
        data-testid="hero-list"
      >
        <List class="h-4 w-4" />Senarai Penuh
      </RouterLink>
    </HeadcountHero>

    <LoadError v-if="isLoadError(error)" @retry="reload()" />

    <template v-else-if="data">
      <div class="flex flex-wrap items-center gap-2" data-testid="level-filter">
        <span class="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600"
          ><Funnel class="h-4 w-4" />Tapis:</span
        >
        <button
          type="button"
          :class="[FILTER, filterLevel === null ? ACTIVE : INACTIVE]"
          data-testid="filter-all"
          @click="filterLevel = null"
        >
          Semua ({{ configs.length }})
        </button>
        <button
          v-for="l in levels"
          :key="l.level"
          type="button"
          :class="[FILTER, filterLevel === l.level ? ACTIVE : INACTIVE]"
          :data-testid="`filter-level-${l.level}`"
          @click="filterLevel = l.level"
        >
          {{ l.name }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="dashboard-stats">
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="text-xs font-semibold text-slate-500 sm:text-sm">Konfigurasi</p>
          <p class="font-heading text-2xl font-bold text-blue-600" data-testid="stat-configs">
            {{ stats.configs }}
          </p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="text-xs font-semibold text-slate-500 sm:text-sm">Jumlah Murid</p>
          <p class="font-heading text-2xl font-bold text-slate-700" data-testid="stat-students">
            {{ stats.students }}
          </p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="text-xs font-semibold text-slate-500 sm:text-sm">On Track</p>
          <p class="font-heading text-2xl font-bold text-emerald-600" data-testid="stat-on">
            {{ stats.onTrack }}
          </p>
        </div>
        <div class="rounded-2xl bg-white p-4 shadow">
          <p class="text-xs font-semibold text-slate-500 sm:text-sm">Off Track</p>
          <p class="font-heading text-2xl font-bold text-red-500" data-testid="stat-off">
            {{ stats.offTrack }}
          </p>
        </div>
      </div>

      <section
        v-if="stats.tracked > 0"
        class="rounded-2xl bg-white p-5 shadow"
        data-testid="overall-card"
      >
        <div class="flex items-baseline justify-between gap-3">
          <h3 class="text-sm font-bold text-slate-700">Keseluruhan On-Track</h3>
          <span
            :class="['font-heading text-2xl font-bold', onTrackTone(stats.onPct)]"
            data-testid="overall-pct"
            >{{ stats.onPct }}%</span
          >
        </div>
        <div class="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100">
          <div class="bg-emerald-500" :style="{ width: `${stats.onPct}%` }" data-testid="bar-on" />
          <div class="bg-red-500" :style="{ width: `${stats.offPct}%` }" data-testid="bar-off" />
        </div>
        <div
          class="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-600"
          data-testid="legend"
        >
          <span>On Track: {{ stats.onTrack }}</span>
          <span>Off Track: {{ stats.offTrack }}</span>
          <span>Tiada Data: {{ stats.noData }}</span>
        </div>
      </section>

      <section
        v-if="configs.length === 0"
        class="rounded-2xl bg-white p-8 text-center shadow"
        data-testid="dashboard-empty"
      >
        <p class="text-lg font-bold text-slate-700">Belum ada headcount.</p>
      </section>

      <div v-else class="grid grid-cols-1 gap-4 md:grid-cols-2" data-testid="dashboard-charts">
        <section
          v-for="c in filtered"
          :key="c.id"
          class="min-w-0 rounded-2xl bg-white p-4 shadow"
          :data-testid="`chart-card-${c.id}`"
        >
          <h3 class="mb-2 text-sm font-bold break-words text-slate-700">
            {{ c.className }} · {{ c.subjectName }} · {{ c.year }}
          </h3>
          <ChartCanvas
            type="line"
            :data="dashboardChartData(c.chart)"
            :options="dashboardChartOptions"
            height="180px"
            :test-id="`headcount-chart-${c.id}`"
          />
        </section>
      </div>
    </template>
  </div>
</template>
