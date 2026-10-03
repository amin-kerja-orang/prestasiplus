<script setup lang="ts">
/**
 * S1 KPI row (FN-M12-2.5.1; FR-M12-29): four links, `grid-cols-2 lg:grid-cols-4`. The monitoring links
 * follow the mount (`/admin/monitoring`, `/guru/monitoring`, `/admin-sekolah/monitoring`); the learning
 * links are plain boxes on the alias (`detail` off).
 */
import type { Overview } from '../../../api/types'
import {
  count,
  KirkpatrickLink,
  KirkpatrickStatCard,
  pct,
  plain,
  STAT_TONE,
  type KirkpatrickPaths,
} from '../common'

const props = defineProps<{ kpi: Overview['kpi']; paths: KirkpatrickPaths; detail: boolean }>()

const learning = () => (props.detail ? props.paths.learning : null)
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" data-testid="kirk-kpis">
    <KirkpatrickLink :to="paths.monitoring" class="block min-w-0" data-testid="kirk-kpi-registered">
      <KirkpatrickStatCard
        label="Pelajar Berdaftar (T4/T5)"
        :value="count(kpi.t4t5)"
        :tone="STAT_TONE.blue"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="learning()" class="block min-w-0" data-testid="kirk-kpi-answers">
      <KirkpatrickStatCard
        label="Soalan Dijawab"
        :value="count(kpi.answers)"
        :tone="STAT_TONE.emerald"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="paths.monitoring" class="block min-w-0" data-testid="kirk-kpi-teachers">
      <KirkpatrickStatCard
        label="Guru Aktif"
        :value="plain(kpi.teachersLoggedIn)"
        :suffix="`/${plain(kpi.teachers)}`"
        :tone="STAT_TONE.purple"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="learning()" class="block min-w-0" data-testid="kirk-kpi-accuracy">
      <KirkpatrickStatCard
        label="Ketepatan Keseluruhan"
        :value="pct(kpi.accuracy)"
        :tone="STAT_TONE.amber"
      />
    </KirkpatrickLink>
  </div>
</template>
