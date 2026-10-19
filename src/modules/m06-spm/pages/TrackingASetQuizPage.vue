<script setup lang="ts">
/**
 * Q3 `/spm/ramalan/:code?year=2026&set=n` — the Tracking A set quiz (M06-T3; FR-M06-51…53, BR-M06-13/14).
 * Mounts M05's `QuizRunner` with `start = {mode:'ramalan', subjectCode, year, setNo}`, the M05 Q1
 * labels, back to S6 and the M04 report with `source:'spm'`. M05 #4 refuses a Belum Cukup or unknown
 * set; the URL is then replaced with S6 and no session exists. Finishing completes through M05 #6.
 */
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import {
  QuizRunner,
  type StartSessionRequest,
  type StartSessionResponse,
} from '@/modules/m05-practice'

import { createTrackingQuizApi } from '../lib/tracking-quiz-api'

const props = defineProps<{ code: string; year: number; setNo: number }>()
const router = useRouter()

const backUrl = computed(() => `/spm/ramalan/${encodeURIComponent(props.code)}`)
const start = computed<StartSessionRequest>(() => ({
  mode: 'ramalan',
  subjectCode: props.code,
  year: props.year,
  setNo: props.setNo,
}))

const api = createTrackingQuizApi(() => {
  void router.replace(backUrl.value)
})

const headerTitle = (s: StartSessionResponse): string => s.subject?.name ?? ''
</script>

<template>
  <QuizRunner
    :key="`${code}/${String(year)}/${String(setNo)}`"
    :start="start"
    :api="api"
    :header-title="headerTitle"
    :back-url="backUrl"
    retry="restart"
    :report="{ source: 'spm' }"
  />
</template>
