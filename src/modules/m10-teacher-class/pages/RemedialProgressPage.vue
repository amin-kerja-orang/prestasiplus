<script setup lang="ts">
/**
 * S3 `/guru/remedial-progress` (FR-M10-18..; URS FT-M10-2.3): "Remedial Progress Dashboard", the four stat
 * cards and the "Senarai Pelajar & Progress" card (empty copy as live; populated rows PROPOSED).
 * Reached from the Command Center "Rekod" link.
 */
import { computed } from 'vue'

import { useApi } from '@/composables'
import {
  DsCluster,
  DsEmptyState,
  DsLoadError,
  DsPage,
  DsPanel,
  DsStack,
  DsStatRow,
  DsTag,
  DsText,
  type StatItem,
} from '@/ds'

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
    <DsText variant="body" tone="muted" data-testid="remedial-progress-subtitle">{{
      COPY.subtitle
    }}</DsText>
    <DsLoadError
      v-if="error"
      :message="COPY.loadFailed"
      :retry-label="COPY.retry"
      testid="remedial-progress-error"
      @retry="reload"
    />
    <DsStack v-else-if="!data" aria-busy="true" data-testid="remedial-progress-loading">
      <DsStatRow :items="stats" prefix="rp-stat" :cols="4" loading />
    </DsStack>
    <template v-else>
      <DsStatRow :items="stats" prefix="rp-stat" :cols="4" data-testid="remedial-progress-stats" />

      <DsPanel :title="COPY.listTitle" data-testid="remedial-progress-list">
        <DsEmptyState
          v-if="data.rows.length === 0"
          size="sm"
          icon="clipboard-text"
          :title="COPY.emptyTitle"
          :description="COPY.emptyBody"
          data-testid="remedial-progress-empty"
        />
        <DsStack v-else as="ul" gap="sm">
          <li v-for="row in data.rows" :key="row.id" data-testid="remedial-progress-row">
            <DsCluster justify="between">
              <DsStack gap="2xs">
                <DsText variant="body" truncate>{{ row.studentName }}</DsText>
                <DsText variant="body" tone="muted">{{ row.subjectName }}</DsText>
              </DsStack>
              <DsCluster>
                <DsTag
                  :label="REMEDIAL_STATUS_LABEL[row.status]"
                  data-testid="remedial-progress-status"
                />
                <DsText
                  variant="body"
                  tone="muted"
                  as="span"
                  data-testid="remedial-progress-accuracy"
                  >{{ pct(row.beforeAccuracy) }} → {{ pct(row.afterAccuracy) }}</DsText
                >
              </DsCluster>
            </DsCluster>
          </li>
        </DsStack>
      </DsPanel>
    </template>
  </DsPage>
</template>
