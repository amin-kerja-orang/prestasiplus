<script setup lang="ts">
/**
 * Q4 `/remedial/:id` — the remedial test quiz (M05-T7; FR-M05-141, BR-32; LS-12, provisional).
 * A student: `QuizRunner` starts `{mode: 'remedial', remedialTestId}`; header title "Ujian Remedial —
 * {subject}", back to S13, no retry button (a restart would be a 409). Start 404 (unknown, another
 * student's, cancelled) → the global 404 page; 409 (completed) → the server message in an alert, then
 * S13 (handled by the runner). The test's teacher and an admin get the read-only preview instead
 * (`RemedialPreview`, `GET /api/remedial-tests/:id`); any other viewer gets the 404 page from the API.
 */
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { setRouteOutcome } from '@/app/router/outcome'
import { useSession } from '@/composables'

import type { StartSessionResponse } from '../api/types'
import QuizRunner from '../components/quiz/QuizRunner.vue'
import RemedialPreview from '../components/remedial/RemedialPreview.vue'
import { parseId } from '../components/remedial/assigned-lib'

const route = useRoute()
const { role } = useSession()
const id = computed(() => parseId(route.params.id))
const isPreview = computed(() => role.value === 'teacher' || role.value === 'admin')
onMounted(() => {
  if (id.value === null) setRouteOutcome(404)
})

const headerTitle = (s: StartSessionResponse): string => `Ujian Remedial — ${s.subject?.name ?? ''}`
</script>

<template>
  <template v-if="id !== null">
    <RemedialPreview v-if="isPreview" :id="id" :key="`p${String(id)}`" />
    <QuizRunner
      v-else
      :key="id"
      :start="{ mode: 'remedial', remedialTestId: id }"
      :header-title="headerTitle"
      back-url="/remedial/saya"
      retry="restart"
      hide-retry
      :report="{ source: 'latihan' }"
    />
  </template>
</template>
