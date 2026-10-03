<script setup lang="ts">
/**
 * S1 "Taburan Engagement Pelajar" (FN-M12-2.6.1; FR-M12-30): five band links (to the T3 page; plain boxes on
 * the alias), `grid-cols-5` at every width, each a round icon tile, count (no separator), label and "%" of
 * T4/T5.
 */
import { CheckCheck, ChartPie, CircleMinus, CircleX, Crown, Sprout } from '@lucide/vue'
import type { Component } from 'vue'

import type { BandCount, BandKey } from '../../../api/types'
import { BAND, BAND_ORDER, CARD, KirkpatrickLink, pct, plain } from '../common'

const props = defineProps<{ bands: BandCount[]; behaviorPath: string | null }>()

const ICON: Record<BandKey, Component> = {
  champion: Crown,
  konsisten: CheckCheck,
  berkembang: Sprout,
  minimum: CircleMinus,
  tidakTerlibat: CircleX,
}

const ordered = () =>
  BAND_ORDER.map((key) => props.bands.find((b) => b.key === key) ?? { key, count: 0, pct: 0 })
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="kirk-bands">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <ChartPie class="h-5 w-5 text-indigo-600" />Taburan Engagement Pelajar
    </h2>
    <div class="grid grid-cols-5 gap-1 sm:gap-3">
      <KirkpatrickLink
        v-for="b in ordered()"
        :key="b.key"
        :to="behaviorPath"
        class="flex min-w-0 flex-col items-center gap-1 text-center"
        :data-testid="`kirk-band-${b.key}`"
      >
        <span
          :class="[
            'flex h-9 w-9 items-center justify-center rounded-full sm:h-12 sm:w-12',
            BAND[b.key].tile,
            BAND[b.key].text,
          ]"
        >
          <component :is="ICON[b.key]" class="h-4 w-4 sm:h-5 sm:w-5" />
        </span>
        <span
          :class="['font-heading text-base font-bold sm:text-xl', BAND[b.key].text]"
          data-testid="kirk-band-count"
          >{{ plain(b.count) }}</span
        >
        <span
          class="text-[10px] leading-tight [overflow-wrap:anywhere] text-slate-500 sm:text-xs"
          >{{ BAND[b.key].label }}</span
        >
        <span :class="['text-[10px] sm:text-xs', BAND[b.key].text]" data-testid="kirk-band-pct">{{
          pct(b.pct)
        }}</span>
      </KirkpatrickLink>
    </div>
  </section>
</template>
