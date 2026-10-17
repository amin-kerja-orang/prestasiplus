<script setup lang="ts">
/**
 * Staff frame for the Command Center pages that no shell wraps (the admin and Admin Sekolah routes are
 * `bare`): puts the staff personality and the light / dark mode on the page (`useThemeMode`, so dialogs
 * teleported to the body inherit the tokens), a brand bar with the theme switch, and the page column.
 * Inside the staff shell (the Guru mount) the pages do not use it.
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { isPrototypeScopeOn } from '@/app/prototype-scope'
import { adminShellFor } from '@/app/router/layouts'
import { useSession } from '@/composables/useSession'
import { DsIcon } from '@/ds'
import { useThemeMode } from '@/theme/color-mode'

const theme = useThemeMode('staff')
// Admin Pusat sees these boards inside the Portal Pentadbiran (D30), which already gives the brand
// bar, theme switch and page column, so the frame only renders its content there.
// The portal exists only with the prototype scope on, so the session store is not read otherwise.
const inPortal = isPrototypeScopeOn() && adminShellFor(useSession().role.value) === 'pentadbiran'
const label = computed(() =>
  theme.scheme.value === 'dark' ? 'Tukar ke tema cerah' : 'Tukar ke tema gelap',
)
</script>

<template>
  <div v-if="inPortal" class="min-w-0" data-testid="cc-main">
    <slot />
  </div>
  <UApp v-else>
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
