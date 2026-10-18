<script setup lang="ts">
/**
 * Quiz option (design system 6, "Quiz option"). Full-width 60px raised button with a leading
 * letter badge. States: idle, selected (primary mix), correct (green mix + check), wrong (red mix
 * + x + nudge), dimmed (55%). Correct / wrong are locked states: the option stops reacting and
 * carries a check or x glyph plus screen-reader text, so colour is never the only signal.
 */
import { computed } from 'vue'

import type { QuizOptionState } from './types'

const props = withDefaults(
  defineProps<{
    /** Letter badge, e.g. "A". */
    letter: string
    state?: QuizOptionState
    /** Screen-reader words for the locked states (generic BM defaults). */
    correctLabel?: string
    wrongLabel?: string
  }>(),
  { state: 'idle', correctLabel: 'Betul', wrongLabel: 'Salah' },
)

const emit = defineEmits<{ select: [] }>()

/** Verdict states stop reacting (the check has been made). */
const locked = computed(
  () => props.state === 'correct' || props.state === 'wrong' || props.state === 'dimmed',
)
const marked = computed(() => props.state === 'correct' || props.state === 'wrong')

const tint: Record<QuizOptionState, string> = {
  idle: '',
  selected: 'bg-primary/18',
  correct: 'bg-success/22',
  wrong: 'bg-error/20',
  dimmed: '',
}
const letterTone: Record<QuizOptionState, string> = {
  idle: 'bg-elevated text-toned',
  selected: 'bg-primary text-primary-on',
  correct: 'bg-success text-on-sem',
  wrong: 'bg-error text-on-sem',
  dimmed: 'bg-elevated text-toned',
}

function onClick(): void {
  if (!locked.value) emit('select')
}
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    block
    class="relative h-auto min-h-15 justify-start gap-3 overflow-hidden rounded-card bg-default py-2 pr-3.5 pl-2.5 text-start text-body font-semibold text-highlighted shadow-none hover:bg-default"
    :class="[
      state === 'dimmed'
        ? 'opacity-55 aria-disabled:opacity-55'
        : locked && 'aria-disabled:opacity-100',
      state === 'wrong' && 'animate-ds-nudge motion-reduce:animate-none',
    ]"
    :aria-pressed="locked ? undefined : state === 'selected'"
    :aria-disabled="locked ? 'true' : undefined"
    :data-state="state"
    data-ds="quiz-option"
    @click="onClick"
  >
    <span class="pointer-events-none absolute inset-0" :class="tint[state]" aria-hidden="true" />
    <span
      class="relative inline-grid size-9 shrink-0 place-items-center rounded-chip text-label font-extrabold"
      :class="letterTone[state]"
      aria-hidden="true"
      >{{ letter }}</span
    >
    <span class="relative min-w-0 flex-1 break-words"><slot /></span>
    <span
      v-if="marked"
      class="relative inline-grid size-7 shrink-0 place-items-center rounded-full text-on-sem"
      :class="state === 'correct' ? 'bg-success' : 'bg-error'"
      data-ds="option-marker"
    >
      <UIcon
        :name="state === 'correct' ? 'i-ph-check-bold' : 'i-ph-x-bold'"
        :data-glyph="state === 'correct' ? 'check' : 'x'"
        class="size-4"
        aria-hidden="true"
      />
      <span class="sr-only">{{ state === 'correct' ? correctLabel : wrongLabel }}</span>
    </span>
  </UButton>
</template>
