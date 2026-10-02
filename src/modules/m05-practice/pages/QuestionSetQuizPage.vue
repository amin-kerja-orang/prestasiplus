<script setup lang="ts">
/**
 * Q6 `/set-soalan-saya/:id/jawab` — the teacher question-set quiz (M05-T7; FR-M05-144, BR-32;
 * LS-12, provisional). `QuizRunner` starts `{mode: 'question_set', questionSetId}`; back to the M10
 * list `/set-soalan-saya`. When #4 returns `timeLimitSec` the runner counts down and submits at 0.
 * The header title is "Set Soalan Guru": the set title is not in the #4 response (see the task report).
 * Start 404 → the global 404 page; 409 → alert and the list (handled by the runner).
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'

import { parseId } from '../components/remedial/assigned-lib'
import QuizRunner from '../components/quiz/QuizRunner.vue'

const route = useRoute()
const id = computed(() => parseId(route.params.id))
onMounted(() => {
  if (id.value === null) setRouteOutcome(404)
})
</script>

<template>
  <QuizRunner
    v-if="id !== null"
    :key="id"
    :start="{ mode: 'question_set', questionSetId: id }"
    header-title="Set Soalan Guru"
    back-url="/set-soalan-saya"
    retry="restart"
    :report="{ source: 'latihan' }"
  />
</template>
