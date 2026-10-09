<script setup lang="ts">
/**
 * One served question with its answer input (provisional pages S4a / S4b, L-2 / L-3): option
 * choices for Bahagian A / B (radio), a text area for C. Layout is PROPOSED, not observed.
 */
import type { PkskAnswer, PkskServedQuestion } from '../api/types'

const props = defineProps<{ question: PkskServedQuestion; index: number; modelValue: PkskAnswer }>()
const emit = defineEmits<{ 'update:modelValue': [value: PkskAnswer] }>()

function pick(i: number): void {
  emit('update:modelValue', { questionId: props.question.id, optionIndex: i })
}
function type(text: string): void {
  emit('update:modelValue', { questionId: props.question.id, text })
}
</script>

<template>
  <fieldset
    class="min-w-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm"
    data-testid="pksk-item"
    :data-question-id="question.id"
  >
    <legend class="sr-only">Soalan {{ index }}</legend>
    <p class="text-sm font-semibold break-words text-slate-800">
      {{ index }}. {{ question.questionText }}
    </p>
    <div v-if="question.options.length > 0" class="space-y-2">
      <label
        v-for="(o, i) in question.options"
        :key="i"
        class="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-700 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50"
      >
        <input
          type="radio"
          :name="`q-${String(question.id)}`"
          :value="i"
          :checked="modelValue.optionIndex === i"
          class="h-4 w-4 shrink-0"
          data-testid="pksk-option"
          @change="pick(i)"
        />
        <span class="min-w-0 break-words">{{ o.text }}</span>
      </label>
    </div>
    <textarea
      v-else
      rows="5"
      class="w-full rounded-xl border border-slate-300 p-3 text-sm"
      :value="modelValue.text ?? ''"
      data-testid="pksk-essay"
      @input="type(($event.target as HTMLTextAreaElement).value)"
    ></textarea>
  </fieldset>
</template>
