<script setup lang="ts">
/**
 * S3 six KPI cards (FN-M12-4.1.1; FR-M12-34): `grid-cols-2 sm:grid-cols-3 lg:grid-cols-6`. "Learning Gain"
 * is "-" permanently (there are no pre/post tests).
 */
import type { Learning } from '../../../api/types'
import { count, KirkpatrickStatCard, pct, plain, STAT_TONE } from '../common'

defineProps<{ kpi: Learning['kpi'] }>()
</script>

<template>
  <div
    class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6"
    data-testid="kirk-learning-kpis"
  >
    <KirkpatrickStatCard
      label="Soalan Dijawab"
      :value="count(kpi.answers)"
      :tone="STAT_TONE.blue"
      data-testid="kirk-kpi-answers"
    />
    <KirkpatrickStatCard
      label="Ketepatan"
      :value="pct(kpi.accuracy)"
      :tone="STAT_TONE.green"
      data-testid="kirk-kpi-accuracy"
    />
    <KirkpatrickStatCard
      label="Skor Purata"
      :value="pct(kpi.avgScore)"
      :tone="STAT_TONE.purple"
      data-testid="kirk-kpi-score"
    />
    <KirkpatrickStatCard
      label="Sesi Selesai"
      :value="plain(kpi.sessionsCompleted)"
      :suffix="`/${plain(kpi.sessions)}`"
      :tone="STAT_TONE.amber"
      data-testid="kirk-kpi-sessions"
    />
    <KirkpatrickStatCard
      label="Kadar Penyelesaian"
      :value="pct(kpi.completionPct)"
      :tone="STAT_TONE.rose"
      data-testid="kirk-kpi-completion"
    />
    <KirkpatrickStatCard
      label="Learning Gain"
      value="-"
      caption="Perlu pre/post test"
      :tone="{ ...STAT_TONE.cyan, value: 'text-slate-400' }"
      data-testid="kirk-kpi-gain"
    />
  </div>
</template>
