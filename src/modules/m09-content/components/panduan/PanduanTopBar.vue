<script setup lang="ts">
/**
 * S26/S27 standalone top bar (URS FN-M09-8.1.1). Logo → `/`, "Laman Utama" → `/`, "Artikel" →
 * `/artikel`, then "Dashboard" → role home for a logged-in user or "Log Masuk" → `/login` +
 * "Daftar Percuma" → `/register` for a guest. Below `lg` the links move into a menu (`mobileOpen`).
 */
import { ref } from 'vue'

import { usePrototypeScope } from '@/composables'
import { DsArt3D } from '@/ds'

defineProps<{ loggedIn: boolean }>()

// Prototype scope (D43): "Artikel" only where the role may open it; "Dashboard" is the role's own.
const { allows, home } = usePrototypeScope()

const mobileOpen = ref(false)
const LOGO_URL = `${import.meta.env.BASE_URL}images/prestasiplus-logo.svg`
</script>

<template>
  <nav class="sticky top-0 z-30 bg-default shadow-card" data-testid="panduan-topbar">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2 sm:px-6">
      <ULink
        to="/"
        class="flex min-h-11 w-32 min-w-0 items-center sm:w-40"
        data-testid="panduan-logo"
      >
        <DsArt3D variant="plain" :src="LOGO_URL" alt="PRESTASIPLUS" />
      </ULink>

      <div class="hidden items-center gap-2 lg:flex" data-testid="panduan-links">
        <UButton to="/" color="neutral" variant="ghost" icon="i-ph-house-duotone"
          >Laman Utama</UButton
        >
        <UButton
          v-if="allows('/artikel')"
          to="/artikel"
          color="neutral"
          variant="ghost"
          icon="i-ph-newspaper-duotone"
          >Artikel</UButton
        >
        <UButton v-if="loggedIn" :to="home" icon="i-ph-squares-four-duotone">Papan Pemuka</UButton>
        <template v-else>
          <UButton to="/login" color="neutral" variant="ghost">Log Masuk</UButton>
          <UButton to="/register" icon="i-ph-rocket-launch-duotone">Daftar Percuma</UButton>
        </template>
      </div>

      <UButton
        color="neutral"
        variant="soft"
        :icon="mobileOpen ? 'i-ph-x' : 'i-ph-list'"
        aria-label="Menu"
        class="lg:hidden"
        data-testid="panduan-menu-toggle"
        @click="mobileOpen = !mobileOpen"
      />
    </div>

    <div
      v-if="mobileOpen"
      class="flex flex-col gap-1 px-4 pt-2 pb-4 lg:hidden"
      data-testid="panduan-mobile-menu"
    >
      <UButton
        to="/"
        color="neutral"
        variant="ghost"
        icon="i-ph-house-duotone"
        block
        class="justify-start"
        >Laman Utama</UButton
      >
      <UButton
        v-if="allows('/artikel')"
        to="/artikel"
        color="neutral"
        variant="ghost"
        icon="i-ph-newspaper-duotone"
        block
        class="justify-start"
        >Artikel</UButton
      >
      <UButton v-if="loggedIn" :to="home" icon="i-ph-squares-four-duotone" block>Papan Pemuka</UButton>
      <template v-else>
        <UButton to="/login" color="neutral" variant="ghost" block class="justify-start"
          >Log Masuk</UButton
        >
        <UButton to="/register" icon="i-ph-rocket-launch-duotone" block>Daftar Percuma</UButton>
      </template>
    </div>
  </nav>
</template>
