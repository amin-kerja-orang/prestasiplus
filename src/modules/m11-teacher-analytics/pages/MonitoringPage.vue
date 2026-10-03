<script setup lang="ts">
/**
 * S2 Monitoring Penglibatan (FR-M11-26..52; URS EP-M11-3). The shared monitoring component: the route
 * prefix is a prop (`/guru/monitoring` here, `/admin/monitoring` in M17, `/admin-sekolah/monitoring`
 * for the school-admin alias), and every link inside is built from it.
 *
 * Filters live in the query (`period`, `state`, `tahap`); the filter form submits to the same prefix
 * with a dummy `_token` as live does (SEC-M11-01). Auto-refresh reloads the data every 300 s.
 */
import { computed } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'

import { LoadingSpinner } from '@/components/feedback'
import { useApi } from '@/composables'
import { saveBlob } from '@/lib/save-blob'

import { fetchMonitoringExport, fetchMonitoringOverview } from '../api'
import MonitoringEngagementTable from '../components/monitoring/MonitoringEngagementTable.vue'
import MonitoringFilters from '../components/monitoring/MonitoringFilters.vue'
import MonitoringGuide from '../components/monitoring/MonitoringGuide.vue'
import MonitoringKpis from '../components/monitoring/MonitoringKpis.vue'
import MonitoringSignals from '../components/monitoring/MonitoringSignals.vue'
import MonitoringWeekly from '../components/monitoring/MonitoringWeekly.vue'
import { buildCsv } from '../components/monitoring/monitoring-csv'
import { LOAD_ERROR_COPY, pct } from '../components/monitoring/monitoring-format'
import {
  MONITORING_BASE,
  monitoringPaths,
  type MonitoringFilterQuery,
} from '../components/monitoring/monitoring-paths'
import { useAutoRefresh } from '../components/monitoring/use-auto-refresh'

const props = withDefaults(defineProps<{ basePath?: string }>(), { basePath: MONITORING_BASE })

const route = useRoute()
const router = useRouter()
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
  const result = await fetchMonitoringExport('csv', query.value)
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
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="monitoring-page">
    <MonitoringGuide />

    <MonitoringFilters
      :query="query"
      :paths="paths"
      :refresh-display="refresh.display.value"
      :refresh-running="refresh.running.value"
      @apply="apply"
      @export="doExport"
      @toggle="refresh.toggle"
    />

    <p v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="mon-error">
      {{ LOAD_ERROR_COPY }}
    </p>
    <p
      v-else-if="!data && loading"
      class="flex items-center gap-2 text-sm text-slate-500"
      data-testid="mon-loading"
    >
      <LoadingSpinner class="h-4 w-4" />Memuatkan...
    </p>

    <template v-if="data">
      <MonitoringKpis :kpi="data.kpi" />
      <MonitoringEngagementTable kind="student" :rows="data.studentRows" :paths="paths" />
      <MonitoringEngagementTable kind="teacher" :rows="data.teacherRows" :paths="paths" />
      <MonitoringWeekly :weeks="data.weeks" :rows="data.weekly" :paths="paths" />
      <MonitoringSignals :signals="data.signals" />
    </template>
  </div>
</template>
