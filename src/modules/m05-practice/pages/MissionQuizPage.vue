<script setup lang="ts">
/**
 * Q5 `/misi-harian/:id` — the mission quiz (M05-T7; FR-M05-143, BR-32, BR-09; LS-12, provisional).
 * `QuizRunner` starts `{mode: 'mission', missionId}`; the header title is the mission title (read from
 * #21, falling back to the subject name while it loads), back to S14. Start 404 → the global 404 page;
 * 409 and 422 ("Soalan tidak mencukupi.") → alert and S14 (handled by the runner).
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'

import { fetchTodayMissions } from '../api/practice'
import type { StartSessionResponse } from '../api/types'
import { parseId } from '../components/remedial/assigned-lib'
import QuizRunner from '../components/quiz/QuizRunner.vue'

const route = useRoute()
const id = computed(() => parseId(route.params.id))
const missionTitle = ref<string | null>(null)

onMounted(() => {
  if (id.value === null) {
    setRouteOutcome(404)
    return
  }
  fetchTodayMissions()
    .then((r) => {
      missionTitle.value = r.data.find((m) => m.id === id.value)?.title ?? null
    })
    .catch(() => {
      /* the title falls back to the subject name */
    })
})

const headerTitle = (s: StartSessionResponse): string => missionTitle.value ?? s.subject?.name ?? ''
</script>

<template>
  <QuizRunner
    v-if="id !== null"
    :key="id"
    :start="{ mode: 'mission', missionId: id }"
    :header-title="headerTitle"
    back-url="/misi-harian"
    retry="restart"
    hide-retry
    :report="{ source: 'latihan' }"
  />
</template>
