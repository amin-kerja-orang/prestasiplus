<script setup lang="ts">
/**
 * "Aktiviti Hari Ini" (FR-M17-27, FN-M17-3.3.4, BR-M17-07): the bar "{n} soalan", "Minggu ini: {n}" and the
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
const TONE = { down: 'text-error', up: 'text-success', same: 'text-muted' } as const
</script>

<template>
  <BoardPanel icon="i-ph-chart-line-up" title="Aktiviti Hari Ini" testid="cc-panel-today">
    <div class="flex flex-1 flex-col justify-center gap-2">
      <span class="tabular text-heading text-highlighted" data-testid="cc-today-bar">{{
        today
      }}</span>
      <UProgress :model-value="percent" :max="100" aria-hidden="true" />
    </div>
    <div class="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-body">
      <span class="text-muted" data-testid="cc-week"
        >Minggu ini:
        <b class="text-highlighted">{{ data ? formatCount(data.answeredWeek) : 0 }}</b></span
      >
      <span v-if="change" :class="TONE[change.tone]" data-testid="cc-change">{{
        change.text
      }}</span>
    </div>
  </BoardPanel>
</template>
