<script setup lang="ts">
/**
 * S1 period pills (FR-M27-51): "Hari Ini", "7 Hari", "30 Hari". Every pill is a link to `?period=`; the
 * active one is highlighted. Touch targets are at least 44 px high.
 */
import { RouterLink } from 'vue-router'

import type { UsagePeriod } from '../../api/school-admin'
import { PERIODS, USAGE_PATH } from './usage-format'

defineProps<{ active: UsagePeriod }>()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap gap-2" data-testid="su-pills">
    <RouterLink
      v-for="p in PERIODS"
      :key="p.period"
      :to="{ path: USAGE_PATH, query: { period: p.period } }"
      :class="[
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
        p.period === active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ]"
      :data-testid="`su-pill-${p.period}`"
      :data-active="p.period === active ? 'true' : 'false'"
      >{{ p.label }}</RouterLink
    >
  </nav>
</template>
