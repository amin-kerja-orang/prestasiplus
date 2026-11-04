<script setup lang="ts">
/**
 * Question map (US-10): one button per question with its state (Dijawab / Ditanda / Belum), grouped
 * by Bahagian. Used as the right rail on desktop and inside a bottom sheet below `lg`.
 */
import { computed } from 'vue'

import './attempt-shell.css'

import type { QuestionView, SectionView } from '@/modules/m28-bijak-spm/domain/types'

export type NavState = 'answered' | 'flagged' | 'none'

const props = defineProps<{
  sections: SectionView[]
  questions: QuestionView[]
  states: Record<string, NavState>
  current: string
  /** Choose-N counters by section id, e.g. "1 / 2 soalan dipilih". */
  counters?: Record<string, string>
}>()
const emit = defineEmits<{ go: [questionId: string] }>()

const counts = computed(() => {
  const all = props.questions.map((q) => props.states[q.id] ?? 'none')
  return {
    answered: all.filter((s) => s === 'answered').length,
    flagged: all.filter((s) => s === 'flagged').length,
    none: all.filter((s) => s === 'none').length,
  }
})
const label: Record<NavState, string> = { answered: 'Dijawab', flagged: 'Ditanda', none: 'Belum' }
/** Status never rests on colour alone (FR-MUR-QP-16): each state also has its own shape. */
const stateIcon: Record<NavState, string> = {
  answered: 'i-ph-check-bold',
  flagged: 'i-ph-flag-fill',
  none: 'i-ph-minus-bold',
}
</script>

<template>
  <nav class="flex flex-col gap-4" aria-label="Peta soalan" data-testid="navigator">
    <p class="text-caption text-muted" data-testid="nav-counts">
      Dijawab {{ counts.answered }} · Ditanda {{ counts.flagged }} · Belum {{ counts.none }}
    </p>
    <section v-for="s in sections" :key="s.id" class="flex flex-col gap-2">
      <h3 class="text-label text-highlighted">
        {{ s.label }}
        <span v-if="s.rule.type === 'choose'" class="text-caption text-muted">
          · pilih {{ s.rule.n }}</span
        >
      </h3>
      <p v-if="counters?.[s.id]" class="text-caption text-muted" role="status">
        {{ counters[s.id] }}
      </p>
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="q in questions.filter((x) => x.sectionId === s.id)"
          :key="q.id"
          type="button"
          :color="
            states[q.id] === 'flagged'
              ? 'warning'
              : states[q.id] === 'answered'
                ? 'primary'
                : 'neutral'
          "
          :variant="
            q.id === current
              ? 'outline'
              : states[q.id] === 'answered' || states[q.id] === 'flagged'
                ? 'solid'
                : 'soft'
          "
          class="tabular size-11 justify-center rounded-xl p-0 font-bold"
          :aria-label="`Soalan ${q.number}, ${label[states[q.id] ?? 'none']}`"
          :aria-current="q.id === current ? 'true' : undefined"
          :data-testid="`nav-${q.number}`"
          :data-state="states[q.id] ?? 'none'"
          @click="emit('go', q.id)"
        >
          {{ q.number }}
          <UIcon
            :name="stateIcon[states[q.id] ?? 'none']"
            class="size-3"
            aria-hidden="true"
            :data-icon="stateIcon[states[q.id] ?? 'none']"
            :data-testid="`nav-${q.number}-icon`"
          />
        </UButton>
      </div>
    </section>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted" data-testid="nav-legend">
      <li
        v-for="st in ['answered', 'flagged', 'none'] as const"
        :key="st"
      >
        <UIcon :name="stateIcon[st]" :data-icon="stateIcon[st]" class="size-3" aria-hidden="true" />
        {{ label[st] }}
      </li>
    </ul>
  </nav>
</template>
