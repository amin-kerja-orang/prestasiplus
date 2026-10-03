<script setup lang="ts">
/**
 * S3 T2 Pembelajaran (FR-M12-34..39; URS EP-M12-4): tab strip, six KPI cards, the Learning Gain card, the
 * subject bars and the school table. `school_id` comes from the URL only (the page has no form).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { fetchKirkpatrickLearning } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
  KirkpatrickLoadState,
  kirkpatrickPaths,
  KirkpatrickTabs,
  queryString,
  useKirkpatrickPage,
} from '../components/kirkpatrick/common'
import LearningGainCard from '../components/kirkpatrick/learning/LearningGainCard.vue'
import LearningKpis from '../components/kirkpatrick/learning/LearningKpis.vue'
import LearningSchools from '../components/kirkpatrick/learning/LearningSchools.vue'
import LearningSubjects from '../components/kirkpatrick/learning/LearningSubjects.vue'

const props = withDefaults(defineProps<{ basePath?: string }>(), {
  basePath: KIRKPATRICK_ADMIN_BASE,
})

const route = useRoute()
const paths = computed(() => kirkpatrickPaths(props.basePath))
const schoolId = computed(() => queryString(route.query.school_id))

const { data, error, loading } = useKirkpatrickPage(
  (signal) =>
    fetchKirkpatrickLearning(
      { schoolId: /^\d+$/.test(schoolId.value) ? Number(schoolId.value) : null },
      { signal },
    ),
  schoolId,
)
</script>

<template>
  <div class="min-w-0" data-testid="kirk-learning-page">
    <KirkpatrickTabs :base-path="basePath" current="learning" />

    <KirkpatrickLoadState :loading="loading" :error="error" :has-data="data !== null" />

    <div v-if="data" class="space-y-4">
      <LearningKpis :kpi="data.kpi" />
      <LearningGainCard />
      <LearningSubjects :subjects="data.subjects" />
      <LearningSchools :schools="data.schools" :paths="paths" />
    </div>
  </div>
</template>
