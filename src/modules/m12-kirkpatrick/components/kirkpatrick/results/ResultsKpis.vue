<script setup lang="ts">
/**
 * The six KPI cards of S5 (FN-M12-6.1.1 / 6.1.2; BR-M12-16/18; DV-M12-09/16/28). A school with an SPM row that stores
 * no grade counts (8880, D9 choice) shows "-" for Kadar Lulus and Pelajar Gred A with the candidates as caption, so
 * no "0/0 calon" sits next to a real GPS.
 */
import { computed } from 'vue'

import type { Results } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { count, gps, pct, plain } from '../common/kirkpatrick-format'

const props = defineProps<{ kpi: Results['kpi'] }>()

const gpsCaption = computed(() =>
  props.kpi.gpsYear === null
    ? `${plain(props.kpi.recordsLabel)} rekod`
    : `${plain(props.kpi.recordsLabel)} rekod · ${plain(props.kpi.gpsYear)}`,
)
const passCaption = computed(() =>
  props.kpi.pass === null
    ? `${plain(props.kpi.candidates)} calon`
    : `${plain(props.kpi.pass)}/${plain(props.kpi.candidates)} calon`,
)
const gradeACaption = computed(() =>
  props.kpi.gradeA === null
    ? `${plain(props.kpi.candidates)} calon`
    : `${pct(props.kpi.gradeAPct ?? 0)} daripada ${plain(props.kpi.candidates)}`,
)
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6" data-testid="res-kpis">
    <KirkpatrickStatCard
      label="GPS Headcount"
      :value="kpi.gps === null ? '-' : gps(kpi.gps)"
      :caption="gpsCaption"
    />
    <KirkpatrickStatCard
      label="Kadar Lulus"
      :value="kpi.passPct === null ? '-' : pct(kpi.passPct)"
      :caption="passCaption"
    />
    <KirkpatrickStatCard
      label="Pelajar Gred A"
      :value="kpi.gradeA === null ? '-' : plain(kpi.gradeA)"
      :caption="gradeACaption"
    />
    <KirkpatrickStatCard
      label="Ketepatan Platform"
      :value="pct(kpi.accuracy)"
      :caption="`${count(kpi.answers)} soalan`"
    />
    <KirkpatrickStatCard
      label="Pelajar Aktif"
      :value="plain(kpi.active)"
      :caption="`${pct(kpi.activePct)} daripada ${count(kpi.t4t5)}`"
    />
    <KirkpatrickStatCard label="Rekod Headcount" :value="plain(kpi.records)" caption="Data OTR" />
  </div>
</template>
