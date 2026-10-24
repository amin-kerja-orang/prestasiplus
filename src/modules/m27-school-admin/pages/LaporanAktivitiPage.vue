<script setup lang="ts">
/**
 * S3 `/admin-sekolah/laporan-aktiviti` "Laporan Aktiviti" (SRS M27 Part B FR-M27-44, 66…73; roles-matrix row
 * L53). User shell, one read-only call (`GET /api/admin-sekolah/laporan-aktiviti?range=`, school from the
 * session). Top to bottom: breadcrumb, range pills, tabs, the active tab. The tabs switch client-side; a range
 * pill reloads the data and returns to Overview (M17 FN-M17-8.1.2). The header sub-line is the school name from
 * the session (the report carries only the school id).
 *
 * States: loading shows the spinner only; a 403 renders the global 403 page in place; any other failure shows
 * the server's own message (no M27 copy, FR-M27-48).
 */
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'

import { isApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'
import { useApi } from '@/composables'
import { usePageMeta } from '@/composables/usePageMeta'
import { DsBreadcrumb, DsLoadError, DsPage } from '@/ds'
import { useSession } from '@/composables/useSession'

import { fetchSchoolActivityReport } from '../api/school-admin'
import ActivityOverview from '../components/activity/ActivityOverview.vue'
import ActivityPupilsTab from '../components/activity/ActivityPupilsTab.vue'
import ActivityRangePills from '../components/activity/ActivityRangePills.vue'
import ActivityTabs, { type ActivityTab } from '../components/activity/ActivityTabs.vue'
import ActivityTeachersTab from '../components/activity/ActivityTeachersTab.vue'
import { DASHBOARD_PATH, normaliseRange } from '../components/activity/activity-format'

const TITLE = 'Laporan Aktiviti'

const crumbs = [{ label: 'Papan Pemuka Sekolah', to: DASHBOARD_PATH }, { label: TITLE }]

const route = useRoute()
const pageMeta = usePageMeta()
const { user } = useSession()
const range = computed(() => normaliseRange(route.query.range))
const tab = ref<ActivityTab>('overview')

const { data, error, loading, reload } = useApi(
  (signal) => fetchSchoolActivityReport({ range: range.value, signal }),
  [range],
)

// a range pill is a reload in M17: the tab resets to Overview
watch(range, () => {
  tab.value = 'overview'
})

const refused = computed(() => isApiError(error.value) && error.value.status === 403)
watch(
  refused,
  (is403) => {
    if (is403) setRouteOutcome(403)
  },
  { immediate: true },
)

// FR-M27-44: header title, sub-line = the school name.
watch(
  () => user.value?.school?.name,
  (name) => {
    pageMeta.setHeader(name ? { title: TITLE, subtitle: name } : { title: TITLE })
  },
  { immediate: true },
)
</script>

<template>
  <DsPage data-testid="la-page" :data-range="data?.range">
    <template #breadcrumb>
      <DsBreadcrumb v-if="data" :items="crumbs" data-testid="la-breadcrumb" />
    </template>
    <template v-if="data">
      <ActivityRangePills :active="range" />
      <ActivityTabs
        :active="tab"
        :teachers="data.tiles.teachers.total"
        :pupils="data.tiles.pupils.total"
        @select="tab = $event"
      />
      <ActivityOverview v-if="tab === 'overview'" :report="data" />
      <ActivityTeachersTab v-else-if="tab === 'guru'" :report="data" />
      <ActivityPupilsTab v-else :report="data" />
    </template>
    <DsLoadError
      v-else-if="error && !refused"
      :message="error.message"
      testid="la-error"
      @retry="reload"
    />
    <div v-else-if="loading" class="flex flex-col gap-4" aria-busy="true" data-testid="la-loading">
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-64 w-full" />
    </div>
  </DsPage>
</template>
