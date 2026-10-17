<script setup lang="ts">
/** "ALESA AI" (FN-M10-2.2.4): the insight sentence of the live values. */
import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { insightText } from './copy'

defineProps<{ d: CcLiveData }>()
</script>

<template>
  <BoardPanel icon="i-ph-sparkle" title="ALESA AI" testid="cc-panel-insight">
    <p class="bg-soft p-3 text-body text-default" data-testid="cc-insight">
      {{ insightText(d) }}
    </p>
  </BoardPanel>
</template>
