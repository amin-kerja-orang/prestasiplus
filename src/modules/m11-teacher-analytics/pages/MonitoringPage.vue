<script setup lang="ts">
/**
 * S2 Monitoring Penglibatan (FR-M11-26..52; URS EP-M11-3). The shared monitoring component: the route
 * prefix is a prop (`/guru/monitoring` here, `/admin/monitoring` in M17, `/admin-sekolah/monitoring`
 * for the school-admin alias), and every link inside is built from it.
 *
 * Filters live in the query (`period`, `state`, `tahap`); the filter form submits to the same prefix
 * with a dummy `_token` as live does (SEC-M11-01). Auto-refresh reloads the data every 300 s.
 *
 * Layout (Portal Pentadbiran admin pattern): header row (subtitle + actions), filter toolbar, KPI strip,
 * the sections in tabs, then the guide.
 */
import { useToast } from '@nuxt/ui/composables'
import { computed, nextTick, ref } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsFilterBar, DsFormField, DsLoadError, DsNativeSelect, DsPage } from '@/ds'
import { saveBlob } from '@/lib/save-blob'

import { fetchMonitoringExport, fetchMonitoringOverview } from '../api'
import MonitoringEngagementTable from '../components/monitoring/MonitoringEngagementTable.vue'
import MonitoringGuide from '../components/monitoring/MonitoringGuide.vue'
import MonitoringKpis from '../components/monitoring/MonitoringKpis.vue'
import MonitoringSignals from '../components/monitoring/MonitoringSignals.vue'
import MonitoringTools from '../components/monitoring/MonitoringTools.vue'
import MonitoringWeekly from '../components/monitoring/MonitoringWeekly.vue'
import { buildCsv } from '../components/monitoring/monitoring-csv'
import { EXPORT_ERROR, pct } from '../components/monitoring/monitoring-format'
import {
  MONITORING_BASE,
  monitoringPaths,
  type MonitoringFilterQuery,
} from '../components/monitoring/monitoring-paths'
import { useAutoRefresh } from '../components/monitoring/use-auto-refresh'
import {
  PERIODS,
  STATES,
  TAHAPS,
  useMonitoringFilters,
} from '../components/monitoring/use-monitoring-filters'

const props = withDefaults(defineProps<{ basePath?: string }>(), { basePath: MONITORING_BASE })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const paths = computed(() => monitoringPaths(props.basePath))

const one = (v: unknown) =>
  typeof v === 'string' ? v : Array.isArray(v) && typeof v[0] === 'string' ? v[0] : ''
const query = computed<MonitoringFilterQuery>(() => ({
  period: one(route.query.period),
  state: one(route.query.state),
  tahap: one(route.query.tahap),
}))

const { data, error, loading, reload } = useApi(
  (signal) => fetchMonitoringOverview(query.value, { signal }),
  () => route.fullPath,
)

const refresh = useAutoRefresh(() => {
  void reload()
})

/** The dummy `_token` of the live GET form (SEC-M11-01; not a real secret). */
const DUMMY_TOKEN = 'demo-csrf-token'

async function apply(next: MonitoringFilterQuery) {
  const failure = await router.push({
    path: paths.value.overview,
    query: { ...next, _token: DUMMY_TOKEN },
  })
  if (isNavigationFailure(failure, NavigationFailureType.duplicated)) void reload()
  refresh.restart()
}

async function doExport(format: 'pdf' | 'csv') {
  if (format === 'pdf') {
    window.print()
    return
  }
  let result: Awaited<ReturnType<typeof fetchMonitoringExport>>
  try {
    result = await fetchMonitoringExport('csv', query.value)
  } catch {
    // Any failure (401 / 403 / 429 / 5xx / offline): a fixed BM message, never the API text (DV-M11-32).
    toast.add({ title: EXPORT_ERROR, color: 'error' })
    return
  }
  const csv = buildCsv(
    ['#', 'Sekolah', 'Kod', 'Negeri', 'Daftar', 'Aktif', '%', 'Tahap'],
    result.rows.map((r, i) => [
      i + 1,
      r.name,
      r.code ?? '-',
      r.state,
      r.registered,
      r.engaged,
      pct(r.pct),
      r.tahap,
    ]),
  )
  saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), result.filename)
}
const FORM_ID = 'mon-filters-form'
const filters = useMonitoringFilters(query, (next) => void apply(next))
/** Reset is a link to the bare prefix on live (FR-M11-32). */
const resetFilters = () => void router.push(paths.value.overview)
const SUBTITLE = 'Pantau penglibatan sekolah & pelajar T4/T5 dalam platform'

const tab = ref('pelajar')
const TAB_OF: Record<string, string> = {
  'section-pelajar': 'pelajar',
  'section-guru': 'guru',
  'section-mingguan': 'mingguan',
  'section-perhatian': 'perhatian',
  'section-cadangan': 'cadangan',
}
const TABS = [
  { value: 'pelajar', label: 'Analisis Sekolah', icon: 'i-ph-chart-bar', slot: 'pelajar' as const },
  { value: 'guru', label: 'Analisis Guru', icon: 'i-ph-chalkboard-teacher', slot: 'guru' as const },
  {
    value: 'mingguan',
    label: 'Tracking Mingguan',
    icon: 'i-ph-calendar-dots',
    slot: 'mingguan' as const,
  },
  {
    value: 'perhatian',
    label: 'Sekolah Cemerlang / Perhatian Segera',
    icon: 'i-ph-warning',
    slot: 'perhatian' as const,
  },
  {
    value: 'cadangan',
    label: 'Cadangan Tindakan',
    icon: 'i-ph-lightbulb',
    slot: 'cadangan' as const,
  },
]

/** Guide tiles: open the tab that holds the section, then scroll to the tab strip (or the KPIs). */
async function goto(sectionId: string) {
  const next = TAB_OF[sectionId]
  if (next) tab.value = next
  await nextTick()
  document
    .getElementById(next ? 'mon-tabs' : sectionId)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <DsPage data-testid="monitoring-page" :subtitle="SUBTITLE">
    <template #actions>
      <MonitoringTools
        :query="query"
        :paths="paths"
        :form-id="FORM_ID"
        :refresh-display="refresh.display.value"
        :refresh-running="refresh.running.value"
        @export="doExport"
        @toggle="refresh.toggle"
      />
    </template>

    <!-- Live copy: "Tapis" and "Reset" (FR-M11-31, 32). -->
    <DsFilterBar
      :id="FORM_ID"
      :chips="filters.chips.value"
      :show-reset="false"
      apply-label="Tapis"
      reset-label="Reset"
      data-testid="mon-filters"
      @apply="filters.submit"
      @remove-chip="filters.removeChip"
      @reset="resetFilters"
    >
      <DsFormField v-slot="{ id }" native label="Tempoh" class="w-full md:w-48">
        <DsNativeSelect
          :id="id"
          v-model="filters.period.value"
          name="period"
          data-testid="mon-period"
        >
          <option v-for="[value, label] in PERIODS" :key="value" :value="value">{{ label }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Negeri" class="w-full md:w-56">
        <DsNativeSelect :id="id" v-model="filters.state.value" name="state" data-testid="mon-state">
          <option value="">Semua Negeri</option>
          <option v-for="s in STATES" :key="s" :value="s">{{ s }}</option>
        </DsNativeSelect>
      </DsFormField>
      <DsFormField v-slot="{ id }" native label="Tahap" class="w-full md:w-56">
        <DsNativeSelect :id="id" v-model="filters.tahap.value" name="tahap" data-testid="mon-tahap">
          <option value="">Semua Tahap</option>
          <option v-for="t in TAHAPS" :key="t" :value="t">{{ t }}</option>
        </DsNativeSelect>
      </DsFormField>
    </DsFilterBar>

    <DsLoadError v-if="error" testid="mon-error" @retry="reload" />
    <p
      v-else-if="!data && loading"
      class="flex items-center gap-2 text-body text-muted"
      data-testid="mon-loading"
    >
      <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
    </p>

    <template v-if="data">
      <MonitoringKpis :kpi="data.kpi" />
      <UTabs
        id="mon-tabs"
        v-model="tab"
        :items="TABS"
        :unmount-on-hide="false"
        variant="link"
        size="lg"
        class="w-full"
        :ui="{ content: 'pt-6' }"
        data-testid="mon-tabs"
      >
        <template #pelajar>
          <MonitoringEngagementTable kind="student" :rows="data.studentRows" :paths="paths" />
        </template>
        <template #guru>
          <MonitoringEngagementTable kind="teacher" :rows="data.teacherRows" :paths="paths" />
        </template>
        <template #mingguan>
          <MonitoringWeekly :weeks="data.weeks" :rows="data.weekly" :paths="paths" />
        </template>
        <template #perhatian>
          <MonitoringSignals :signals="data.signals" part="perhatian" />
        </template>
        <template #cadangan>
          <MonitoringSignals :signals="data.signals" part="cadangan" />
        </template>
      </UTabs>
      <MonitoringGuide @goto="goto" />
    </template>
  </DsPage>
</template>
