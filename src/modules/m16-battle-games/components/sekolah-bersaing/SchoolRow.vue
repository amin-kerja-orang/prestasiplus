<script setup lang="ts">
/**
 * One S28 row (`.lb-row`; FR-M16-128, URS FN-M16-10.1.3): the rank (🥇 🥈 🥉 then "#4"...), the school
 * name and state, "{x.x}%" + "aktif", "🔥 {x.x}" + "hari", "{x.x}" + "per 10". The top three are
 * gold / silver / bronze; "Streak Avg" and "Nota/Pelajar" are hidden below 768 px (as live).
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
      return 'gold border-amber-400 bg-amber-50'
    case 2:
      return 'silver border-slate-400 bg-slate-100'
    case 3:
      return 'bronze border-orange-400 bg-orange-50'
    default:
      return 'border-transparent bg-white'
  }
})
</script>

<template>
  <div
    class="lb-row grid items-center gap-2 border-l-4 px-2 py-2 sm:px-3"
    :class="[SB_GRID, tierClass]"
    :data-rank="row.rank"
    data-testid="sb-row"
  >
    <div class="text-center text-sm font-bold text-slate-700" data-testid="sb-rank">
      {{ rankText }}
    </div>
    <div class="min-w-0">
      <div class="truncate text-sm font-semibold text-slate-800" data-testid="sb-school">
        {{ row.anonymous ? SB_COPY.anonymous : row.schoolName }}
      </div>
      <div v-if="!row.anonymous" class="truncate text-xs text-slate-600" data-testid="sb-state">
        {{ row.state }}
      </div>
    </div>
    <div class="text-center" data-testid="sb-aktif">
      <div class="text-sm font-bold text-slate-800">{{ row.aktifPct.toFixed(1) }}%</div>
      <div class="text-xs text-slate-600">{{ SB_COPY.aktif }}</div>
    </div>
    <div class="hidden text-center md:block" data-testid="sb-streak">
      <div class="text-sm font-bold text-slate-800">🔥 {{ row.streakAvg.toFixed(1) }}</div>
      <div class="text-xs text-slate-600">{{ SB_COPY.hari }}</div>
    </div>
    <div class="hidden text-center md:block" data-testid="sb-nota">
      <div class="text-sm font-bold text-slate-800">{{ row.notaPer10.toFixed(1) }}</div>
      <div class="text-xs text-slate-600">{{ SB_COPY.per10 }}</div>
    </div>
  </div>
</template>
