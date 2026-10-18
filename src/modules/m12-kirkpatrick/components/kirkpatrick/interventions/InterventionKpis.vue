<script setup lang="ts">
/** The four KPI cards of S7 (FN-M12-8.1.1; FR-M12-70; BR-M12-26): 2 x 2 below `md`, 4 from `md`. */
import type { InterventionList } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { plain } from '../common/kirkpatrick-format'

defineProps<{ kpi: InterventionList['kpi'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="int-kpis">
    <KirkpatrickStatCard
      label="Jumlah Intervensi"
      icon="i-ph-hand-heart"
      accent="action"
      :value="plain(kpi.total)"
    />
    <KirkpatrickStatCard
      label="Menunggu Semakan"
      icon="i-ph-hourglass"
      accent="heat"
      :value="plain(kpi.pending)"
    />
    <KirkpatrickStatCard
      label="Meningkat"
      icon="i-ph-trend-up"
      accent="win"
      :value="plain(kpi.up)"
    />
    <KirkpatrickStatCard
      label="Menurun"
      icon="i-ph-trend-down"
      accent="heat"
      :value="plain(kpi.down)"
    />
  </div>
</template>
