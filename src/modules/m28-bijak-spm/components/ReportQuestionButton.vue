<script setup lang="ts">
/**
 * "Lapor Soalan" on a Bijak question (attempt and Semakan, AC-R1-18.1 / S-69). The shared M04 report modal does the form;
 * this only passes the attempt, so the report stores the paper (T42). `variant` follows the question: `mcq` for an objective one, `structured` for a written / multi-part one (its own reason set and source).
 */
import { computed, ref } from 'vue'

import { ReportQuestionModal } from '@/modules/m04-question-bank'

const props = withDefaults(defineProps<{ questionId: string; attemptId: string; variant?: 'mcq' | 'structured' }>(), { variant: 'mcq' })
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
      class="min-h-11 shrink-0"
      data-testid="lapor-soalan"
      @click="open = true"
      >Lapor Soalan</UButton
    >
    <ReportQuestionModal v-model:open="open" :question-id="numericId" :variant="variant" :attempt-id="attemptId" :source="variant === 'mcq' ? 'spm' : 'structured_attempt'" />
  </template>
</template>
