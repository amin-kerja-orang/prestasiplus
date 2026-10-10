<script setup lang="ts">
/**
 * S3 range pills (FR-M27-66): "Tempoh:" then "7 Hari", "30 Hari", "3 Bulan", each a link to `?range=`. The
 * active one is highlighted. Touch targets are at least 44 px high.
 */
import { CalendarDays } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { ACTIVITY_PATH, RANGES, type ActivityRange } from './activity-format'

defineProps<{ active: ActivityRange }>()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap items-center gap-2" data-testid="la-pills">
    <span class="flex items-center gap-1.5 text-sm font-semibold text-slate-600">
      <CalendarDays class="h-4 w-4" aria-hidden="true" />Tempoh:
    </span>
    <RouterLink
      v-for="r in RANGES"
      :key="r.range"
      :to="{ path: ACTIVITY_PATH, query: { range: String(r.range) } }"
      :class="[
        'inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors',
        r.range === active
          ? 'border-indigo-600 bg-indigo-600 text-white'
          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
      ]"
      :data-testid="`la-pill-${String(r.range)}`"
      :data-active="r.range === active ? 'true' : 'false'"
      >{{ r.label }}</RouterLink
    >
  </nav>
</template>
