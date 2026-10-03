<script setup lang="ts">
/**
 * S4 T3 Tingkah Laku (FR-M12-40 ... FR-M12-47; URS EP-M12-5). Mounted on `/admin/kirkpatrick/behavior` and
 * the `/guru` twin; `basePath` is the mount prefix. `school_id` is the only filter (FN-M12-5.1.1).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'

import { fetchKirkpatrickBehavior, fetchKirkpatrickFilterOptions } from '../api'
import BehaviorAlerts from '../components/kirkpatrick/behavior/BehaviorAlerts.vue'
import BehaviorBands from '../components/kirkpatrick/behavior/BehaviorBands.vue'
import BehaviorHeatmap from '../components/kirkpatrick/behavior/BehaviorHeatmap.vue'
import BehaviorKpis from '../components/kirkpatrick/behavior/BehaviorKpis.vue'
import BehaviorMood from '../components/kirkpatrick/behavior/BehaviorMood.vue'
import BehaviorSchoolTable from '../components/kirkpatrick/behavior/BehaviorSchoolTable.vue'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickFilterBar,
  KirkpatrickLoadState,
  KirkpatrickTabs,
  kirkpatrickPaths,
  queryString,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'

const props = withDefaults(defineProps<{ basePath?: string }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
})

const route = useRoute()
const router = useRouter()
const paths = computed(() => kirkpatrickPaths(props.basePath))

const schoolQuery = computed(() => queryString(route.query.school_id).trim())
const schoolId = computed(() =>
  /^\d+$/.test(schoolQuery.value) ? Number(schoolQuery.value) : null,
)

const { data, error, loading } = useKirkpatrickPage(
  (signal) => fetchKirkpatrickBehavior({ schoolId: schoolId.value }, { signal }),
  () => route.fullPath,
)
const { data: options } = useApi((signal) => fetchKirkpatrickFilterOptions({ signal }))

function apply(value: { schoolId: string }) {
  void router.push({
    path: paths.value.behavior,
    query: value.schoolId === '' ? {} : { school_id: value.schoolId },
  })
}
</script>

<template>
  <div class="min-w-0 space-y-4" data-testid="kirk-behavior">
    <KirkpatrickTabs :base-path="basePath" current="behavior" class="!mb-0" />
    <KirkpatrickFilterBar
      :options="options"
      :school-id="schoolQuery"
      :with-state="false"
      :reset-to="paths.behavior"
      @apply="apply"
    />
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <BehaviorKpis :kpi="data.kpi" />
      <BehaviorBands :bands="data.bands" :monitoring-path="paths.monitoring" />
      <BehaviorSchoolTable :rows="data.schools" :school-path="paths.monitoringSchool" />
      <BehaviorHeatmap :heat="data.heat" />
      <BehaviorAlerts :alerts="data.alerts" />
      <BehaviorMood :mood-count="data.moodCount" />
    </template>
  </div>
</template>
