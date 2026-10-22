<script setup lang="ts">
/**
 * S3 `/guru/remedial-progress` (FR-M10-18..; URS FT-M10-2.3): "Remedial Progress Dashboard", the four stat
 * cards and the "Senarai Pelajar & Progress" card (empty copy as live; populated rows PROPOSED).
 * Reached from the Command Center "Rekod" link.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import { DsLoadError, DsPage, DsPanel, DsStatRow, type StatItem } from '@/ds'

import { fetchRemedialProgress } from '../api/guru'
import {
  REMEDIAL_PROGRESS_COPY as COPY,
  REMEDIAL_STATUS_LABEL,
} from '../components/remedial-progress/copy'

const { data, error, reload } = useApi((signal) => fetchRemedialProgress({ signal }))

const stats = computed<StatItem[]>(() => {
  const s = data.value?.stats
  const gain = s?.avgImprovement ?? 0
  return [
    { key: 'total', label: 'JUMLAH SET', value: s?.total ?? 0, icon: 'flask', accent: 'action' },
    {
      key: 'completed',
      label: 'SELESAI',
      value: s?.completed ?? 0,
      icon: 'check-circle',
      accent: 'win',
    },
    { key: 'students', label: 'PELAJAR', value: s?.students ?? 0, icon: 'users', accent: 'trial' },
    {
      key: 'improvement',
      label: 'PURATA PENINGKATAN',
      value: `${gain < 0 ? '' : '+'}${String(gain)}%`,
      icon: 'trend-up',
      accent: 'heat',
    },
  ]
})

const pct = (n: number | null): string => (n === null ? '-' : `${String(n)}%`)
</script>

<template>
  <DsPage :title="COPY.title" data-testid="remedial-progress-page">
    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="remedial-progress-error"
      @retry="reload"
    />
    <div
      v-else-if="!data"
      class="grid grid-cols-2 gap-3 md:grid-cols-4"
      aria-busy="true"
      data-testid="remedial-progress-loading"
    >
      <USkeleton v-for="n in 4" :key="n" class="h-28 w-full" />
    </div>
    <template v-else>
      <DsStatRow :items="stats" prefix="rp-stat" :cols="4" data-testid="remedial-progress-stats" />

      <DsPanel data-testid="remedial-progress-list">
        <h2 class="text-subheading text-highlighted">{{ COPY.listTitle }}</h2>
        <div
          v-if="data.rows.length === 0"
          class="flex flex-col items-center gap-1 py-6 text-center"
          data-testid="remedial-progress-empty"
        >
          <UIcon name="i-ph-clipboard-text-duotone" class="size-12 text-dimmed" />
          <p class="text-body text-highlighted">{{ COPY.emptyTitle }}</p>
          <p class="text-body text-muted">{{ COPY.emptyBody }}</p>
        </div>
        <ul v-else class="mt-3 flex min-w-0 flex-col gap-2">
          <li
            v-for="row in data.rows"
            :key="row.id"
            class="flex min-w-0 flex-wrap items-center justify-between gap-2 py-2"
            data-testid="remedial-progress-row"
          >
            <div class="min-w-0">
              <p class="truncate text-body text-highlighted">{{ row.studentName }}</p>
              <p class="text-body text-muted">{{ row.subjectName }}</p>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <UBadge color="neutral" variant="subtle" data-testid="remedial-progress-status">{{
                REMEDIAL_STATUS_LABEL[row.status]
              }}</UBadge>
              <span class="text-body text-muted" data-testid="remedial-progress-accuracy"
                >{{ pct(row.beforeAccuracy) }} → {{ pct(row.afterAccuracy) }}</span
              >
            </div>
          </li>
        </ul>
      </DsPanel>
    </template>
  </DsPage>
</template>
