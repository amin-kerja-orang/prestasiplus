<script setup lang="ts">
/** "Mood Pelajar" (FN-M10-2.2.4): four counts, each opens the mood drill. */
import type { CcMood } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { type DrillRequest, MOODS } from './copy'

defineProps<{ mood: CcMood }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()
</script>

<template>
  <BoardPanel icon="i-ph-smiley" title="Mood Pelajar" testid="cc-panel-mood">
    <ul class="grid grid-cols-2 gap-2">
      <li v-for="m in MOODS" :key="m.key" class="min-w-0">
        <UButton
          color="neutral"
          variant="soft"
          block
          class="min-w-0 justify-start gap-2"
          :icon="m.icon"
          :data-testid="`cc-mood-${m.key}`"
          @click="emit('drill', { type: 'mood', filter: m.key, label: 'Mood Pelajar' })"
        >
          <span class="text-body">{{ m.label }}</span>
          <span class="tabular text-label text-highlighted" data-testid="cc-mood-count">{{
            mood[m.key]
          }}</span>
        </UButton>
      </li>
    </ul>
  </BoardPanel>
</template>
