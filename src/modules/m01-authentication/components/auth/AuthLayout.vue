<script setup lang="ts">
/**
 * Standalone auth layout of S1/S2 (FR-M01-01, FR-M01-02/15, v2 shells §6). Rendered by the page
 * (route `layout: 'bare'`), so no shell wraps it. Learner "Elektrik" look for every role:
 * - from `xl` a split screen: the `welcome` slot on the gradient A1 brand panel (rocket art),
 *   the form on `bg-muted`; below `xl` a slim gradient strip and a single raised card;
 * - the card column holds the logo + tagline + default slot, an optional `below` slot (the S1
 *   stats strip) and the footer line.
 */
import { DsArt3D } from '@/ds'
import { LOGO_URL } from '@/shells/shared/brand'
import { useThemeMode } from '@/theme/color-mode'

import AuthFooter from './AuthFooter.vue'

defineProps<{
  /** Card tagline under the logo (S1 "Platform Latih Tubi Nasional 🇲🇾", S2 "Daftar Akaun Baru 🇲🇾"). */
  tagline: string
}>()

defineSlots<{ welcome?: () => unknown; default: () => unknown; below?: () => unknown }>()

useThemeMode('learner')
</script>

<template>
  <main class="flex min-h-dvh flex-col bg-muted xl:grid xl:grid-cols-2" data-testid="auth-layout">
    <div class="h-2 bg-gradient-primary xl:hidden" aria-hidden="true" />

    <aside
      v-if="$slots.welcome"
      class="relative hidden flex-col justify-center gap-6 overflow-hidden bg-gradient-primary p-12 text-primary-on xl:flex"
      data-testid="auth-welcome"
    >
      <DsArt3D name="rocket" size="hero" float class="absolute top-8 right-8" />
      <slot name="welcome" />
    </aside>

    <div class="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-md">
        <UCard>
          <div class="mb-6 flex flex-col items-center gap-2 text-center">
            <img :src="LOGO_URL" alt="PRESTASIPLUS" class="h-12 w-auto max-w-full sm:h-14" />
            <p class="text-label font-medium text-muted" data-testid="auth-tagline">
              {{ tagline }}
            </p>
          </div>
          <slot />
        </UCard>

        <slot name="below" />

        <AuthFooter />
      </div>
    </div>
  </main>
</template>
