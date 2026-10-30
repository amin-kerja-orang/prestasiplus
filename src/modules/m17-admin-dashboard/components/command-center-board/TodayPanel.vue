<script setup lang="ts">
/**
 * "Aktiviti Hari Ini" (FR-M17-27, FN-M17-3.3.4, BR-M17-07): the bar "{n} soalan", "Minggu ini: {n}" and the
 * change line by the sign of the week change.
 */
import { computed } from 'vue'

import { DsProgress, DsStack, DsText, formatCount } from '@/ds'

import { ccChangeLine, ccTodayBarPercent, type CcLiveData } from '../../api/command-center-board'
import BoardPanel from './BoardPanel.vue'

const props = defineProps<{ data: CcLiveData | null }>()

const today = computed(() => `${formatCount(props.data?.answeredToday ?? 0)} soalan`)
const percent = computed(() => (props.data ? ccTodayBarPercent(props.data) : 0))
const change = computed(() => (props.data ? ccChangeLine(props.data.weekChange) : null))
const TONE = { down: 'error', up: 'success', same: 'muted' } as const
</script>

<template>
  <BoardPanel icon="i-ph-chart-line-up" title="Aktiviti Hari Ini" testid="cc-panel-today">
    <DsStack gap="sm">
      <DsText variant="kpi" data-testid="cc-today-bar">{{ today }}</DsText>
      <DsProgress :value="percent" :show-value="false" aria-label="Aktiviti hari ini" />
      <DsText variant="body" tone="muted" data-testid="cc-week"
        >Minggu ini:
        <b class="text-highlighted">{{ data ? formatCount(data.answeredWeek) : 0 }}</b></DsText
      >
      <DsText v-if="change" variant="body" :tone="TONE[change.tone]" data-testid="cc-change">{{
        change.text
      }}</DsText>
    </DsStack>
  </BoardPanel>
</template>
