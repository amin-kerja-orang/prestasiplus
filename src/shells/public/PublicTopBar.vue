<script setup lang="ts">
/**
 * Guest top bar (live `nav`, FN-M09-2.2.1 / 6.2.1): logo → `/`, "|", section emoji + label (plain
 * text), "Log Masuk" → `/login`, "Daftar Percuma" → `/register`.
 *
 * Copy, order and hrefs are OBSERVED (inventory S15-066…072, S17-062…068; `guest__1280` state,
 * captured at 1280 only). The class list is INFERRED: discovery captured no markup or styles for
 * the guest layout and no guest screenshot. Below `sm` the "|" and the section label are hidden so the logo and both links
 * fit a 320 px screen (INFERRED; the same "hide in the top bar below sm" pattern live uses on the
 * other public page, S28).
 */
import { LOGO_URL } from '@/shells/shared/brand'
import ShellLink from '@/shells/shared/ShellLink.vue'

import { PUBLIC_TOP_LINKS, type PublicSection } from './public-sections'

defineProps<{ section: PublicSection | null }>()
</script>

<template>
  <nav
    class="sticky top-0 z-30 border-b border-indigo-100 bg-white/95 shadow-topbar backdrop-blur-md"
    data-testid="public-layout-topbar"
  >
    <div
      class="mx-auto flex max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3"
    >
      <div class="flex min-w-0 items-center gap-2 sm:gap-3">
        <ShellLink
          to="/"
          class="flex min-h-11 min-w-0 items-center"
          data-testid="public-layout-logo"
        >
          <img
            :src="LOGO_URL"
            alt="PRESTASIPLUS"
            class="h-7 w-auto max-w-full object-contain sm:h-10"
          />
        </ShellLink>
        <template v-if="section">
          <span class="hidden text-slate-300 sm:inline">|</span>
          <span
            class="hidden items-center gap-1.5 font-heading text-lg font-bold text-slate-700 sm:inline-flex"
            data-testid="public-layout-section"
          >
            <span>{{ section.emoji }}</span>
            <span>{{ section.label }}</span>
          </span>
        </template>
      </div>

      <div class="flex flex-shrink-0 items-center gap-1.5 sm:gap-3">
        <ShellLink
          :to="PUBLIC_TOP_LINKS.login.to"
          class="inline-flex min-h-11 items-center rounded-xl px-2.5 text-xs font-semibold whitespace-nowrap text-indigo-600 transition hover:bg-indigo-50 sm:px-4 sm:text-sm"
          data-testid="public-layout-login"
        >
          {{ PUBLIC_TOP_LINKS.login.label }}
        </ShellLink>
        <ShellLink
          :to="PUBLIC_TOP_LINKS.register.to"
          class="inline-flex min-h-11 items-center rounded-xl px-3 text-xs font-bold whitespace-nowrap text-white shadow-md transition bg-cta-gradient hover:-translate-y-0.5 hover:shadow-lg sm:px-5 sm:text-sm"
          data-testid="public-layout-register"
        >
          {{ PUBLIC_TOP_LINKS.register.label }}
        </ShellLink>
      </div>
    </div>
  </nav>
</template>
