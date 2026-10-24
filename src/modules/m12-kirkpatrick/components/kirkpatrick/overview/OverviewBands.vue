<script setup lang="ts">
/**
 * S1 "Taburan Penglibatan Pelajar" (FN-M12-2.6.1; FR-M12-30): five band links (to the T3 page; plain boxes on
 * the alias), `grid-cols-5` at every width, each an icon chip, count (no separator), label and "%" of
 * T4/T5.
 */
import { DsIconChip, DsPanel } from '@/ds'

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
  <DsPanel title="Taburan Penglibatan Pelajar" icon="i-ph-chart-pie" data-testid="kirk-bands">
    <div class="grid grid-cols-5 gap-1 sm:gap-3">
      <KirkpatrickLink
        v-for="b in ordered()"
        :key="b.key"
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
    </div>
  </DsPanel>
</template>
