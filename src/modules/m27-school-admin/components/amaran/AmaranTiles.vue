<script setup lang="ts">
/**
 * S4 four tiles (FR-M27-75; restyle spec AS-49): Jumlah Pelajar, On Track, Perlu Perhatian, Berisiko Tinggi.
 * The three risk counts carry their meaning colour (success, warning, error) and an icon; colour never
 * stands alone, the label says the same.
 */
import { computed } from 'vue'

import { formatCount } from '@/lib/number'

import type { RiskTallyView } from '../../api/amaran'
import StatRow, { type StatItem } from '../shared/StatRow.vue'

const props = defineProps<{ tally: RiskTallyView }>()

const items = computed<StatItem[]>(() => [
  {
    key: 'total',
    label: 'Jumlah Pelajar',
    value: formatCount(props.tally.total),
    icon: 'i-ph-users-three',
  },
  {
    key: 'green',
    label: 'On Track',
    value: formatCount(props.tally.green),
    icon: 'i-ph-check-circle',
    tone: 'success',
  },
  {
    key: 'yellow',
    label: 'Perlu Perhatian',
    value: formatCount(props.tally.yellow),
    icon: 'i-ph-warning',
    tone: 'warning',
  },
  {
    key: 'red',
    label: 'Berisiko Tinggi',
    value: formatCount(props.tally.red),
    icon: 'i-ph-warning-octagon',
    tone: 'error',
  },
])
</script>

<template>
  <StatRow :items="items" prefix="am-tile" nav-id="am-tiles" />
</template>
