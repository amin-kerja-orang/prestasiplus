<script setup lang="ts">
/**
 * The "Lihat {label}" chip of a stimulus group below 1024px: a 48 px thumbnail (the first stimulus) and the
 * label of the group ("Rajah 1" or "Rajah 1 dan Petikan A"). It opens the sheet; closing the sheet never
 * touches answers (D83 D-3).
 */
import { computed } from 'vue'

import type { StimulusDef } from '../domain/types'
import { groupLabel } from '../lib/stimulus-data'
import StimulusView from './StimulusView.vue'

const props = defineProps<{ stimuli: readonly StimulusDef[] }>()
defineEmits<{ open: [] }>()
const label = computed(() => groupLabel(props.stimuli))
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="soft"
    class="min-h-11 w-full justify-start gap-3"
    aria-haspopup="dialog"
    data-testid="stimulus-chip"
    @click="$emit('open')"
  >
    <span v-if="stimuli[0]" class="w-12 shrink-0"><StimulusView :stimulus="stimuli[0]" thumb /></span>
    <span class="text-label">Lihat {{ label }}</span>
  </UButton>
</template>
