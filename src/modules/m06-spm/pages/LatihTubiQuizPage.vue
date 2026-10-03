<script setup lang="ts">
/**
 * Q2 `/spm/latih-tubi/:code/quiz?count=&level=&difficulty=` or `?question_id=&count=1` (M06-T2;
 * FR-M06-32/33/34/87, BR-M06-07). Mounts M05's `QuizRunner` with `start = {mode:'latih_tubi', …}`.
 * - No matching question: the §8 message (PROPOSED COPY) with "Kembali" → S4.
 * - `question_id` the pool refuses (inactive, unknown, other subject): back to S4, no message (INFERRED).
 */
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import {
  QuizRunner,
  type StartSessionRequest,
  type StartSessionResponse,
} from '@/modules/m05-practice'

import { parseLatihTubiQuery } from '../lib/latih-tubi'
import { createSpmQuizApi, type SpmStartOutcome } from '../lib/quiz-api'

const route = useRoute()
const router = useRouter()

const code = computed(() => String(route.params.code ?? ''))
const query = computed(() => parseLatihTubiQuery(route.query))
const backUrl = computed(() => `/spm/latih-tubi/${encodeURIComponent(code.value)}`)

const start = computed<StartSessionRequest>(() => {
  const q = query.value
  return {
    mode: 'latih_tubi',
    subjectCode: code.value,
    ...(q.count !== null ? { count: q.count } : {}),
    ...(q.levelId !== null ? { levelId: q.levelId } : {}),
    ...(q.difficulty !== null ? { difficulty: q.difficulty } : {}),
    ...(q.questionId !== null ? { targetQuestionId: q.questionId } : {}),
  }
})

const noQuestions = ref(false)
const api = createSpmQuizApi((outcome: SpmStartOutcome) => {
  if (outcome === 'no-questions') noQuestions.value = true
  else void router.replace(backUrl.value)
})

const headerTitle = (s: StartSessionResponse): string => s.subject?.name ?? ''
</script>

<template>
  <div
    v-if="noQuestions"
    class="mx-auto max-w-xl px-4 py-10 text-center"
    data-testid="spm-no-questions"
  >
    <p class="mb-4 text-base font-semibold text-slate-700">
      Tiada soalan untuk tetapan ini. Sila ubah tetapan kuiz.
    </p>
    <RouterLink
      :to="backUrl"
      class="inline-flex min-h-11 items-center justify-center rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-blue-700"
      data-testid="spm-no-questions-back"
    >
      Kembali
    </RouterLink>
  </div>
  <QuizRunner
    v-else
    :key="`${code}?${JSON.stringify(query)}`"
    :start="start"
    :api="api"
    :header-title="headerTitle"
    :back-url="backUrl"
    retry="restart"
    :report="{ source: 'spm' }"
  />
</template>
