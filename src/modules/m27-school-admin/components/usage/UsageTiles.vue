<script setup lang="ts">
/**
 * S1 seven tiles in order (FR-M27-52): Pelajar, Guru, Pelajar Aktif ("daripada {Pelajar}"), Penglibatan
 * ("daripada pelajar daftar"), Sesi Latihan, Soalan Dijawab, Purata Ketepatan. Not links. 2 per row at 375,
 * 4 + 3 per row from 768.
 */
import { computed } from 'vue'

import type { SchoolUsage } from '../../api/school-admin'
import { accuracy, count, wholePercent } from './usage-format'

const props = defineProps<{ tiles: SchoolUsage['tiles'] }>()

interface Tile {
  key: string
  label: string
  value: string
  sub?: string
  box: string
  labelClass: string
  valueClass: string
}

const tiles = computed<Tile[]>(() => {
  const t = props.tiles
  return [
    {
      key: 'pupils',
      label: 'Pelajar',
      value: count(t.pupils),
      box: 'border-blue-200 bg-blue-50',
      labelClass: 'text-blue-600',
      valueClass: 'text-blue-900',
    },
    {
      key: 'teachers',
      label: 'Guru',
      value: count(t.teachers),
      box: 'border-teal-200 bg-teal-50',
      labelClass: 'text-teal-600',
      valueClass: 'text-teal-900',
    },
    {
      key: 'active',
      label: 'Pelajar Aktif',
      value: count(t.activePupils),
      sub: `daripada ${count(t.pupils)}`,
      box: 'border-emerald-200 bg-emerald-50',
      labelClass: 'text-emerald-600',
      valueClass: 'text-emerald-900',
    },
    {
      key: 'participation',
      label: 'Penglibatan',
      value: wholePercent(t.participationPct),
      sub: 'daripada pelajar daftar',
      box: 'border-violet-200 bg-violet-50',
      labelClass: 'text-violet-600',
      valueClass: 'text-violet-900',
    },
    {
      key: 'sessions',
      label: 'Sesi Latihan',
      value: count(t.sessions),
      box: 'border-amber-200 bg-amber-50',
      labelClass: 'text-amber-700',
      valueClass: 'text-amber-900',
    },
    {
      key: 'answers',
      label: 'Soalan Dijawab',
      value: count(t.answers),
      box: 'border-rose-200 bg-rose-50',
      labelClass: 'text-rose-600',
      valueClass: 'text-rose-900',
    },
    {
      key: 'accuracy',
      label: 'Purata Ketepatan',
      value: accuracy(t.accuracy),
      box: 'border-sky-200 bg-sky-50',
      labelClass: 'text-sky-600',
      valueClass: 'text-sky-900',
    },
  ]
})
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="su-tiles">
    <div
      v-for="tile in tiles"
      :key="tile.key"
      :class="['min-w-0 rounded-2xl border p-3 shadow-sm sm:p-5', tile.box]"
      :data-testid="`su-tile-${tile.key}`"
    >
      <p
        :class="['text-xs font-bold tracking-wide break-words uppercase', tile.labelClass]"
        data-testid="su-tile-label"
      >
        {{ tile.label }}
      </p>
      <p
        :class="['mt-1 text-2xl font-bold break-words sm:text-3xl', tile.valueClass]"
        data-testid="su-tile-value"
      >
        {{ tile.value }}
      </p>
      <p v-if="tile.sub" class="mt-1 text-xs text-slate-500" data-testid="su-tile-sub">
        {{ tile.sub }}
      </p>
    </div>
  </div>
</template>
