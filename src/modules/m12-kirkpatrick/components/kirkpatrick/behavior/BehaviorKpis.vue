<script setup lang="ts">
/** The six KPI cards of S4 (FN-M12-5.2.1; BR-M12-02/03/05/07). */
import type { Behavior } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { count, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ kpi: Behavior['kpi'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="beh-kpis">
    <KirkpatrickStatCard
      label="Pelajar T4/T5"
      icon="i-ph-graduation-cap"
      accent="friend"
      :value="count(kpi.t4t5)"
    />
    <KirkpatrickStatCard
      label="Pernah Aktif"
      icon="i-ph-check-circle"
      accent="win"
      :value="plain(kpi.active)"
    />
    <KirkpatrickStatCard
      label="Jumlah Sesi"
      icon="i-ph-timer"
      accent="heat"
      :value="plain(kpi.sessions)"
    />
    <KirkpatrickStatCard
      label="Soalan Dijawab"
      icon="i-ph-pencil-simple"
      accent="trial"
      :value="count(kpi.answers)"
    />
    <KirkpatrickStatCard
      label="Ketepatan"
      icon="i-ph-target"
      accent="action"
      :value="pct(kpi.accuracy)"
    />
    <KirkpatrickStatCard
      label="Guru Aktif"
      icon="i-ph-chalkboard-teacher"
      accent="win"
      :value="pct(kpi.teacherPct)"
      :caption="`${plain(kpi.teachersLoggedIn)}/${plain(kpi.teachers)}`"
    />
  </div>
</template>
