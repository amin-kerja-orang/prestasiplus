<script setup lang="ts">
/** S21 four tiles (design section 5.1 item 2): Jumlah Intervensi, Kadar Berkesan, Perlu Tindakan, Belum Dinilai. */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'

import type { AmaranEffectivenessReportView } from '../../api/amaran'
import { count } from './kb-format'

const props = defineProps<{ cards: AmaranEffectivenessReportView['cards'] }>()

const items = computed<StatItem[]>(() => {
  const c = props.cards
  return [
    { key: 'total', label: 'Jumlah Intervensi', value: count(c.total), icon: 'clipboard-text', accent: 'action' },
    {
      key: 'rate',
      label: 'Kadar Berkesan',
      value: `${String(c.rate)}%`,
      sub: `${count(c.berkesan)}/${count(c.evaluated)} dinilai`,
      icon: 'check-circle',
      tone: 'success',
    },
    {
      key: 'action',
      label: 'Perlu Tindakan',
      value: count(c.needsAction),
      sub: `${count(c.sederhana)} sederhana, ${count(c.tidakBerkesan)} tidak berkesan`,
      icon: 'warning',
      tone: 'warning',
    },
    { key: 'pending', label: 'Belum Dinilai', value: count(c.notEvaluated), icon: 'hourglass', accent: 'action' },
  ]
})
</script>

<template>
  <DsStatRow :items="items" prefix="kb-tile" part-prefix="kb-tile" data-testid="kb-tiles" :cols="4" />
</template>
