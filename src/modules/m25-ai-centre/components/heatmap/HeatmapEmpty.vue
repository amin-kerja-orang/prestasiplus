<script setup lang="ts">
/** Empty state (FR-M25-20; SERVER template, D24): shown when the viewer has no shown cell. */
import { Flame } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { EMPTY_HREF, HEATMAP_COPY } from './heatmap-copy'
</script>

<template>
  <section
    class="rounded-[10px] border border-slate-200 bg-white p-12 text-center text-slate-500"
    data-testid="heatmap-empty"
  >
    <Flame class="mx-auto size-10 text-red-300" aria-hidden="true" />
    <p class="mt-3 font-semibold text-slate-600">{{ HEATMAP_COPY.emptyTitle }}</p>
    <p class="mt-1 text-[0.85rem]">{{ HEATMAP_COPY.emptyHint }}</p>
    <RouterLink
      :to="EMPTY_HREF"
      class="mt-4 inline-flex min-h-11 items-center rounded-lg bg-red-600 px-5 py-2 text-[0.85rem] font-semibold text-white"
      data-testid="heatmap-empty-button"
    >
      {{ HEATMAP_COPY.emptyButton }}
    </RouterLink>
  </section>
</template>
