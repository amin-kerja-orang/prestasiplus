<script setup lang="ts">
/**
 * S3 T2 Pembelajaran (FR-M12-34..39; URS EP-M12-4): tab strip, six KPI cards, the Learning Gain card, the
 * subject bars and the school table. `school_id` comes from the URL only (the page has no form).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { DsLoadError, DsPage } from '@/ds'

import { fetchKirkpatrickLearning } from '../api'
import {
  KIRKPATRICK_ADMIN_BASE,
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

const { data, error, loading, reload } = useKirkpatrickPage(
  (signal) =>
    fetchKirkpatrickLearning(
      { schoolId: /^\d+$/.test(schoolId.value) ? Number(schoolId.value) : null },
      { signal },
    ),
  schoolId,
)
</script>

<template>
  <DsPage
    data-testid="kirk-learning-page"
    subtitle="Peningkatan pengetahuan, kemahiran, dan kefahaman pelajar"
  >
    <KirkpatrickTabs :base-path="basePath" current="learning" />

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
      <LearningKpis :kpi="data.kpi" />
      <LearningGainCard />
      <LearningSubjects :subjects="data.subjects" />
      <LearningSchools :schools="data.schools" :paths="paths" />
    </template>
  </DsPage>
</template>
