<script setup lang="ts">
/**
 * S1 period pills (FR-M27-51; restyle spec AS-46): "Hari Ini", "7 Hari", "30 Hari" as a segmented row. Every
 * item is a link to `?period=`; the active one is the solid kobalt button. Touch targets are at least 44 px.
 */
import { computed } from 'vue'

import { DsPillNav, type PillItem } from '@/ds'

import type { UsagePeriod } from '../../api/school-admin'
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
  <DsPillNav
    :items="items"
    :active="active"
    testid-prefix="su-pill"
    label="Tempoh"
    data-testid="su-pills"
  />
</template>
