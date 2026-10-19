<script setup lang="ts">
/** The "L{n}" ladder of the provisional Jutawan game (SRS §8.2): 15 rungs, the passed ones green, the next one highlighted. */
import { JUTAWAN_LEVELS } from '../solo/solo-lib'

defineProps<{ level: number }>()

const RUNGS = Array.from({ length: JUTAWAN_LEVELS }, (_, i) => JUTAWAN_LEVELS - i)
</script>

<template>
  <ol class="flex flex-wrap gap-2 md:flex-col md:flex-nowrap" data-testid="jutawan-ladder">
    <li v-for="rung in RUNGS" :key="rung" class="md:w-full">
      <UBadge
        :color="rung <= level ? 'success' : rung === level + 1 ? 'warning' : 'neutral'"
        :variant="rung <= level + 1 ? 'solid' : 'soft'"
        size="lg"
        class="min-w-11 justify-center md:w-full"
        :data-state="rung <= level ? 'passed' : rung === level + 1 ? 'current' : 'next'"
        data-testid="jutawan-rung"
        >L{{ rung }}</UBadge
      >
    </li>
  </ol>
</template>
