<script setup lang="ts">
/**
 * A stimulus group in the Semakan list: the stimuli are shown ONCE with every member question under them
 * (D90). From 1024px a pinned, self-scrolling left pane; below it a chip "Lihat {label}" that opens a sheet
 * (D83 D-3). The member cards go in the default slot. Only one tree is rendered at a time.
 */
import { ref } from 'vue'

import { qdCopy } from '../../../components/question-display'
import { useMedia } from '@/ds/useMedia'

import type { StimulusDef } from '../domain/types'
import { groupLabel } from '../lib/stimulus-data'
import StimulusChip from './StimulusChip.vue'
import StimulusStack from './StimulusStack.vue'

const props = defineProps<{ groupId: string; stimuli: readonly StimulusDef[] }>()
const wide = useMedia('(min-width: 1024px)')
const open = ref(false)
const label = groupLabel(props.stimuli)
</script>

<template>
  <section
    v-if="wide"
    class="grid grid-cols-2 items-start gap-6"
    :aria-label="label"
    :data-group="groupId"
    data-testid="result-group"
    data-layout="split"
  >
    <aside
      class="sticky top-20 flex max-h-screen flex-col gap-2 self-start overflow-y-auto"
      :aria-label="label"
      data-testid="result-group-pane"
    >
      <StimulusStack :stimuli="stimuli" />
    </aside>
    <div class="flex min-w-0 flex-col gap-3" data-testid="result-group-members"><slot /></div>
  </section>

  <section
    v-else
    class="flex flex-col gap-3"
    :aria-label="label"
    :data-group="groupId"
    data-testid="result-group"
    data-layout="stacked"
  >
    <div class="sticky top-0 z-10 bg-default py-1">
      <StimulusChip :stimuli="stimuli" @open="open = true" />
    </div>
    <div class="flex min-w-0 flex-col gap-3" data-testid="result-group-members"><slot /></div>
    <UDrawer v-model:open="open" :title="label" :description="qdCopy.sheetDescription">
      <template #body>
        <StimulusStack :stimuli="stimuli" />
      </template>
    </UDrawer>
  </section>
</template>
