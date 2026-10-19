<script setup lang="ts">
/**
 * S4 four tiles (FR-M27-75; restyle spec AS-49): Jumlah Pelajar, On Track, Perlu Perhatian, Berisiko Tinggi.
 * The three risk counts carry their meaning colour (success, warning, error) and an icon; colour never
 * stands alone, the label says the same.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { RiskTallyView } from '../../api/amaran'
import { DsStatRow, type StatItem } from '@/ds'

const props = defineProps<{ tally: RiskTallyView }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Pelajar',
    value: formatCount(props.tally.total),
    icon: 'users-three',
    accent: 'action',
  },
  {
    key: 'green',
    label: 'On Track',
    value: formatCount(props.tally.green),
    icon: 'check-circle',
    tone: 'success',
  },
  {
    key: 'yellow',
    label: 'Perlu Perhatian',
    value: formatCount(props.tally.yellow),
    icon: 'warning',
    tone: 'warning',
  },
  {
    key: 'red',
    label: 'Berisiko Tinggi',
    value: formatCount(props.tally.red),
    icon: 'warning-octagon',
    tone: 'error',
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="am-tile" part-prefix="am-tile" data-testid="am-tiles" :cols="4" />
</template>
