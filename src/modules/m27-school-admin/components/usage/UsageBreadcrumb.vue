<script setup lang="ts">
/**
 * S1 breadcrumb (FR-M27-44, DV-M27-22): "← Dashboard Sekolah" (link to `/admin-sekolah`), a separator and the
 * screen title in bold as a non-link.
 */
import { RouterLink } from 'vue-router'

import { DASHBOARD_PATH } from './usage-format'

defineProps<{ title: string }>()
</script>

<template>
  <nav class="flex min-w-0 flex-wrap items-center gap-x-2 text-sm" data-testid="su-breadcrumb">
    <RouterLink
      :to="DASHBOARD_PATH"
      class="inline-flex min-h-11 items-center text-slate-500 hover:text-slate-700"
      data-testid="su-crumb-back"
      >← Dashboard Sekolah</RouterLink
    >
    <span class="text-slate-300">/</span>
    <span class="font-bold text-slate-700" data-testid="su-crumb-current">{{ title }}</span>
  </nav>
</template>
