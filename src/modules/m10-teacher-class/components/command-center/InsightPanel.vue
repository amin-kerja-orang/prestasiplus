<script setup lang="ts">
/** "🤖 ALESA AI" (FN-M10-2.2.4): the insight sentence of the live values. */
import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { insightText } from './copy'

defineProps<{ d: CcLiveData }>()
</script>

<template>
  <BoardPanel icon="🤖" title="ALESA AI" testid="cc-panel-insight">
    <p
      class="rounded-xl border border-indigo-500/40 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100 italic"
      data-testid="cc-insight"
    >
      {{ insightText(d) }}
    </p>
  </BoardPanel>
</template>
