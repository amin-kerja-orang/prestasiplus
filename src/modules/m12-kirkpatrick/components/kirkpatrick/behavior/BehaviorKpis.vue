<script setup lang="ts">
/** The six KPI cards of S4 (FN-M12-5.2.1; BR-M12-02/03/05/07). */
import type { Behavior } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { count, pct, plain, STAT_TONE } from '../common/kirkpatrick-format'

defineProps<{ kpi: Behavior['kpi'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="beh-kpis">
    <KirkpatrickStatCard label="Pelajar T4/T5" :value="count(kpi.t4t5)" :tone="STAT_TONE.blue" />
    <KirkpatrickStatCard label="Pernah Aktif" :value="plain(kpi.active)" :tone="STAT_TONE.green" />
    <KirkpatrickStatCard
      label="Jumlah Sesi"
      :value="plain(kpi.sessions)"
      :tone="STAT_TONE.purple"
    />
    <KirkpatrickStatCard
      label="Soalan Dijawab"
      :value="count(kpi.answers)"
      :tone="STAT_TONE.amber"
    />
    <KirkpatrickStatCard label="Ketepatan" :value="pct(kpi.accuracy)" :tone="STAT_TONE.rose" />
    <KirkpatrickStatCard
      label="Guru Aktif"
      :value="pct(kpi.teacherPct)"
      :caption="`${plain(kpi.teachersLoggedIn)}/${plain(kpi.teachers)}`"
      :tone="STAT_TONE.cyan"
    />
  </div>
</template>
