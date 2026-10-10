<script setup lang="ts">
/**
 * S4 four tiles (FR-M27-75): "Jumlah Pelajar", "On Track", "Perlu Perhatian", "Berisiko Tinggi", all from the
 * M18 tally (equal to the S0 AMARAN AWAL panel). Not links. 2 per row below md, 4 from md.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { RiskTallyView } from '../../api/amaran'

const props = defineProps<{ tally: RiskTallyView }>()

const tiles = computed(() => [
  {
    key: 'total',
    label: 'Jumlah Pelajar',
    value: props.tally.total,
    box: 'border-blue-200 bg-blue-50',
    labelClass: 'text-blue-600',
    valueClass: 'text-blue-900',
  },
  {
    key: 'green',
    label: 'On Track',
    value: props.tally.green,
    box: 'border-emerald-200 bg-emerald-50',
    labelClass: 'text-emerald-600',
    valueClass: 'text-emerald-900',
  },
  {
    key: 'yellow',
    label: 'Perlu Perhatian',
    value: props.tally.yellow,
    box: 'border-amber-200 bg-amber-50',
    labelClass: 'text-amber-700',
    valueClass: 'text-amber-900',
  },
  {
    key: 'red',
    label: 'Berisiko Tinggi',
    value: props.tally.red,
    box: 'border-red-200 bg-red-50',
    labelClass: 'text-red-600',
    valueClass: 'text-red-900',
  },
])
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="am-tiles">
    <div
      v-for="t in tiles"
      :key="t.key"
      :class="['min-w-0 rounded-2xl border p-3 shadow-sm sm:p-5', t.box]"
      :data-testid="`am-tile-${t.key}`"
    >
      <p
        :class="['text-xs font-bold tracking-wide break-words uppercase', t.labelClass]"
        data-testid="am-tile-label"
      >
        {{ t.label }}
      </p>
      <p
        :class="['mt-1 text-2xl font-bold break-words sm:text-3xl', t.valueClass]"
        data-testid="am-tile-value"
      >
        {{ formatCount(t.value) }}
      </p>
    </div>
  </div>
</template>
