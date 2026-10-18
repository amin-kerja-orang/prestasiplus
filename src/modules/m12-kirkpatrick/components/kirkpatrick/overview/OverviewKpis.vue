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
  type KirkpatrickPaths,
} from '../common'

const props = defineProps<{ kpi: Overview['kpi']; paths: KirkpatrickPaths; detail: boolean }>()

const learning = () => (props.detail ? props.paths.learning : null)
</script>

<template>
  <div class="grid grid-cols-2 gap-4 md:gap-6 lg:grid-cols-4" data-testid="kirk-kpis">
    <KirkpatrickLink :to="paths.monitoring" class="block min-w-0" data-testid="kirk-kpi-registered">
      <KirkpatrickStatCard
        label="Pelajar Berdaftar (T4/T5)"
        icon="i-ph-graduation-cap"
        accent="friend"
        :value="count(kpi.t4t5)"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="learning()" class="block min-w-0" data-testid="kirk-kpi-answers">
      <KirkpatrickStatCard
        label="Soalan Dijawab"
        icon="i-ph-pencil-simple"
        accent="trial"
        :value="count(kpi.answers)"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="paths.monitoring" class="block min-w-0" data-testid="kirk-kpi-teachers">
      <KirkpatrickStatCard
        label="Guru Aktif"
        icon="i-ph-chalkboard-teacher"
        accent="win"
        :value="plain(kpi.teachersLoggedIn)"
        :suffix="`/${plain(kpi.teachers)}`"
      />
    </KirkpatrickLink>
    <KirkpatrickLink :to="learning()" class="block min-w-0" data-testid="kirk-kpi-accuracy">
      <KirkpatrickStatCard
        label="Ketepatan Keseluruhan"
        icon="i-ph-target"
        accent="action"
        :value="pct(kpi.accuracy)"
      />
    </KirkpatrickLink>
  </div>
</template>
