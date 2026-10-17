<script setup lang="ts">
/**
 * S1 period pills (FR-M27-51; restyle spec AS-46): "Hari Ini", "7 Hari", "30 Hari" as a segmented row. Every
 * item is a link to `?period=`; the active one is the solid kobalt button. Touch targets are at least 44 px.
 */
import { computed } from 'vue'

import type { UsagePeriod } from '../../api/school-admin'
import PillNav, { type PillItem } from '../shared/PillNav.vue'
import { PERIODS, USAGE_PATH } from './usage-format'

defineProps<{ active: UsagePeriod }>()

const items = computed<PillItem<UsagePeriod>[]>(() =>
  PERIODS.map((p) => ({
    key: p.period,
    label: p.label,
    to: { path: USAGE_PATH, query: { period: p.period } },
  })),
)
</script>

<template>
  <PillNav :items="items" :active="active" nav-id="su-pills" prefix="su-pill" label="Tempoh" />
</template>
