<script setup lang="ts">
/** "🤖 ALESA AI" (FR-M17-26, FN-M17-3.3.3): the rule-based sentence with the trend word in bold. */
import { computed } from 'vue'

import { ccAlesaSentence, type CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null }>()
const sentence = computed(() => (props.data ? ccAlesaSentence(props.data) : null))
</script>

<template>
  <BoardPanel icon="🤖" title="ALESA AI" testid="cc-panel-alesa">
    <p
      class="rounded-xl border border-indigo-500/40 bg-gradient-to-br from-indigo-950 to-slate-800 p-3 text-sm text-slate-200 italic"
      data-testid="cc-alesa"
    >
      <template v-if="sentence"
        >"{{ sentence.before }}<strong class="text-slate-50">{{ sentence.trend }}</strong
        >{{ sentence.after }}"</template
      >
      <template v-else>{{ S2_COPY.insightLoading }}</template>
    </p>
  </BoardPanel>
</template>
