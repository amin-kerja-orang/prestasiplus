<script setup lang="ts">
/**
 * A stimulus shared by two or more questions, rendered once per group (AC-11.7, AC-11.8, D41).
 *  - from 1024px (`lg`): two columns, the stimulus is a pinned, self-scrolling left pane;
 *  - below 1024px: one column, a sticky chip "Lihat {label}" opens a bottom sheet with the full
 *    stimulus; closing the sheet never touches answers (D-3).
 * The questions go in the default slot. Only one tree is rendered at a time (no duplicate ids).
 */
import { computed } from 'vue'

import { DsIconChip, DsText } from '@/ds'
import { useMedia } from '@/ds/useMedia'

import { chipLabel, qdCopy } from './copy'
import StimulusFigure from './StimulusFigure.vue'
import type { StimulusData } from './types'

const props = withDefaults(defineProps<{ stimulus: StimulusData; hint?: boolean }>(), { hint: true })

const open = defineModel<boolean>('open', { default: false })
const wide = useMedia('(min-width: 1024px)')
const label = computed(() => props.stimulus.label ?? qdCopy.passageFallback)
const thumbIcon = computed(() => (props.stimulus.kind === 'table' ? 'table' : 'file-text'))
const thumbSrc = computed(() => props.stimulus.src)
const iconOnly = computed(() => props.stimulus.kind === 'passage' || props.stimulus.kind === 'table')
</script>

<template>
  <div
    v-if="wide"
    class="grid grid-cols-2 items-start gap-6"
    data-testid="stimulus-group"
    data-layout="split"
  >
    <aside
      class="sticky top-20 flex max-h-[calc(100vh-6rem)] flex-col gap-2 self-start overflow-y-auto"
      :aria-label="label"
      data-testid="stimulus-pane"
    >
      <DsText v-if="hint" variant="caption" tone="muted" data-testid="stimulus-hint">{{ qdCopy.pinnedHint }}</DsText>
      <StimulusFigure :stimulus="stimulus" :max-height="false" />
    </aside>
    <div class="flex min-w-0 flex-col gap-6" data-testid="stimulus-questions"><slot /></div>
  </div>

  <div v-else class="flex flex-col gap-4" data-testid="stimulus-group" data-layout="stacked">
    <div class="sticky top-0 z-10 bg-default py-1">
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        class="min-h-11 w-full justify-start gap-3"
        aria-haspopup="dialog"
        data-testid="stimulus-chip"
        @click="open = true"
      >
        <span class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          <img
            v-if="thumbSrc && !iconOnly"
            :src="thumbSrc"
            alt=""
            width="48"
            height="48"
            loading="lazy"
            class="size-12 object-cover"
            data-testid="stimulus-thumb-img"
          />
          <DsIconChip v-else :icon="thumbIcon" tone="neutral" size="lg" data-testid="stimulus-thumb-icon" />
        </span>
        <span class="text-label">{{ chipLabel(label) }}</span>
      </UButton>
    </div>
    <div class="flex min-w-0 flex-col gap-6" data-testid="stimulus-questions"><slot /></div>
  </div>

  <UDrawer
    v-if="!wide"
    v-model:open="open"
    :title="label"
    :description="qdCopy.sheetDescription"
  >
    <template #body>
      <StimulusFigure :stimulus="stimulus" />
    </template>
  </UDrawer>
</template>
