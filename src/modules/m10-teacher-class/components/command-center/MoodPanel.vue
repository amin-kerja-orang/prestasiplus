<script setup lang="ts">
/** "💚 Mood Pelajar" (FN-M10-2.2.4): four counts, each opens the mood drill. */
import type { CcMood } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { type DrillRequest, MOODS } from './copy'

defineProps<{ mood: CcMood }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()
</script>

<template>
  <BoardPanel icon="💚" title="Mood Pelajar" testid="cc-panel-mood">
    <ul class="grid grid-cols-2 gap-x-3 gap-y-1">
      <li
        v-for="m in MOODS"
        :key="m.key"
        class="flex min-h-11 min-w-0 cursor-pointer items-center gap-2"
        :data-testid="`cc-mood-${m.key}`"
        @click="emit('drill', { type: 'mood', filter: m.key, label: 'Mood Pelajar' })"
      >
        <span class="text-xl" aria-hidden="true">{{ m.emoji }}</span>
        <span class="text-sm text-slate-300">{{ m.label }}</span>
        <span class="font-mono text-sm font-bold text-slate-100" data-testid="cc-mood-count">{{
          mood[m.key]
        }}</span>
      </li>
    </ul>
  </BoardPanel>
</template>
