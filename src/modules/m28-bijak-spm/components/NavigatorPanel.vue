<script setup lang="ts">
/**
 * Question map (US-10): one button per question with its state (Dijawab / Ditanda / Belum), grouped
 * by Bahagian. Used as the right rail on desktop and inside a bottom sheet below `lg`.
 */
import { computed } from 'vue'

import { DsCluster, DsStack, DsSurface, DsText } from '@/ds'

import type { QuestionView, SectionView } from '../domain/types'

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
</script>

<template>
  <DsStack as="nav" aria-label="Peta soalan" data-testid="navigator">
    <p class="text-caption text-muted" data-testid="nav-counts">
      Dijawab {{ counts.answered }} · Ditanda {{ counts.flagged }} · Belum {{ counts.none }}
    </p>
    <DsStack v-for="s in sections" :key="s.id" as="section" gap="xs">
      <h3 class="text-label text-highlighted">
        {{ s.label }}
        <span v-if="s.rule.type === 'choose'" class="text-caption text-muted">
          · pilih {{ s.rule.n }}</span
        >
      </h3>
      <p v-if="counters?.[s.id]" class="text-caption text-muted" role="status">
        {{ counters[s.id] }}
      </p>
      <!-- The current question sits in a high-contrast frame (the inverted surface: dark in light
           mode, white in dark mode) and keeps its own state fill, so "current + answered" shows
           both. A frame instead of a ring: the design system has no ring/outline utilities. -->
      <DsCluster gap="none">
        <DsSurface
          v-for="q in questions.filter((x) => x.sectionId === s.id)"
          :key="q.id"
          :level="q.id === current ? 'inverted' : 'raised'"
          padding="none"
          radius="card"
          shadow="none"
          :clip="false"
          :data-current="q.id === current ? 'true' : undefined"
        >
          <UButton
            type="button"
            :color="
              states[q.id] === 'flagged'
                ? 'warning'
                : states[q.id] === 'answered'
                  ? 'primary'
                  : 'neutral'
            "
            :variant="states[q.id] === 'answered' || states[q.id] === 'flagged' ? 'solid' : 'soft'"
            class="tabular m-1 size-11 justify-center rounded-xl p-0 font-bold"
            :aria-label="`Soalan ${q.number}, ${label[states[q.id] ?? 'none']}`"
            :aria-current="q.id === current ? 'true' : undefined"
            :data-testid="`nav-${q.number}`"
            :data-state="states[q.id] ?? 'none'"
            @click="emit('go', q.id)"
            >{{ q.number }}</UButton
          >
        </DsSurface>
      </DsCluster>
    </DsStack>
    <DsCluster as="ul" gap="md" row-gap="2xs" aria-hidden="true" data-testid="nav-legend">
      <li>
        <DsCluster as="span" gap="xs" :wrap="false">
          <DsSurface
            tone="primary"
            emphasis="strong"
            padding="none"
            radius="chip"
            class="size-3"
            data-swatch="answered"
          />
          <DsText as="span" variant="caption" tone="muted">Dijawab</DsText>
        </DsCluster>
      </li>
      <li>
        <DsCluster as="span" gap="xs" :wrap="false">
          <DsSurface
            tone="warning"
            emphasis="strong"
            padding="none"
            radius="chip"
            class="size-3"
            data-swatch="flagged"
          />
          <DsText as="span" variant="caption" tone="muted">Ditanda</DsText>
        </DsCluster>
      </li>
      <li>
        <DsCluster as="span" gap="xs" :wrap="false">
          <DsSurface
            level="elevated"
            padding="none"
            radius="chip"
            class="size-3"
            data-swatch="none"
          />
          <DsText as="span" variant="caption" tone="muted">Belum</DsText>
        </DsCluster>
      </li>
    </DsCluster>
  </DsStack>
</template>
