<script setup lang="ts">
/**
 * Staff frame for the Command Center pages that no shell wraps (the admin and Admin Sekolah routes are
 * `bare`): puts the staff personality and the light / dark mode on the page (`useThemeMode`, so dialogs
 * teleported to the body inherit the tokens), a brand bar with the theme switch, and the page column.
 * Inside the staff shell (the Guru mount) the pages do not use it.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { DsIcon } from '@/ds'
import { useThemeMode } from '@/theme/color-mode'

const theme = useThemeMode('staff')
const label = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)
</script>

<template>
  <UApp>
    <div class="min-h-dvh min-w-0 bg-muted font-body text-default" data-layout="staff-bare">
      <header
        class="sticky top-0 z-20 flex min-h-16 items-center gap-2 bg-default px-4 shadow-bar sm:px-6"
        data-testid="cc-brand-bar"
      >
        <RouterLink to="/" class="font-display text-subheading font-extrabold text-highlighted"
          >Prestasi<span class="text-primary-t">Plus</span></RouterLink
        >
        <UButton
          class="ms-auto"
          color="neutral"
          variant="soft"
          :aria-label="label"
          data-testid="cc-theme-toggle"
          @click="theme.toggle()"
        >
          <DsIcon :name="theme.scheme.value === 'dark' ? 'sun' : 'moon'" class="size-5" />
        </UButton>
      </header>
      <main class="mx-auto w-full min-w-0 px-4 py-4 sm:px-6 sm:py-6" data-testid="cc-main">
        <slot />
      </main>
    </div>
  </UApp>
</template>
