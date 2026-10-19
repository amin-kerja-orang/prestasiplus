<script setup lang="ts">
/** "Aktiviti Hari Ini" (FN-M10-2.2.5): "{n} soalan" bar (drill today / aktiviti), week count and change. */
import { computed } from 'vue'

import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { activityWidth, type DrillRequest, weekChangeText } from './copy'
import { DsText } from '@/ds'

const props = defineProps<{ d: CcLiveData }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const width = computed(() => activityWidth(props.d.answeredTodayRaw, props.d.answeredWeekRaw))
const change = computed(() => weekChangeText(props.d.weekChange))
</script>

<template>
  <BoardPanel
    icon="chart-line-up"
    accent="win"
    title="Aktiviti Hari Ini"
    testid="cc-panel-activity"
  >
    <UButton
      color="neutral"
      variant="ghost"
      block
      class="h-auto flex-col items-stretch gap-2 p-2"
      data-testid="cc-activity-bar"
      @click="emit('drill', { type: 'today', filter: 'aktiviti', label: 'Aktiviti Hari Ini' })"
    >
      <DsText variant="heading" as="span" tabular data-testid="cc-activity-today"
        >{{ d.answeredToday }} soalan</DsText
      >
      <UProgress :model-value="width" :max="100" aria-hidden="true" />
    </UButton>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-body">
      <span class="text-toned"
        >Minggu ini:
        <b class="text-highlighted" data-testid="cc-activity-week">{{ d.answeredWeek }}</b></span
      >
      <span :class="change.tone" data-testid="cc-week-change">{{ change.text }}</span>
    </div>
  </BoardPanel>
</template>
