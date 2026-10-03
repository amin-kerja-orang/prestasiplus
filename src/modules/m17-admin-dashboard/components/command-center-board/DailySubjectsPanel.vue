<script setup lang="ts">
/** "Subjek" of S3 (FR-M17-43, FN-M17-4.4.1): one bar per subject of the period's answers; "-" when none. */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { CcDailyActivity } from '../../api/command-center-board'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()

const bars = computed(() => {
  const rows = props.data?.subjectBreakdown ?? []
  const max = Math.max(1, ...rows.map((r) => r.answers))
  return rows.map((r) => ({ ...r, width: (r.answers / max) * 100 }))
})
</script>

<template>
  <DailyPanel title="Subjek" dot="bg-indigo-500" testid="cc-panel-subjects" :state="status">
    <p v-if="bars.length === 0" class="text-center text-sm text-slate-400" data-testid="cc-empty">
      {{ S3_COPY.empty }}
    </p>
    <ul v-else class="space-y-1.5">
      <li
        v-for="b in bars"
        :key="b.code"
        class="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 text-sm"
        data-testid="cc-subject"
      >
        <span class="truncate text-slate-300" data-testid="cc-subject-name">{{ b.shortName }}</span>
        <span class="h-3 overflow-hidden rounded-full bg-slate-800">
          <span
            class="block h-full rounded-full bg-indigo-500"
            :style="{ width: `${String(b.width)}%` }"
          />
        </span>
        <span class="font-mono text-slate-100" data-testid="cc-subject-count">{{
          formatCount(b.answers)
        }}</span>
      </li>
    </ul>
  </DailyPanel>
</template>
