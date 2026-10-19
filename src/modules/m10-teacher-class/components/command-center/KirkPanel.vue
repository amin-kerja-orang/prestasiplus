<script setup lang="ts">
/**
 * "Kirkpatrick" (FN-M10-2.2.4): T1 "{stars} {v}/10", T2 "{x}% ketepatan", T3 "{n} aktif 30h", T4 "GPS {g}";
 * each row opens its drill (kirk t1-t4). The bar widths are PROPOSED (live shows empty tracks at 0).
 */
import { computed } from 'vue'

import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { type DrillRequest, plain, stars } from './copy'

const props = defineProps<{ d: CcLiveData }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const clamp = (v: number) => Math.max(0, Math.min(100, v))
const rows = computed(() => {
  const d = props.d
  return [
    { id: 't1', width: clamp(d.kirkT1 * 10), text: `${stars(d.kirkT1)} ${plain(d.kirkT1)}/10` },
    { id: 't2', width: clamp(d.kirkT2Accuracy), text: `${String(d.kirkT2Accuracy)}% ketepatan` },
    {
      id: 't3',
      width: clamp(d.totalStudentsRaw === 0 ? 0 : (d.kirkT3Active / d.totalStudentsRaw) * 100),
      text: `${String(d.kirkT3Active)} aktif 30h`,
    },
    {
      id: 't4',
      width: clamp(d.kirkT4Gps > 0 ? ((5 - d.kirkT4Gps) / 4) * 100 : 0),
      text: `GPS ${plain(d.kirkT4Gps, 2)}`,
    },
  ]
})
</script>

<template>
  <BoardPanel icon="flask" accent="heat" title="Kirkpatrick" testid="cc-panel-kirk">
    <ul class="flex flex-col gap-1">
      <li v-for="r in rows" :key="r.id" class="min-w-0">
        <UButton
          color="neutral"
          variant="ghost"
          block
          class="h-auto min-h-11 justify-start gap-2 px-2 py-2 text-start"
          :data-testid="`cc-kirk-${r.id}`"
          @click="
            emit('drill', {
              type: 'kirk',
              filter: r.id,
              label: `Kirkpatrick ${r.id.toUpperCase()}`,
            })
          "
        >
          <span class="w-7 shrink-0 text-label text-primary-t">{{ r.id.toUpperCase() }}</span>
          <UProgress class="min-w-6 flex-1" :model-value="r.width" :max="100" aria-hidden="true" />
          <span class="tabular shrink-0 text-end text-body text-toned" data-testid="cc-kirk-text">{{
            r.text
          }}</span>
        </UButton>
      </li>
    </ul>
  </BoardPanel>
</template>
