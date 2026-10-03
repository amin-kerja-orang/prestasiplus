<script setup lang="ts">
/** "📊 Engagement Pelajar" (FN-M10-2.2.5): "Jumlah: {n} pelajar" and the five bands; a row opens its drill. */
import { computed } from 'vue'

import type { CcEngagement } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { BANDS, type DrillRequest, S2_COPY } from './copy'

const props = defineProps<{ engagement: CcEngagement }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const total = computed(() => Object.values(props.engagement).reduce((a, b) => a + b, 0))
const width = (n: number) =>
  `${String(total.value === 0 ? 0 : Math.round((n / total.value) * 100))}%`
</script>

<template>
  <BoardPanel icon="📊" title="Engagement Pelajar" testid="cc-panel-engagement">
    <p class="mb-2 text-right font-mono text-sm text-slate-400" data-testid="cc-engagement-total">
      Jumlah: <b class="text-slate-50">{{ total }}</b> pelajar
    </p>
    <ul class="space-y-1">
      <li
        v-for="b in BANDS"
        :key="b.key"
        class="flex min-h-11 cursor-pointer items-center gap-3"
        :title="S2_COPY.bandHint"
        :data-testid="`cc-band-${b.key}`"
        @click="emit('drill', { type: 'engagement', filter: b.key, label: 'Engagement Pelajar' })"
      >
        <span class="w-24 shrink-0 text-sm text-slate-300">{{ b.label }}</span>
        <span
          class="h-3 min-w-6 flex-1 overflow-hidden rounded-full bg-slate-900/70"
          aria-hidden="true"
        >
          <span
            :class="['block h-full min-w-1.5 rounded-full', b.bar]"
            :style="{ width: width(engagement[b.key]) }"
          />
        </span>
        <span
          class="w-8 shrink-0 text-right font-mono text-sm font-bold text-slate-100"
          data-testid="cc-band-count"
          >{{ engagement[b.key] }}</span
        >
      </li>
    </ul>
  </BoardPanel>
</template>
