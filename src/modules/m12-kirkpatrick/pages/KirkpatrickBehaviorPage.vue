<script setup lang="ts">
/**
 * S4 T3 Tingkah Laku (FR-M12-40 ... FR-M12-47; URS EP-M12-5). Mounted on `/admin/kirkpatrick/behavior` and
 * the `/guru` twin; `basePath` is the mount prefix. `school_id` is the only filter (FN-M12-5.1.1).
 */
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useApi } from '@/composables'
import { DsFilterBar, DsFormField, DsLoadError, DsNativeSelect, DsPage } from '@/ds'

import { fetchKirkpatrickBehavior, fetchKirkpatrickFilterOptions } from '../api'
import BehaviorAlerts from '../components/kirkpatrick/behavior/BehaviorAlerts.vue'
import BehaviorBands from '../components/kirkpatrick/behavior/BehaviorBands.vue'
import BehaviorHeatmap from '../components/kirkpatrick/behavior/BehaviorHeatmap.vue'
import BehaviorKpis from '../components/kirkpatrick/behavior/BehaviorKpis.vue'
import BehaviorMood from '../components/kirkpatrick/behavior/BehaviorMood.vue'
import BehaviorSchoolTable from '../components/kirkpatrick/behavior/BehaviorSchoolTable.vue'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickTabs,
  kirkpatrickPaths,
  queryString,
  useKirkpatrickFilters,
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

const { data, error, loading, reload } = useKirkpatrickPage(
  (signal) => fetchKirkpatrickBehavior({ schoolId: schoolId.value }, { signal }),
  () => route.fullPath,
)
const { data: options } = useApi((signal) => fetchKirkpatrickFilterOptions({ signal }))

const filters = useKirkpatrickFilters(options, { schoolId: schoolQuery }, (value) => apply(value))

function apply(value: { schoolId: string }) {
  void router.push({
    path: paths.value.behavior,
    query: value.schoolId === '' ? {} : { school_id: value.schoolId },
  })
}
</script>

<template>
  <DsPage
    data-testid="kirk-behavior"
    subtitle="Konsistensi penggunaan, skor penglibatan, dan corak tingkah laku pelajar"
  >
    <KirkpatrickTabs :base-path="basePath" current="behavior" />
    <!-- Live copy: "Tapis" and "Set Semula" (FR-M12-19, 41). -->
    <DsFilterBar
      :chips="filters.chips.value"
      :show-reset="false"
      apply-label="Tapis"
      reset-label="Set Semula"
      data-testid="kirk-filter"
      @apply="filters.apply"
      @remove-chip="filters.removeChip"
      @reset="router.push(paths.behavior)"
    >
      <DsFormField v-slot="{ id }" native label="Sekolah" class="w-full md:w-64">
        <DsNativeSelect
          :id="id"
          v-model="filters.school.value"
          name="school_id"
          data-testid="kirk-filter-school"
        >
          <option value="">Semua Sekolah</option>
          <option v-for="s in options?.schools ?? []" :key="s.id" :value="String(s.id)">
            {{ s.name }}
          </option>
        </DsNativeSelect>
      </DsFormField>
    </DsFilterBar>
    <DsLoadError v-if="error" testid="kirk-error" @retry="reload" />
    <p
      v-else-if="data === null && loading"
      class="flex items-center gap-2 text-label text-muted"
      data-testid="kirk-loading"
      role="status"
    >
      <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
    </p>
    <template v-if="data">
      <BehaviorKpis :kpi="data.kpi" />
      <BehaviorBands :bands="data.bands" :monitoring-path="paths.monitoring" />
      <BehaviorSchoolTable :rows="data.schools" :school-path="paths.monitoringSchool" />
      <BehaviorHeatmap :heat="data.heat" />
      <BehaviorAlerts :alerts="data.alerts" />
      <BehaviorMood :mood-count="data.moodCount" />
    </template>
  </DsPage>
</template>
