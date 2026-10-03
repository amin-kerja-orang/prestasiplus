<script setup lang="ts">
/**
 * S2 filter bar, export links and auto-refresh (FN-M11-3.2.1..3.2.5; FR-M11-30..34).
 *
 * A GET form on live: submitting navigates to the mount prefix with `period`, `state`, `tahap` and a
 * dummy `_token` (SEC-M11-01, replicated). "Refresh" is a second submit button of the same form.
 * Reset shows only when a filter is set. The page applies the query; this component owns the select
 * values and the control rows (selects are 44 px tall: DV-M11-17 asks 36, the touch rule is 44).
 */
import { Clock, FileSpreadsheet, FileText, Funnel, Pause, Play, RefreshCw, X } from '@lucide/vue'
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { CARD } from './monitoring-format'
import type { MonitoringFilterQuery, MonitoringPaths } from './monitoring-paths'

const props = defineProps<{
  query: MonitoringFilterQuery
  paths: MonitoringPaths
  refreshDisplay: string
  refreshRunning: boolean
}>()

const emit = defineEmits<{
  apply: [query: MonitoringFilterQuery]
  export: [format: 'pdf' | 'csv']
  toggle: []
}>()

const PERIODS = [
  ['', 'Semua Masa'],
  ['7d', '7 Hari'],
  ['30d', '30 Hari'],
  ['3m', '3 Bulan'],
] as const
const STATES = [
  'Johor',
  'Kedah',
  'Kelantan',
  'Kuala Lumpur',
  'Melaka',
  'Pahang',
  'Perak',
  'Sabah',
  'Selangor',
  'Terengganu',
]
const TAHAPS = ['Cemerlang', 'Sederhana', 'Rendah', 'Kritikal', 'Tiada Langsung']

const period = ref(props.query.period)
const state = ref(props.query.state)
const tahap = ref(props.query.tahap)
watch(
  () => props.query,
  (q) => {
    period.value = q.period
    state.value = q.state
    tahap.value = q.tahap
  },
)

const hasFilter = () =>
  props.query.period !== '' || props.query.state !== '' || props.query.tahap !== ''

function submit() {
  emit('apply', { period: period.value, state: state.value, tahap: tahap.value })
}

const SELECT =
  'min-h-11 lg:min-h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 sm:w-auto'
const LABEL = 'text-xs font-semibold text-slate-500'
</script>

<template>
  <form
    :class="[CARD, 'flex flex-wrap items-end gap-3 p-3 sm:p-4']"
    data-testid="mon-filters"
    @submit.prevent="submit"
  >
    <label class="flex min-w-0 basis-[calc(50%-0.375rem)] flex-col gap-1 sm:basis-auto">
      <span :class="LABEL">Tempoh</span>
      <select v-model="period" name="period" :class="SELECT" data-testid="mon-period">
        <option v-for="[value, label] in PERIODS" :key="value" :value="value">{{ label }}</option>
      </select>
    </label>
    <label class="flex min-w-0 basis-[calc(50%-0.375rem)] flex-col gap-1 sm:basis-auto">
      <span :class="LABEL">Negeri</span>
      <select v-model="state" name="state" :class="SELECT" data-testid="mon-state">
        <option value="">Semua Negeri</option>
        <option v-for="s in STATES" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>
    <label class="flex min-w-0 basis-[calc(50%-0.375rem)] flex-col gap-1 sm:basis-auto">
      <span :class="LABEL">Tahap</span>
      <select v-model="tahap" name="tahap" :class="SELECT" data-testid="mon-tahap">
        <option value="">Semua Tahap</option>
        <option v-for="t in TAHAPS" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <button
      type="submit"
      class="flex min-h-11 basis-[calc(50%-0.375rem)] items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 sm:basis-auto lg:min-h-9"
      data-testid="mon-apply"
    >
      <Funnel class="h-4 w-4" />Tapis
    </button>
    <RouterLink
      v-if="hasFilter()"
      :to="paths.overview"
      class="flex min-h-11 items-center gap-1 px-2 text-sm text-slate-500 hover:text-slate-700 lg:min-h-9"
      data-testid="mon-reset"
    >
      <X class="h-4 w-4" />Reset
    </RouterLink>

    <div class="ml-auto flex flex-wrap items-center gap-2" data-testid="mon-tools">
      <a
        :href="paths.exportHref('pdf', query)"
        class="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-red-600 hover:bg-red-50 lg:min-h-9"
        data-testid="mon-export-pdf"
        @click.prevent="emit('export', 'pdf')"
      >
        <FileText class="h-4 w-4" />PDF
      </a>
      <a
        :href="paths.exportHref('csv', query)"
        class="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-green-600 hover:bg-green-50 lg:min-h-9"
        data-testid="mon-export-csv"
        @click.prevent="emit('export', 'csv')"
      >
        <FileSpreadsheet class="h-4 w-4" />CSV
      </a>
      <button
        type="submit"
        name="refresh"
        class="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm text-slate-500 hover:bg-slate-50 lg:min-h-9"
        data-testid="mon-refresh"
      >
        <RefreshCw class="h-4 w-4" />Refresh
      </button>
    </div>

    <p
      class="flex w-full items-center justify-end gap-2 text-sm text-slate-400"
      data-testid="mon-auto-refresh"
    >
      <Clock class="h-4 w-4" />
      <span
        >Auto-refresh dalam <span data-testid="mon-countdown">{{ refreshDisplay }}</span></span
      >
      <button
        type="button"
        class="flex min-h-11 min-w-11 items-center justify-center text-slate-400 hover:text-slate-600 lg:min-h-9 lg:min-w-9"
        data-testid="mon-refresh-toggle"
        @click="emit('toggle')"
      >
        <Pause v-if="refreshRunning" class="h-4 w-4" data-testid="mon-icon-pause" />
        <Play v-else class="h-4 w-4" data-testid="mon-icon-play" />
      </button>
    </p>
  </form>
</template>
