<script setup lang="ts">
/** "Penglibatan Pelajar" (FN-M10-2.2.5): "Jumlah: {n} pelajar" and the five bands; a row opens its drill. */
import { computed } from 'vue'

import type { CcEngagement } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { BANDS, type DrillRequest, S2_COPY } from './copy'

const props = defineProps<{ engagement: CcEngagement }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const total = computed(() => Object.values(props.engagement).reduce((a, b) => a + b, 0))
const share = (n: number) => (total.value === 0 ? 0 : Math.round((n / total.value) * 100))
</script>

<template>
  <BoardPanel icon="users-three" accent="friend" title="Penglibatan Pelajar" testid="cc-panel-engagement">
    <p class="mb-2 text-end text-body text-muted" data-testid="cc-engagement-total">
      Jumlah: <b class="tabular text-highlighted">{{ total }}</b> pelajar
    </p>
    <ul class="flex flex-col gap-1">
      <li v-for="b in BANDS" :key="b.key" class="min-w-0">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-h-11 justify-start gap-3 px-2 py-2 text-start"
          :title="S2_COPY.bandHint"
          :data-testid="`cc-band-${b.key}`"
          @click="emit('drill', { type: 'engagement', filter: b.key, label: 'Penglibatan Pelajar' })"
        >
          <span class="w-24 shrink-0 text-body text-toned">{{ b.label }}</span>
          <UProgress
            class="min-w-6 flex-1"
            :model-value="share(engagement[b.key])"
            :max="100"
            :color="b.bar"
            aria-hidden="true"
          />
          <span
            class="tabular w-8 shrink-0 text-end text-label text-highlighted"
            data-testid="cc-band-count"
            >{{ engagement[b.key] }}</span
          >
        </UButton>
      </li>
    </ul>
  </BoardPanel>
</template>
