<script setup lang="ts">
/**
 * S3 six KPI cards (FN-M12-4.1.1; FR-M12-34): `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`. "Learning Gain"
 * is "-" permanently (there are no pre/post tests).
 */
import type { Learning } from '../../../api/types'
import { count, KirkpatrickStatCard, pct, plain } from '../common'

defineProps<{ kpi: Learning['kpi'] }>()
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6"
    data-testid="kirk-learning-kpis"
  >
    <KirkpatrickStatCard
      label="Soalan Dijawab"
      icon="i-ph-pencil-simple"
      accent="trial"
      :value="count(kpi.answers)"
      data-testid="kirk-kpi-answers"
    />
    <KirkpatrickStatCard
      label="Ketepatan"
      icon="i-ph-target"
      accent="action"
      :value="pct(kpi.accuracy)"
      data-testid="kirk-kpi-accuracy"
    />
    <KirkpatrickStatCard
      label="Skor Purata"
      icon="i-ph-chart-line-up"
      accent="trial"
      :value="pct(kpi.avgScore)"
      data-testid="kirk-kpi-score"
    />
    <KirkpatrickStatCard
      label="Sesi Selesai"
      icon="i-ph-flag-checkered"
      accent="win"
      :value="plain(kpi.sessionsCompleted)"
      :suffix="`/${plain(kpi.sessions)}`"
      data-testid="kirk-kpi-sessions"
    />
    <KirkpatrickStatCard
      label="Kadar Penyelesaian"
      icon="i-ph-percent"
      accent="heat"
      :value="pct(kpi.completionPct)"
      data-testid="kirk-kpi-completion"
    />
    <KirkpatrickStatCard
      label="Learning Gain"
      icon="i-ph-brain"
      accent="action"
      value="-"
      caption="Perlu pre/post test"
      muted
      data-testid="kirk-kpi-gain"
    />
  </div>
</template>
