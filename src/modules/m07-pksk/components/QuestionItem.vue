<script setup lang="ts">
/**
 * One served question with its answer input (provisional pages S4a / S4b, L-2 / L-3): option
 * choices for Bahagian A / B (radio), a text area for C. Layout is PROPOSED, not observed.
 * Options reuse the quiz kit's `DsQuizOption` (toggle buttons in a labelled group).
 */
import { DsQuizOption } from '@/ds'

import type { PkskAnswer, PkskServedQuestion } from '../api/types'

const props = defineProps<{ question: PkskServedQuestion; index: number; modelValue: PkskAnswer }>()
const emit = defineEmits<{ 'update:modelValue': [value: PkskAnswer] }>()

const LETTERS = 'ABCDEFGH'

function pick(i: number): void {
  emit('update:modelValue', { questionId: props.question.id, optionIndex: i })
}
function type(text: string): void {
  emit('update:modelValue', { questionId: props.question.id, text })
}
</script>

<template>
  <UCard data-testid="pksk-item" :data-question-id="question.id">
    <div class="flex min-w-0 flex-col gap-3">
      <p class="text-label break-words text-highlighted">
        {{ index }}. {{ question.questionText }}
      </p>
      <div
        v-if="question.options.length > 0"
        role="group"
        :aria-label="question.questionText"
        class="flex min-w-0 flex-col gap-2"
      >
        <DsQuizOption
          v-for="(o, i) in question.options"
          :key="i"
          :letter="LETTERS[i] ?? String(i + 1)"
          :state="modelValue.optionIndex === i ? 'selected' : 'idle'"
          data-testid="pksk-option"
          @select="pick(i)"
        >
          {{ o.text }}
        </DsQuizOption>
      </div>
      <UTextarea
        v-else
        :model-value="modelValue.text ?? ''"
        :rows="5"
        size="xl"
        class="w-full"
        data-testid="pksk-essay"
        @update:model-value="type(String($event ?? ''))"
      />
    </div>
  </UCard>
</template>
