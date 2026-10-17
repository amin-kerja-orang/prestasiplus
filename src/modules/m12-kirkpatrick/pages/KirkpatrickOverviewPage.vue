<script setup lang="ts">
/**
 * S1 Overview (FR-M12-18..31; URS EP-M12-2). One component for `/admin/kirkpatrick`, the `/guru/kirkpatrick`
 * twin and the `/admin-sekolah/kirkpatrick` alias: the route prefix is a prop and every link is built from it.
 * `detailLinks` (INFERRED / provisional, like the alias itself) is off on the alias (S1 only: the level pages answer 403 for a school administrator, so their
 * links would be dead).
 *
 * The filter lives in the query (`school_id`, `state`); "Tapis" navigates to the same prefix with both.
 */
import { computed } from 'vue'
import { isNavigationFailure, NavigationFailureType, useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsPage } from '@/ds'

import { fetchKirkpatrickFilterOptions, fetchKirkpatrickOverview } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickFilterBar,
  KirkpatrickLoadState,
  kirkpatrickPaths,
  queryString,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import OverviewBands from '../components/kirkpatrick/overview/OverviewBands.vue'
import OverviewComparison from '../components/kirkpatrick/overview/OverviewComparison.vue'
import OverviewFlow from '../components/kirkpatrick/overview/OverviewFlow.vue'
import OverviewInfo from '../components/kirkpatrick/overview/OverviewInfo.vue'
import OverviewKpis from '../components/kirkpatrick/overview/OverviewKpis.vue'
import OverviewLevelCards from '../components/kirkpatrick/overview/OverviewLevelCards.vue'

const props = withDefaults(defineProps<{ basePath?: string; detailLinks?: boolean }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
  detailLinks: true,
})

const route = useRoute()
const router = useRouter()
const paths = computed(() => kirkpatrickPaths(props.basePath))

const schoolId = computed(() => queryString(route.query.school_id))
const state = computed(() => queryString(route.query.state))

const { data, error, loading, reload } = useKirkpatrickPage(
  (signal) =>
    fetchKirkpatrickOverview(
      {
        schoolId: /^\d+$/.test(schoolId.value) ? Number(schoolId.value) : null,
        state: state.value,
      },
      { signal },
    ),
  () => route.fullPath,
)
const { data: options } = useApi((signal) => fetchKirkpatrickFilterOptions({ signal }))

async function apply(value: { schoolId: string; state: string }) {
  const failure = await router.push({
    path: props.basePath,
    query: { school_id: value.schoolId, state: value.state },
  })
  if (isNavigationFailure(failure, NavigationFailureType.duplicated)) void reload()
}
</script>

<template>
  <DsPage data-testid="kirk-overview-page">
    <KirkpatrickFilterBar
      :options="options"
      :school-id="schoolId"
      :state="state"
      :reset-to="paths.overview"
      @apply="apply"
    />

    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />

    <template v-if="data">
      <OverviewLevelCards :data="data" :paths="paths" :detail="detailLinks" />
      <OverviewFlow :data="data" :paths="paths" :detail="detailLinks" />
      <OverviewComparison :comparison="data.comparison" />
      <OverviewKpis :kpi="data.kpi" :paths="paths" :detail="detailLinks" />
      <OverviewBands :bands="data.bands" :behavior-path="detailLinks ? paths.behavior : null" />
      <OverviewInfo />
    </template>
  </DsPage>
</template>
