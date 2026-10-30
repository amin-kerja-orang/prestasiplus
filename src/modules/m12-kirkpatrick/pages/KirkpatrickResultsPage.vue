<script setup lang="ts">
/**
 * S5 T4 Hasil (FR-M12-48 ... FR-M12-59; URS EP-M12-6). Mounted on `/admin/kirkpatrick/results` and the `/guru` twin;
 * `school_id` comes from the URL only (no form, FN-M12-6.1.1). One response holds the 946 prediction rows
 * (NFR-M12-01).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { isAlesaAiOn } from '@/app/features'
import { DsLoadError, DsPage } from '@/ds'

import { fetchKirkpatrickResults } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickTabs,
  kirkpatrickPaths,
  queryString,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import ResultsAlesa from '../components/kirkpatrick/results/ResultsAlesa.vue'
import ResultsGrades from '../components/kirkpatrick/results/ResultsGrades.vue'
import ResultsInsights from '../components/kirkpatrick/results/ResultsInsights.vue'
import ResultsKpis from '../components/kirkpatrick/results/ResultsKpis.vue'
import ResultsPredictions from '../components/kirkpatrick/results/ResultsPredictions.vue'
import ResultsRoi from '../components/kirkpatrick/results/ResultsRoi.vue'
import ResultsSchools from '../components/kirkpatrick/results/ResultsSchools.vue'
import ResultsSubjectGps from '../components/kirkpatrick/results/ResultsSubjectGps.vue'
import ResultsTrend from '../components/kirkpatrick/results/ResultsTrend.vue'

const props = withDefaults(defineProps<{ basePath?: string }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
})

// The ALESA panel is hidden unless VITE_ALESA_AI=on (D73).
const alesaOn = isAlesaAiOn()
const route = useRoute()
const paths = computed(() => kirkpatrickPaths(props.basePath))

const schoolQuery = computed(() => queryString(route.query.school_id).trim())
const schoolId = computed(() =>
  /^\d+$/.test(schoolQuery.value) ? Number(schoolQuery.value) : null,
)

const { data, error, loading, reload } = useKirkpatrickPage(
  (signal) => fetchKirkpatrickResults({ schoolId: schoolId.value }, { signal }),
  () => route.fullPath,
)
</script>

<template>
  <DsPage
    data-testid="kirk-results"
    subtitle="Impak terhadap keputusan peperiksaan dan prestasi akademik"
  >
    <KirkpatrickTabs :base-path="basePath" current="results" />
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
      <ResultsKpis :kpi="data.kpi" />
      <ResultsGrades v-if="data.distribution" :distribution="data.distribution" />
      <ResultsSubjectGps :subject-gps="data.subjectGps" />
      <ResultsTrend :trend="data.trend" />
      <ResultsSchools :rows="data.schools" :school-path="paths.monitoringSchool" />
      <ResultsPredictions :rows="data.predictions" :school-path="paths.monitoringSchool" />
      <ResultsAlesa v-if="alesaOn" :alesa="data.alesa" />
      <ResultsRoi :roi="data.roi" />
      <ResultsInsights :insights="data.insights" />
    </template>
  </DsPage>
</template>
