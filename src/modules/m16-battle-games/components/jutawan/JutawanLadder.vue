<script setup lang="ts">
/** The "L{n}" ladder of the provisional Jutawan game (SRS §8.2): 15 rungs, the passed ones green, the next one highlighted. */
import { JUTAWAN_LEVELS } from '../solo/solo-lib'

defineProps<{ level: number }>()

const RUNGS = Array.from({ length: JUTAWAN_LEVELS }, (_, i) => JUTAWAN_LEVELS - i)
</script>

<template>
  <ol class="flex flex-wrap gap-1.5 md:flex-col md:flex-nowrap" data-testid="jutawan-ladder">
    <li
      v-for="rung in RUNGS"
      :key="rung"
      class="min-w-11 rounded-lg px-2 py-1 text-center text-xs font-bold md:text-sm"
      :class="
        rung <= level
          ? 'passed bg-emerald-500 text-emerald-950'
          : rung === level + 1
            ? 'current bg-amber-400 text-slate-950'
            : 'bg-white/10 text-slate-300'
      "
      data-testid="jutawan-rung"
    >
      L{{ rung }}
    </li>
  </ol>
</template>
