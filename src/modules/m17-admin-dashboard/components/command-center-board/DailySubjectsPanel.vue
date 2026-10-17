<script setup lang="ts">
/** "Subjek" of S3 (FR-M17-43, FN-M17-4.4.1): one bar per subject of the period's answers; "-" when none. */
import { computed } from 'vue'

import { DsChart } from '@/ds'

import type { CcDailyActivity } from '../../api/command-center-board'
import { S3_COPY } from './board-copy'
import type { LoadStatus } from './composables'
import DailyPanel from './DailyPanel.vue'

const props = defineProps<{ data: CcDailyActivity | null; status: LoadStatus }>()

const rows = computed(() => props.data?.subjectBreakdown ?? [])
const labels = computed(() => rows.value.map((r) => r.shortName))
const series = computed(() => [{ label: 'Jawapan', data: rows.value.map((r) => r.answers) }])
</script>

<template>
  <DailyPanel title="Subjek" icon="i-ph-books" testid="cc-panel-subjects" :state="status">
    <p v-if="rows.length === 0" class="text-center text-body text-muted" data-testid="cc-empty">
      {{ S3_COPY.empty }}
    </p>
    <div v-else data-testid="cc-subjects-chart">
      <DsChart
        title="Jawapan mengikut subjek"
        :level="3"
        horizontal
        :labels="labels"
        :series="series"
        table-label="Jawapan mengikut subjek"
      />
    </div>
  </DailyPanel>
</template>
