<script setup lang="ts">
/**
 * One S28 row (`.lb-row`; FR-M16-128, URS FN-M16-10.1.3): the rank (🥇 🥈 🥉 then "#4"...), the school
 * name and state, "{x.x}%" + "aktif", "🔥 {x.x}" + "hari", "{x.x}" + "per 10". The top three are
 * gold / silver / bronze (soft gradients, live capture); "Streak Avg" and "Nota/Pelajar" are hidden
 * below 768 px (as live).
 */
import { computed } from 'vue'

import type { SekolahBersaingResult } from '../../api'
import { SB_COPY, SB_MEDALS } from './copy'
import { SB_GRID } from './grid'

type Row = SekolahBersaingResult['rows'][number]

const props = defineProps<{ row: Row }>()

const tier = computed(() => (props.row.rank >= 1 && props.row.rank <= 3 ? props.row.rank : 0))
const rankText = computed(() =>
  tier.value > 0 ? (SB_MEDALS[tier.value - 1] ?? '') : `#${String(props.row.rank)}`,
)
const tierClass = computed(() => {
  switch (tier.value) {
    case 1:
      return 'gold bg-linear-to-r from-amber-50 to-white'
    case 2:
      return 'silver bg-linear-to-r from-slate-100 to-white'
    case 3:
      return 'bronze bg-linear-to-r from-orange-100 to-white'
    default:
      return 'bg-white'
  }
})
</script>

<template>
  <div
    class="lb-row grid items-center gap-2 px-3 py-3.5 sm:px-4"
    :class="[SB_GRID, tierClass]"
    :data-rank="row.rank"
    data-testid="sb-row"
  >
    <div
      class="font-bold"
      :class="tier > 0 ? 'text-xl' : 'text-xl text-amber-800'"
      data-testid="sb-rank"
    >
      {{ rankText }}
    </div>
    <div class="min-w-0">
      <div class="truncate text-base leading-6 font-bold text-slate-900" data-testid="sb-school">
        {{ row.anonymous ? SB_COPY.anonymous : row.schoolName }}
      </div>
      <div v-if="!row.anonymous" class="truncate text-xs text-slate-600" data-testid="sb-state">
        {{ row.state }}
      </div>
    </div>
    <div class="text-right" data-testid="sb-aktif">
      <div class="text-base leading-6 font-bold text-slate-900">{{ row.aktifPct.toFixed(1) }}%</div>
      <div class="text-xs text-slate-500 uppercase">{{ SB_COPY.aktif }}</div>
    </div>
    <div class="hidden text-right md:block" data-testid="sb-streak">
      <div class="text-base leading-6 font-bold text-slate-900">
        🔥 {{ row.streakAvg.toFixed(1) }}
      </div>
      <div class="text-xs text-slate-500 uppercase">{{ SB_COPY.hari }}</div>
    </div>
    <div class="hidden text-right md:block" data-testid="sb-nota">
      <div class="text-base leading-6 font-bold text-slate-900">{{ row.notaPer10.toFixed(1) }}</div>
      <div class="text-xs text-slate-500 uppercase">{{ SB_COPY.per10 }}</div>
    </div>
  </div>
</template>
