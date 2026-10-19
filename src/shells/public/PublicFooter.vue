<script setup lang="ts">
/**
 * Guest footer (live `footer`, FN-M09-2.2.6; same on `/artikel` and `/video`): logo, copyright
 * line, links "Utama" → `/`, "Artikel" → `/artikel`, "Video" → `/video`, "Log Masuk" → `/login`,
 * "Daftar" → `/register`.
 *
 * Copy, order and hrefs are OBSERVED (inventory S15-215…221, S17-215…221). The class list is
 * INFERRED (no guest markup or screenshot captured).
 */
import { LOGO_URL } from '@/shells/shared/brand'
import ShellLink from '@/shells/shared/ShellLink.vue'

import { PUBLIC_COPYRIGHT, PUBLIC_FOOTER_LINKS } from './public-sections'
</script>

<template>
  <footer class="border-t border-indigo-100 bg-white" data-testid="public-layout-footer">
    <div
      class="mx-auto flex max-w-7xl flex-col items-center gap-4 px-3 py-8 text-center sm:px-6 lg:flex-row lg:justify-between lg:text-left"
    >
      <div class="flex flex-col items-center gap-2 lg:items-start">
        <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-8 w-auto" />
        <p class="text-sm text-slate-500">{{ PUBLIC_COPYRIGHT }}</p>
      </div>
      <div class="flex flex-wrap items-center justify-center gap-x-1 gap-y-1">
        <ShellLink
          v-for="link in PUBLIC_FOOTER_LINKS"
          :key="link.label"
          :to="link.to"
          class="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition hover:bg-indigo-50 hover:text-indigo-600"
        >
          {{ link.label }}
        </ShellLink>
      </div>
    </div>
  </footer>
</template>
