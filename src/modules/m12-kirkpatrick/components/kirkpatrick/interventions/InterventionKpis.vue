<script setup lang="ts">
/** The four KPI cards of S7 (FN-M12-8.1.1; FR-M12-70; BR-M12-26) in a `DsStatRow`. */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { InterventionList } from '../../../api/types'
import { plain } from '../common/kirkpatrick-format'

const props = defineProps<{ kpi: InterventionList['kpi'] }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Intervensi',
    value: plain(props.kpi.total),
    icon: 'i-ph-hand-heart', accent: 'action',
  },
  {
    key: 'pending',
    label: 'Menunggu Semakan',
    value: plain(props.kpi.pending),
    icon: 'i-ph-hourglass', accent: 'heat',
  },
  { key: 'up', label: 'Meningkat', value: plain(props.kpi.up), icon: 'i-ph-trend-up', accent: 'win' },
  { key: 'down', label: 'Menurun', value: plain(props.kpi.down), icon: 'i-ph-trend-down', accent: 'trial' },
])
</script>

<template>
  <DsStatRow :items="items" prefix="int-kpi" :cols="4" density="roomy" data-testid="int-kpis" />
</template>
