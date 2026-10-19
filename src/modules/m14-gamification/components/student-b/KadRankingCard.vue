<script setup lang="ts">
/** S18 "Kad Kedudukan" card (FN-M14-6.2.5): accuracy and "{correct}/{answered} betul". */
import { formatNumber } from '@/lib/number'

import type { ShareCards } from '../../api'
import { KAD_COPY, pct1 } from '../../lib/student/kadkongsi-lib'

defineProps<{ data: ShareCards }>()
</script>

<template>
  <div class="rounded-2xl bg-linear-to-br from-blue-800 to-blue-400 p-6 text-center text-white">
    <div class="text-5xl">🏆</div>
    <div class="mt-2 text-xs tracking-widest text-white/90 uppercase">
      {{ KAD_COPY.rankingLabel }}
    </div>
    <div
      class="mt-5 rounded-xl bg-white/15 px-3 py-2 text-xs wrap-anywhere"
      data-testid="kad-ranking-line"
    >
      {{ KAD_COPY.ketepatan }} <strong>{{ pct1(data.ranking.accuracy) }}%</strong> ·
      {{ formatNumber(data.ranking.correct) }}/{{ formatNumber(data.ranking.answered) }} betul
    </div>
    <div class="mt-5 text-base font-bold wrap-anywhere" data-testid="kad-ranking-name">
      {{ data.name }}
    </div>
    <div class="text-xs text-white/80">{{ KAD_COPY.site }}</div>
  </div>
</template>
