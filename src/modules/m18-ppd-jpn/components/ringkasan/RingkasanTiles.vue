<script setup lang="ts">
/**
 * S23 four tiles (design 4.1 item 2): Jumlah Pelajar, On Track (Hijau), Perlu Perhatian, Berisiko Tinggi.
 * The risk tiles show the server's integer percent and the pupil count; icon and word, never colour alone.
 */
import { computed } from 'vue'

import { DsStatRow, type StatItem } from '@/ds'
import { formatCount } from '@/lib/number'

import type { AmaranTally } from '../../api/amaran'

const props = defineProps<{ tally: AmaranTally }>()

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
    label: 'On Track (Hijau)',
    value: `${String(props.tally.pct.green)}%`,
    sub: `${formatCount(props.tally.green)} pelajar`,
    icon: 'check-circle',
    tone: 'success',
  },
  {
    key: 'yellow',
    label: 'Perlu Perhatian',
    value: `${String(props.tally.pct.yellow)}%`,
    sub: `${formatCount(props.tally.yellow)} pelajar`,
    icon: 'warning',
    tone: 'warning',
  },
  {
    key: 'red',
    label: 'Berisiko Tinggi',
    value: `${String(props.tally.pct.red)}%`,
    sub: `${formatCount(props.tally.red)} pelajar`,
    icon: 'warning-octagon',
    tone: 'error',
  },
])
</script>

<template>
  <DsStatRow :items="items" prefix="rk-tile" data-testid="rk-tiles" :cols="4" />
</template>
