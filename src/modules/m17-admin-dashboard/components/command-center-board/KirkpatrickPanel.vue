<script setup lang="ts">
/**
 * "Kirkpatrick" (FR-M17-25, FN-M17-3.3.2, BR-M17-08): T1 stars + "{v}/5", T2 "{acc}% ketepatan",
 * T3 "{n} aktif 30h", T4 "GPS {gps}" with their bars.
 */
import { computed } from 'vue'

import { DsBadge, DsCluster, DsProgress, DsStack, DsText, formatCount, formatPercent } from '@/ds'
import { formatNumber } from '@/lib/number'

import { ccKirkpatrickBars, ccStars, type CcLiveData } from '../../api/command-center-board'
import { S2_COPY } from './board-copy'
import BoardPanel from './BoardPanel.vue'

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
      text: `${formatPercent(d.kirk.t2Accuracy)} ketepatan`,
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
    <DsStack v-else as="ul" gap="md">
      <li v-for="r in rows" :key="r.id" :data-testid="`cc-kirk-${r.id}`">
        <DsStack gap="xs">
          <DsCluster gap="sm" align="center" justify="between" :wrap="false">
            <DsBadge :label="r.label" tone="primary" size="sm" />
            <DsText variant="label" tone="toned" align="end" data-testid="cc-kirk-text">{{
              r.text
            }}</DsText>
          </DsCluster>
          <DsProgress
            :value="r.width"
            :show-value="false"
            size="sm"
            :aria-label="r.label"
            data-testid="cc-kirk-bar"
          />
        </DsStack>
      </li>
    </DsStack>
  </BoardPanel>
</template>
