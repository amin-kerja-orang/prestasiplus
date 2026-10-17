<script setup lang="ts">
/**
 * S2 filter bar, export links and auto-refresh (FN-M11-3.2.1..3.2.5; FR-M11-30..34).
 *
 * A GET form on live: submitting navigates to the mount prefix with `period`, `state`, `tahap` and a
 * dummy `_token` (SEC-M11-01, replicated). "Refresh" is a second submit button of the same form.
 * Reset shows only when a filter is set. The page applies the query; this component owns the select
 * values and the control rows.
 */
import { ref, watch } from 'vue'

import NativeSelect from '../native/NativeSelect.vue'
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

const LABEL = 'text-caption text-muted'
</script>

<template>
  <UCard>
    <form class="flex flex-col gap-4" data-testid="mon-filters" @submit.prevent="submit">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex min-w-0 flex-col gap-1 max-sm:w-full">
          <span :class="LABEL">Tempoh</span>
          <NativeSelect v-model="period" name="period" data-testid="mon-period">
            <option v-for="[value, label] in PERIODS" :key="value" :value="value">
              {{ label }}
            </option>
          </NativeSelect>
        </label>
        <label class="flex min-w-0 flex-col gap-1 max-sm:w-full">
          <span :class="LABEL">Negeri</span>
          <NativeSelect v-model="state" name="state" data-testid="mon-state">
            <option value="">Semua Negeri</option>
            <option v-for="s in STATES" :key="s" :value="s">{{ s }}</option>
          </NativeSelect>
        </label>
        <label class="flex min-w-0 flex-col gap-1 max-sm:w-full">
          <span :class="LABEL">Tahap</span>
          <NativeSelect v-model="tahap" name="tahap" data-testid="mon-tahap">
            <option value="">Semua Tahap</option>
            <option v-for="t in TAHAPS" :key="t" :value="t">{{ t }}</option>
          </NativeSelect>
        </label>
        <UButton type="submit" size="lg" icon="i-ph-funnel" label="Tapis" data-testid="mon-apply" />
        <UButton
          v-if="hasFilter()"
          :to="paths.overview"
          color="neutral"
          variant="ghost"
          size="lg"
          icon="i-ph-x"
          label="Reset"
          data-testid="mon-reset"
        />
        <div class="flex flex-wrap items-center gap-2 sm:ml-auto" data-testid="mon-tools">
          <UButton
            :href="paths.exportHref('pdf', query)"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-file-pdf"
            label="PDF"
            data-testid="mon-export-pdf"
            @click.prevent="emit('export', 'pdf')"
          />
          <UButton
            :href="paths.exportHref('csv', query)"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-file-csv"
            label="CSV"
            data-testid="mon-export-csv"
            @click.prevent="emit('export', 'csv')"
          />
          <UButton
            type="submit"
            name="refresh"
            color="neutral"
            variant="ghost"
            size="lg"
            icon="i-ph-arrows-clockwise"
            label="Refresh"
            data-testid="mon-refresh"
          />
        </div>
      </div>

      <p
        class="flex items-center justify-end gap-2 text-caption text-muted"
        data-testid="mon-auto-refresh"
      >
        <UIcon name="i-ph-clock" class="size-4" />
        <span
          >Auto-refresh dalam
          <span class="tabular" data-testid="mon-countdown">{{ refreshDisplay }}</span></span
        >
        <UButton
          type="button"
          color="neutral"
          variant="ghost"
          size="lg"
          :icon="refreshRunning ? 'i-ph-pause' : 'i-ph-play'"
          :aria-label="refreshRunning ? 'Jeda auto-refresh' : 'Sambung auto-refresh'"
          :data-icon="refreshRunning ? 'pause' : 'play'"
          data-testid="mon-refresh-toggle"
          @click="emit('toggle')"
        />
      </p>
    </form>
  </UCard>
</template>
