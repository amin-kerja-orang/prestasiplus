<script setup lang="ts">
/** "Kembali ke Kurikulum" back link (FR-M03-25, 28, 32, 36). */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
    data-testid="curriculum-back"
  >
    <ArrowLeft class="h-4 w-4" />
    Kembali ke Kurikulum
  </RouterLink>
</template>
