<script setup lang="ts">
/**
 * "📊 Engagement" (FR-M17-32, FN-M17-3.3.9). Platform view: the five horizontal bars Champion / Konsisten /
 * Berkembang / Minimum / Disengaged, width n / max. School view (FR-M17-111, OQ-M17-12): the school's own
 * answers of the last 7 days as bars scaled to the maximum with a 4 % minimum, labelled by weekday.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import {
  ccDailyTrendHeights,
  ccEngagementWidths,
  type CcEngagementBuckets,
  type CcLiveData,
} from '../../api/command-center-board'
import { S2_COPY } from './board-copy'

const props = defineProps<{ data: CcLiveData | null; school: boolean }>()

const BANDS: readonly { key: keyof CcEngagementBuckets; label: string; bar: string }[] = [
  { key: 'champion', label: 'Champion', bar: 'bg-emerald-500' },
  { key: 'consistent', label: 'Konsisten', bar: 'bg-cyan-500' },
  { key: 'developing', label: 'Berkembang', bar: 'bg-amber-500' },
  { key: 'minimum', label: 'Minimum', bar: 'bg-orange-400' },
  { key: 'disengaged', label: 'Disengaged', bar: 'bg-rose-500' },
]

const widths = computed(() => (props.data ? ccEngagementWidths(props.data) : null))
const heights = computed(() => (props.data ? ccDailyTrendHeights(props.data) : []))
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-700 bg-slate-800 p-4 xl:shrink-0 xl:p-3"
    data-testid="cc-panel-engagement"
  >
    <h2
      class="mb-3 flex items-center gap-2 text-xs font-bold tracking-widest text-slate-400 uppercase xl:mb-2"
    >
      <span class="text-base">📊</span>
      <span data-testid="board-panel-title">Engagement</span>
    </h2>
    <p v-if="!data" class="text-sm text-slate-400">{{ S2_COPY.loading }}</p>

    <ul v-else-if="!school" class="space-y-1" data-testid="cc-engagement-bands">
      <li
        v-for="b in BANDS"
        :key="b.key"
        class="flex min-h-4 items-center gap-3"
        :data-testid="`cc-band-${b.key}`"
      >
        <span class="w-20 shrink-0 text-sm leading-none text-slate-300 sm:w-24">{{ b.label }}</span>
        <span class="h-4 flex-1 overflow-hidden rounded-full bg-slate-900/70">
          <span
            :class="[
              'flex h-full min-w-8 items-center justify-end rounded-full px-2 font-mono text-xs leading-none font-bold text-white',
              b.bar,
            ]"
            :style="{ width: `${String(widths?.[b.key] ?? 0)}%` }"
            data-testid="cc-band-bar"
            >{{ formatCount(data.engagement[b.key]) }}</span
          >
        </span>
      </li>
    </ul>

    <ol v-else class="grid grid-cols-7 items-end gap-2" data-testid="cc-engagement-days">
      <li
        v-for="(p, i) in data.dailyTrend"
        :key="p.date"
        class="flex min-w-0 flex-col items-center gap-1"
        data-testid="cc-day"
      >
        <span class="font-mono text-xs text-slate-300" data-testid="cc-day-count">{{
          formatCount(p.count)
        }}</span>
        <span class="flex h-24 w-full items-end overflow-hidden rounded bg-slate-900/70">
          <span
            class="block w-full rounded bg-emerald-500"
            :style="{ height: `${String(heights[i] ?? 4)}%` }"
            data-testid="cc-day-bar"
          />
        </span>
        <span class="text-xs text-slate-400" data-testid="cc-day-label">{{ p.label }}</span>
      </li>
    </ol>
  </section>
</template>
