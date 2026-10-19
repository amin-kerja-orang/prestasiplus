<script setup lang="ts">
/**
 * "Kirkpatrick" (FR-M17-25, FN-M17-3.3.2, BR-M17-08): T1 stars + "{v}/5", T2 "{acc}% ketepatan",
 * T3 "{n} aktif 30h", T4 "GPS {gps}" with their bars.
 */
import { computed } from 'vue'

import { formatCount, formatNumber } from '@/lib/number'

import { ccKirkpatrickBars, ccStars, type CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'
import { DsStack, DsText } from '@/ds'

const props = defineProps<{ data: CcLiveData | null }>()

const rows = computed(() => {
  const d = props.data
  if (!d) return []
  const bars = ccKirkpatrickBars(d)
  return [
    {
      id: 't1',
      label: 'T1',
      width: bars.t1 * 100,
      text: `${ccStars(d.kirk.t1.value)} ${formatNumber(d.kirk.t1.value, { decimals: 1 })}/${String(d.kirk.t1.scale)}`,
    },
    {
      id: 't2',
      label: 'T2',
      width: bars.t2 * 100,
      text: `${formatNumber(d.kirk.t2Accuracy, { decimals: 1 })}% ketepatan`,
    },
    {
      id: 't3',
      label: 'T3',
      width: bars.t3 * 100,
      text: `${formatCount(d.kirk.t3Active)} aktif 30h`,
    },
    {
      id: 't4',
      label: 'T4',
      width: bars.t4 * 100,
      text: `GPS ${formatNumber(d.kirk.t4Gps, { decimals: 3, grouping: false })}`,
    },
  ]
})
</script>

<template>
  <BoardPanel icon="i-ph-flask" title="Kirkpatrick" testid="cc-panel-kirkpatrick">
    <DsText v-if="!data" variant="body" tone="muted">{{ S2_COPY.loading }}</DsText>
    <DsStack v-else as="ul" gap="sm">
      <li
        v-for="r in rows"
        :key="r.id"
        class="flex flex-wrap items-center gap-x-3 gap-y-1"
        :data-testid="`cc-kirk-${r.id}`"
      >
        <DsText variant="label" tone="primary" class="w-8 shrink-0">{{ r.label }}</DsText>
        <UProgress
          class="min-w-24 flex-1"
          :model-value="r.width"
          :max="100"
          aria-hidden="true"
          data-testid="cc-kirk-bar"
        />
        <DsText
          variant="body"
          as="span"
          tone="toned"
          align="end"
          tabular
          class="shrink-0"
          data-testid="cc-kirk-text"
          >{{ r.text }}</DsText
        >
      </li>
    </DsStack>
  </BoardPanel>
</template>
