<script setup lang="ts">
/**
 * "📈 Aktiviti Hari Ini" (FR-M17-27, FN-M17-3.3.4, BR-M17-07): the bar "{n} soalan", "Minggu ini: {n}" and the
 * change line by the sign of the week change.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import { ccChangeLine, ccTodayBarPercent, type CcLiveData } from '../../api/command-center-board'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null }>()

const today = computed(() => `${formatCount(props.data?.answeredToday ?? 0)} soalan`)
const percent = computed(() => (props.data ? ccTodayBarPercent(props.data) : 0))
const change = computed(() => (props.data ? ccChangeLine(props.data.weekChange) : null))
const TONE = { down: 'text-rose-400', up: 'text-emerald-400', same: 'text-slate-400' } as const
</script>

<template>
  <BoardPanel icon="📈" title="Aktiviti Hari Ini" testid="cc-panel-today" fixed>
    <div class="rounded-full bg-slate-900/70">
      <div
        class="min-w-24 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 font-mono text-sm font-bold whitespace-nowrap text-white"
        :style="{ width: `${String(percent)}%` }"
        data-testid="cc-today-bar"
      >
        {{ today }}
      </div>
    </div>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <span class="text-slate-400" data-testid="cc-week"
        >Minggu ini:
        <b class="text-slate-50">{{ data ? formatCount(data.answeredWeek) : 0 }}</b></span
      >
      <span v-if="change" :class="TONE[change.tone]" data-testid="cc-change">{{
        change.text
      }}</span>
    </div>
  </BoardPanel>
</template>
