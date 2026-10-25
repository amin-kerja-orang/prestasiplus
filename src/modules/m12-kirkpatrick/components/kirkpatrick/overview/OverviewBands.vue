<script setup lang="ts">
/**
 * S1 "Taburan Engagement Pelajar" (FN-M12-2.6.1; FR-M12-30): five band links (to the T3 page; plain boxes on
 * the alias), a `DsGrid` of 2 columns below `sm` (the last tile spans both) and 5 from `sm` (was `grid-cols-5` at every
 * width; DV-M12-33: 5 across at 320 / 375 overlapped the labels), each an icon chip, count (no separator), label and
 * "%" of T4/T5.
 */
import { DsGrid, DsGridItem, DsIconChip, DsPanel } from '@/ds'

import type { BandCount, BandKey } from '../../../api/types'
import { BAND, BAND_ORDER, KirkpatrickLink, pct, plain } from '../common'

const props = defineProps<{ bands: BandCount[]; behaviorPath: string | null }>()

const ICON: Record<BandKey, string> = {
  champion: 'i-ph-crown',
  konsisten: 'i-ph-checks',
  berkembang: 'i-ph-plant',
  minimum: 'i-ph-minus-circle',
  tidakTerlibat: 'i-ph-x-circle',
}

const ordered = () =>
  BAND_ORDER.map((key) => props.bands.find((b) => b.key === key) ?? { key, count: 0, pct: 0 })
</script>

<template>
  <DsPanel title="Taburan Engagement Pelajar" icon="i-ph-chart-pie" data-testid="kirk-bands">
    <DsGrid :cols="{ base: 2, sm: 5 }" gap="sm">
      <DsGridItem
        v-for="(b, i) in ordered()"
        :key="b.key"
        :span="i === BAND_ORDER.length - 1 ? { base: 2, sm: 1 } : undefined"
      >
        <KirkpatrickLink
          :to="behaviorPath"
          class="flex min-w-0 flex-col items-center gap-1 text-center"
          :data-testid="`kirk-band-${b.key}`"
        >
          <DsIconChip :icon="ICON[b.key]" size="sm" />
          <span
            :class="['tabular text-subheading', BAND[b.key].text]"
            data-testid="kirk-band-count"
            >{{ plain(b.count) }}</span
          >
          <span class="text-body break-words text-muted">{{ BAND[b.key].label }}</span>
          <span :class="['tabular text-body', BAND[b.key].text]" data-testid="kirk-band-pct">{{
            pct(b.pct)
          }}</span>
        </KirkpatrickLink>
      </DsGridItem>
    </DsGrid>
  </DsPanel>
</template>
