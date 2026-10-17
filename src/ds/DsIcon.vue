<script setup lang="ts">
/**
 * Phosphor icon by base name (design system 10.1). The weight follows the personality (learner
 * Duotone, staff Regular) unless `weight` is given; Bold is for tiny status glyphs. The names
 * reachable here are listed in `src/theme/ds-icons.ts` so they are bundled offline.
 */
import { computed } from 'vue'

import { dsIconWeightSuffix, type DsIconWeight } from '@/theme/ds-icons'

import { usePersonality } from './personality'

const props = defineProps<{
  /** Phosphor base name, e.g. `house`. */
  name: string
  weight?: DsIconWeight
}>()

const personality = usePersonality()
const resolved = computed<DsIconWeight>(
  () => props.weight ?? (personality.value === 'learner' ? 'duotone' : 'regular'),
)
const iconClass = computed(() => `i-ph-${props.name}${dsIconWeightSuffix[resolved.value]}`)
</script>

<template>
  <UIcon :name="iconClass" data-ds="icon" :data-weight="resolved" />
</template>
