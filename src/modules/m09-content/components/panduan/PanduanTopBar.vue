<script setup lang="ts">
/**
 * S26/S27 standalone top bar (URS FN-M09-8.1.1; live `nav` with Alpine `{ mobileOpen: false }`).
 * Logo → `/`, "Laman Utama" → `/`, "Artikel" → `/artikel`, then "Dashboard" → `/dashboard` for a
 * logged-in user or "Log Masuk" → `/login` + "Daftar Percuma" → `/register` for a guest. Below `lg`
 * the links move into a `fa-bars` menu (`mobileOpen`).
 */
import { LayoutGrid, Menu, Newspaper, House, Rocket, X } from '@lucide/vue'
import { ref } from 'vue'

import { usePrototypeScope } from '@/composables'
import { LOGO_URL } from '@/shells/shared/brand'
import ShellLink from '@/shells/shared/ShellLink.vue'

defineProps<{ loggedIn: boolean }>()

// Prototype scope (D43): "Artikel" only where the role may open it; "Dashboard" is the role's own.
const { allows, home } = usePrototypeScope()

const mobileOpen = ref(false)

const plain =
  'flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-slate-700 transition hover:bg-indigo-50 hover:text-indigo-600'
const cta =
  'flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-bold text-white shadow-lg transition bg-cta-gradient hover:-translate-y-0.5'
</script>

<template>
  <nav class="sticky top-0 z-30 border-b-4 border-slate-900 bg-white" data-testid="panduan-topbar">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <ShellLink to="/" class="flex min-h-11 min-w-0 items-center" data-testid="panduan-logo">
        <img
          :src="LOGO_URL"
          alt="PRESTASIPLUS"
          class="h-8 w-auto max-w-full object-contain sm:h-10"
        />
      </ShellLink>

      <div class="hidden items-center gap-2 lg:flex" data-testid="panduan-links">
        <ShellLink to="/" :class="plain"
          ><House class="h-4 w-4" aria-hidden="true" />Laman Utama</ShellLink
        >
        <ShellLink v-if="allows('/artikel')" to="/artikel" :class="plain">
          <Newspaper class="h-4 w-4" aria-hidden="true" />Artikel
        </ShellLink>
        <ShellLink v-if="loggedIn" :to="home" :class="cta">
          <LayoutGrid class="h-4 w-4" aria-hidden="true" />Dashboard
        </ShellLink>
        <template v-else>
          <ShellLink to="/login" :class="plain">Log Masuk</ShellLink>
          <ShellLink to="/register" :class="cta">
            <Rocket class="h-4 w-4" aria-hidden="true" />Daftar Percuma
          </ShellLink>
        </template>
      </div>

      <button
        type="button"
        class="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 lg:hidden"
        data-testid="panduan-menu-toggle"
        @click="mobileOpen = !mobileOpen"
      >
        <X v-if="mobileOpen" class="h-5 w-5" aria-hidden="true" />
        <Menu v-else class="h-5 w-5" aria-hidden="true" />
      </button>
    </div>

    <div
      v-if="mobileOpen"
      class="flex flex-col gap-1 border-t border-indigo-100 px-4 pt-2 pb-4 lg:hidden"
      data-testid="panduan-mobile-menu"
    >
      <ShellLink to="/" :class="plain"
        ><House class="h-4 w-4" aria-hidden="true" />Laman Utama</ShellLink
      >
      <ShellLink v-if="allows('/artikel')" to="/artikel" :class="plain">
        <Newspaper class="h-4 w-4" aria-hidden="true" />Artikel
      </ShellLink>
      <ShellLink v-if="loggedIn" :to="home" :class="cta">
        <LayoutGrid class="h-4 w-4" aria-hidden="true" />Dashboard
      </ShellLink>
      <template v-else>
        <ShellLink to="/login" :class="plain">Log Masuk</ShellLink>
        <ShellLink to="/register" :class="cta">
          <Rocket class="h-4 w-4" aria-hidden="true" />Daftar Percuma
        </ShellLink>
      </template>
    </div>
  </nav>
</template>
