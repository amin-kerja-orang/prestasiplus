<script setup lang="ts">
/**
 * "Lapor Soalan" on a Bijak question (attempt and Semakan, AC-R1-18.1 / S-69). The shared M04 report modal does the form;
 * this only passes the attempt, so the report stores the paper (T42). Bijak questions are BE-09 questions: variant `mcq`.
 */
import { computed, ref } from 'vue'

import { ReportQuestionModal } from '@/modules/m04-question-bank'

const props = defineProps<{ questionId: string; attemptId: string }>()
const open = ref(false)
/** The report API takes the numeric question id; a seed id that is not a number cannot be reported. */
const numericId = computed(() => {
  const n = Number(props.questionId)
  return Number.isSafeInteger(n) && n > 0 ? n : null
})
</script>

<template>
  <template v-if="numericId !== null">
    <UButton
      type="button"
      color="neutral"
      variant="ghost"
      icon="i-ph-flag-banner"
      class="min-h-11"
      data-testid="lapor-soalan"
      @click="open = true"
      >Lapor Soalan</UButton
    >
    <ReportQuestionModal v-model:open="open" :question-id="numericId" variant="mcq" :attempt-id="attemptId" source="spm" />
  </template>
</template>
