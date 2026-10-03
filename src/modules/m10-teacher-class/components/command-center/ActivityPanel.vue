<script setup lang="ts">
/** "📈 Aktiviti Hari Ini" (FN-M10-2.2.5): "{n} soalan" bar (drill today / aktiviti), week count and change. */
import { computed } from 'vue'

import type { CcLiveData } from '../../api/command-center-types'
import BoardPanel from './BoardPanel.vue'
import { activityWidth, type DrillRequest, weekChangeText } from './copy'

const props = defineProps<{ d: CcLiveData }>()
const emit = defineEmits<{ drill: [req: DrillRequest] }>()

const width = computed(
  () => `${String(activityWidth(props.d.answeredTodayRaw, props.d.answeredWeekRaw))}%`,
)
const change = computed(() => weekChangeText(props.d.weekChange))
</script>

<template>
  <BoardPanel icon="📈" title="Aktiviti Hari Ini" testid="cc-panel-activity">
    <div
      class="cursor-pointer"
      data-testid="cc-activity-bar"
      @click="emit('drill', { type: 'today', filter: 'aktiviti', label: 'Aktiviti Hari Ini' })"
    >
      <div class="h-8 overflow-hidden rounded-lg bg-slate-900/70">
        <div
          class="flex h-full min-w-8 items-center rounded-lg bg-indigo-500 px-2 text-sm font-bold whitespace-nowrap text-white"
          :style="{ width }"
          data-testid="cc-activity-today"
        >
          {{ d.answeredToday }} soalan
        </div>
      </div>
    </div>
    <div class="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
      <span class="text-slate-300"
        >Minggu ini:
        <b class="text-slate-50" data-testid="cc-activity-week">{{ d.answeredWeek }}</b></span
      >
      <span :class="change.tone" data-testid="cc-week-change">{{ change.text }}</span>
    </div>
  </BoardPanel>
</template>
