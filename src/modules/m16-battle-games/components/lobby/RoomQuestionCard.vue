<script setup lang="ts">
/**
 * The question of a room round (PROVISIONAL, URS FN-M16-5.5.3: the Betul atau Salah / Cabaran Kilat cards
 * are reused). `mcq` shows the options as buttons (Perang Fakta's "Betul" / "Salah" are options 0 / 1 of the
 * same shape); `word` (Teka Silang Kata) shows a text box for the typed word. Emits the chosen option or the
 * typed word; the page posts #28.
 */
import { ref, useId, watch } from 'vue'

import { FORM_INPUT_CLASS } from '@/components/form/classes'

import type { RoomQuestion } from '../../api'

const props = defineProps<{
  question: RoomQuestion
  mode: 'mcq' | 'word'
  busy: boolean
  /** Only the acting player may answer. */
  disabled: boolean
  /** Optional countdown text ("10s") in the corner. */
  countdown?: string | null
}>()

const emit = defineEmits<{ answer: [answer: { optionId?: number; value?: string }] }>()

const word = ref('')
const inputId = useId()

watch(
  () => props.question.id,
  () => {
    word.value = ''
  },
)

function pick(optionId: number): void {
  if (props.busy || props.disabled) return
  emit('answer', { optionId })
}

function submitWord(): void {
  if (props.busy || props.disabled) return
  emit('answer', { value: word.value })
}
</script>

<template>
  <div class="space-y-4" data-testid="room-question">
    <div class="flex items-start justify-between gap-3">
      <p
        class="text-base font-semibold break-words text-slate-800"
        data-testid="room-question-text"
      >
        {{ question.text }}
      </p>
      <span
        v-if="countdown"
        class="shrink-0 rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-bold text-indigo-700"
        data-testid="room-countdown"
        >{{ countdown }}</span
      >
    </div>

    <div v-if="mode === 'mcq'" class="grid gap-2 sm:grid-cols-2">
      <button
        v-for="o in question.options"
        :key="o.id"
        type="button"
        :disabled="busy || disabled"
        class="flex min-h-11 items-center gap-3 rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-60"
        data-testid="room-option"
        @click="pick(o.id)"
      >
        <span
          class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700"
          >{{ o.label }}</span
        >
        <span class="min-w-0 break-words">{{ o.text }}</span>
      </button>
    </div>

    <form v-else class="space-y-3" data-testid="room-word-form" @submit.prevent="submitWord">
      <label :for="inputId" class="block text-sm font-semibold text-slate-600">Jawapan</label>
      <input
        :id="inputId"
        v-model="word"
        type="text"
        autocomplete="off"
        :disabled="busy || disabled"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="room-word-input"
      />
      <button
        type="submit"
        :disabled="busy || disabled"
        class="inline-flex min-h-11 w-full items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-white bg-primary-gradient disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        data-testid="room-word-submit"
      >
        Hantar
      </button>
    </form>
  </div>
</template>
