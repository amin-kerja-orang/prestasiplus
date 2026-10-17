<script setup lang="ts">
/**
 * One day of the 90-day activity map (S6, FR-M08-42): a keyboard-focusable cell on the five-step ramp of
 * BR-M08-11. The active (hovered or pinned) day uses the base surface so it stands out from every step.
 */
import { computed } from 'vue'

import { heatClass } from '../../lib/analitik'

const props = defineProps<{ sessions: number; active: boolean; label: string; pressed: boolean }>()

const tone = computed(() => (props.active ? 'bg-default' : heatClass(props.sessions)))
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="ghost"
    size="xs"
    square
    class="size-6 p-0"
    :class="tone"
    :aria-label="label"
    :aria-pressed="pressed"
  />
</template>
