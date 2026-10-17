<script setup lang="ts">
/** The four KPI cards of S7 (FN-M12-8.1.1; FR-M12-70; BR-M12-26): 2 x 2 below `md`, 4 from `md`. */
import type { InterventionList } from '../../../api/types'
import KirkpatrickStatCard from '../common/KirkpatrickStatCard.vue'
import { plain } from '../common/kirkpatrick-format'

defineProps<{ kpi: InterventionList['kpi'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="int-kpis">
    <KirkpatrickStatCard label="Jumlah Intervensi" :value="plain(kpi.total)" />
    <KirkpatrickStatCard label="Menunggu Semakan" :value="plain(kpi.pending)" />
    <KirkpatrickStatCard label="Meningkat" :value="plain(kpi.up)" />
    <KirkpatrickStatCard label="Menurun" :value="plain(kpi.down)" />
  </div>
</template>
