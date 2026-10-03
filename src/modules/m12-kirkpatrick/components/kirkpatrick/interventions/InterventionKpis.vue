<script setup lang="ts">
/** The four KPI cards of S7 (FN-M12-8.1.1; FR-M12-70; BR-M12-26): 2 x 2 below `md`, 4 from `md`. */
import type { InterventionList } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { plain, STAT_TONE } from '../common/kirkpatrick-format'

defineProps<{ kpi: InterventionList['kpi'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="int-kpis">
    <KirkpatrickStatCard
      label="Jumlah Intervensi"
      :value="plain(kpi.total)"
      :tone="STAT_TONE.blue"
    />
    <KirkpatrickStatCard
      label="Menunggu Semakan"
      :value="plain(kpi.pending)"
      :tone="STAT_TONE.amber"
    />
    <KirkpatrickStatCard label="Meningkat" :value="plain(kpi.up)" :tone="STAT_TONE.green" />
    <KirkpatrickStatCard label="Menurun" :value="plain(kpi.down)" :tone="STAT_TONE.rose" />
  </div>
</template>
