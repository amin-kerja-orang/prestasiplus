<script setup lang="ts">
/**
 * S5 T4 Hasil (FR-M12-48 ... FR-M12-59; URS EP-M12-6). Mounted on `/admin/kirkpatrick/results` and the `/guru` twin;
 * `school_id` comes from the URL only (no form, FN-M12-6.1.1). One response holds the 946 prediction rows
 * (NFR-M12-01).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsPage } from '@/ds'

import { fetchKirkpatrickResults } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
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

const route = useRoute()
const paths = computed(() => kirkpatrickPaths(props.basePath))

const schoolQuery = computed(() => queryString(route.query.school_id).trim())
const schoolId = computed(() =>
  /^\d+$/.test(schoolQuery.value) ? Number(schoolQuery.value) : null,
)

const { data, error, loading } = useKirkpatrickPage(
  (signal) => fetchKirkpatrickResults({ schoolId: schoolId.value }, { signal }),
  () => route.fullPath,
)
</script>

<template>
  <DsPage data-testid="kirk-results">
    <KirkpatrickTabs :base-path="basePath" current="results" />
    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />
    <template v-if="data">
      <ResultsKpis :kpi="data.kpi" />
      <ResultsGrades v-if="data.distribution" :distribution="data.distribution" />
      <ResultsSubjectGps :subject-gps="data.subjectGps" />
      <ResultsTrend :trend="data.trend" />
      <ResultsSchools :rows="data.schools" :school-path="paths.monitoringSchool" />
      <ResultsPredictions :rows="data.predictions" :school-path="paths.monitoringSchool" />
      <ResultsAlesa :alesa="data.alesa" />
      <ResultsRoi :roi="data.roi" />
      <ResultsInsights :insights="data.insights" />
    </template>
  </DsPage>
</template>
