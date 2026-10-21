<script setup lang="ts">
/** "ALESA AI" (FR-M17-26, FN-M17-3.3.3): the rule-based sentence with the trend word in bold. */
import { computed } from 'vue'

import { DsSurface } from '@/ds'

import { ccAlesaSentence, type CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null }>()
const sentence = computed(() => (props.data ? ccAlesaSentence(props.data) : null))
</script>

<template>
  <BoardPanel icon="i-ph-sparkle" title="ALESA AI" testid="cc-panel-alesa">
    <DsSurface
      as="div"
      level="soft"
      radius="chip"
      padding="md"
      class="flex flex-1 items-center text-body text-default"
      data-testid="cc-alesa"
    >
      <p>
        <template v-if="sentence"
          >"{{ sentence.before }}<strong class="text-highlighted">{{ sentence.trend }}</strong
          >{{ sentence.after }}"</template
        >
        <template v-else>{{ S2_COPY.insightLoading }}</template>
      </p>
    </DsSurface>
  </BoardPanel>
</template>
