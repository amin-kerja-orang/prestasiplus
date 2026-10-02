<script setup lang="ts">
/**
 * Standalone dark frame of S4-S7 (FN-M17-5.1.1, 5.2.1, 5.3.1, 5.4.1): the header "PrestasiPlus Command
 * Center" with the back link, the breadcrumb ("Command Center" is a link to the S2 board of the same
 * scope), then the page body. No shell, no sidebar (shells.md `bare`). Dark palette of live S2-S7.
 */
import { RouterLink } from 'vue-router'

export interface CcCrumb {
  label: string
  /** No `to` = the current page (or a level the viewer cannot open). */
  to?: string | undefined
}

defineProps<{ backTo: string; backLabel: string; crumbs: CcCrumb[] }>()
</script>

<template>
  <div class="min-h-dvh min-w-0 bg-slate-900 text-slate-200" data-testid="cc-page">
    <header
      class="flex items-center justify-between gap-3 border-b border-indigo-500/60 bg-gradient-to-r from-indigo-950 to-indigo-900 px-4 py-4 md:px-6"
    >
      <h1
        class="min-w-0 bg-gradient-to-r from-indigo-300 to-violet-400 bg-clip-text font-heading text-xl font-extrabold tracking-widest text-transparent uppercase md:text-2xl"
        data-testid="cc-title"
      >
        PrestasiPlus Command Center
      </h1>
      <RouterLink
        :to="backTo"
        class="inline-flex min-h-11 shrink-0 items-center rounded-lg border border-slate-600/70 bg-slate-800/70 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-700"
        data-testid="cc-back"
      >
        {{ backLabel }}
      </RouterLink>
    </header>

    <div class="min-w-0 space-y-4 px-4 py-4 md:px-6">
      <nav class="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" data-testid="cc-breadcrumb">
        <template v-for="(crumb, i) in crumbs" :key="i">
          <span v-if="i > 0" class="text-xs text-slate-500" aria-hidden="true">&#9656;</span>
          <RouterLink
            v-if="crumb.to"
            :to="crumb.to"
            class="inline-flex min-h-11 items-center rounded text-indigo-400 hover:text-indigo-300"
            data-testid="cc-crumb"
            >{{ crumb.label }}</RouterLink
          >
          <span v-else class="font-semibold text-slate-50" data-testid="cc-crumb-current">{{
            crumb.label
          }}</span>
        </template>
      </nav>
      <slot />
    </div>
  </div>
</template>
