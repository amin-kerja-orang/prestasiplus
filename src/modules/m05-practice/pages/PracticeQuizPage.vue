<script setup lang="ts">
/**
 * Q1 `/practice/:code/quiz?level=&difficulty=&count=` — the random-drill quiz (M05-T4; FR-M05-51…56,
 * LS-1/2/8; provisional: live never opened it). The page only starts the session through `QuizRunner`
 * (mode `random`) and gives it the Q1 labels (§8.3 PROPOSED COPY):
 *
 * - 402 `TRIAL_EXHAUSTED` → `/pricing` without a message; an unknown code → the global 404 page;
 * - header card title "{subject name}", tab title "{subject name} - Latihan" (UNVERIFIED);
 * - results "Keputusan Latihan", "Ulang Lagi" (a new session with the same parameters), "Kembali" → S3;
 * - "Lapor Soalan" posts the M04 report with `source: 'latihan'` (INFERRED).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { usePageMeta } from '@/composables'

import type { StartSessionRequest, StartSessionResponse } from '../api/types'
import { parseQuizQuery } from '../components/quiz/practice-config'
import QuizRunner from '../components/quiz/QuizRunner.vue'

const route = useRoute()
const pageMeta = usePageMeta()

const code = computed(() => String(route.params.code ?? ''))
const query = computed(() => parseQuizQuery(route.query))

const start = computed<StartSessionRequest>(() => ({
  mode: 'random',
  subjectCode: code.value,
  ...(query.value.levelId !== null ? { levelId: query.value.levelId } : {}),
  ...(query.value.difficulty !== null ? { difficulty: query.value.difficulty } : {}),
  count: query.value.count,
}))

const headerTitle = (s: StartSessionResponse): string => s.subject?.name ?? ''

function onLoaded(e: { session: StartSessionResponse }): void {
  if (e.session.subject) pageMeta.setTitle(`${e.session.subject.name} - Latihan`)
}
</script>

<template>
  <QuizRunner
    :key="`${code}?${JSON.stringify(query)}`"
    :start="start"
    :header-title="headerTitle"
    :back-url="`/practice/${encodeURIComponent(code)}`"
    retry="restart"
    :report="{ source: 'latihan' }"
    @loaded="onLoaded"
  />
</template>
