<script setup lang="ts">
/**
 * The stimuli of ONE group, stacked in order (1 to 3). Rendered once per group, never once per member
 * question (D90): the pinned panel (from 1024px), the sheet (below it) and the result group all use this.
 * A picture that fails to load reports its stimulus id to the parent.
 */
import type { StimulusDef } from '../domain/types'
import StimulusView from './StimulusView.vue'

defineProps<{ stimuli: readonly StimulusDef[] }>()
const emit = defineEmits<{ loaded: [id: string]; error: [id: string] }>()
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="group-stimuli" :data-count="stimuli.length">
    <StimulusView
      v-for="s in stimuli"
      :key="s.id"
      :stimulus="s"
      @loaded="emit('loaded', s.id)"
      @error="emit('error', s.id)"
    />
  </div>
</template>
