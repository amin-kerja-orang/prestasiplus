<script setup lang="ts">
/**
 * Q1 `/spm/tahun-lepas/:code/quiz?count=` — the databank quiz (M06-T2; FR-M06-20/21, BR-M06-05/13).
 * Mounts M05's `QuizRunner` (XL-10) with `start = {mode:'past_year', subjectCode, count}`, the M05 Q1
 * labels, back to S2 and the M04 report with `source:'spm'`. A count outside 5/10/20 is refused by M05
 * #4 (422); the runner then goes back to S2. Finishing completes the session through M05 #6.
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import {
  LATIH_TUBI_LABELS,
  QuizRunner,
  type StartSessionRequest,
  type StartSessionResponse,
} from '@/modules/m05-practice'

const route = useRoute()

const code = computed(() => String(route.params.code ?? ''))
const rawCount = computed(() => {
  const v = Array.isArray(route.query.count) ? route.query.count[0] : route.query.count
  return typeof v === 'string' && /^\d{1,9}$/.test(v) ? Number.parseInt(v, 10) : null
})

const start = computed<StartSessionRequest>(() => ({
  mode: 'past_year',
  subjectCode: code.value,
  ...(rawCount.value !== null ? { count: rawCount.value } : {}),
}))

const headerTitle = (s: StartSessionResponse): string => s.subject?.name ?? ''
</script>

<template>
  <QuizRunner
    :key="`${code}?${String(rawCount)}`"
    :start="start"
    :header-title="headerTitle"
    back-url="/spm/tahun-lepas"
    :labels="LATIH_TUBI_LABELS"
    retry="restart"
    :report="{ source: 'spm' }"
  />
</template>
