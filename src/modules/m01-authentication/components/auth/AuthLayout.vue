<script setup lang="ts">
/**
 * Standalone auth layout of S1/S2 (FR-M01-01, FR-M01-02/15, v2 shells §6). Rendered by the page
 * (route `layout: 'bare'`), so no shell wraps it. Learner "Elektrik" look for every role:
 * - from `xl` a split screen: the `welcome` slot on the A1 gradient brand panel with layered 3D
 *   art and the two friends; the form on `bg-muted`;
 * - below `xl` the brand strip (3D object + friend) and a single raised card;
 * - the card column holds the logo + tagline + default slot, an optional `below` slot (the S1
 *   stats stickers) and the footer line.
 */
import { DsArt3D, DsBrandLogo, DsFriendAvatar } from '@/ds'
import { useThemeMode } from '@/theme/color-mode'

import AuthBrandStrip from './AuthBrandStrip.vue'
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
    <AuthBrandStrip />

    <aside
      v-if="$slots.welcome"
      class="relative hidden flex-col justify-center gap-6 overflow-hidden bg-gradient-primary p-12 text-primary-on xl:flex"
      data-testid="auth-welcome"
    >
      <span
        class="pointer-events-none absolute -top-24 -right-24 size-96 rounded-full bg-primary-on/10"
        aria-hidden="true"
      />
      <span
        class="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-primary-on/10"
        aria-hidden="true"
      />
      <div class="pointer-events-none absolute inset-0" aria-hidden="true">
        <DsArt3D name="rocket" size="hero" float class="absolute top-8 right-10" />
        <DsArt3D
          name="trophy"
          size="xl"
          float
          class="absolute top-44 right-8"
        />
        <DsArt3D
          name="coin"
          size="lg"
          float
          class="absolute right-10 bottom-14"
        />
        <DsArt3D
          name="fire"
          size="md"
          float
          class="absolute right-36 bottom-4"
        />
        <DsArt3D
          name="books"
          size="lg"
          float
          class="absolute bottom-3 left-12"
        />
        <DsArt3D
          name="party"
          size="sm"
          float
          class="absolute top-6 left-1/2"
        />
      </div>
      <div class="relative flex items-end gap-3" aria-hidden="true" data-testid="auth-friends">
        <DsFriendAvatar friend="aiman" mood="happy" size="lg" />
        <DsFriendAvatar friend="aisyah" mood="happy" size="lg" />
        <p class="mb-3 rounded-card bg-primary-on px-4 py-2.5 text-label text-primary-t shadow-lift">Jom sambung belajar!</p>
      </div>
      <slot name="welcome" />
    </aside>

    <div class="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-md">
        <div class="rounded-card transition-shadow focus-within:shadow-hero">
          <UCard>
            <div class="mb-6 flex flex-col items-center gap-2 text-center">
              <DsBrandLogo />
              <p class="text-label font-medium text-muted" data-testid="auth-tagline">
                {{ tagline }}
              </p>
            </div>
            <slot />
          </UCard>
        </div>

        <slot name="below" />

        <AuthFooter />
      </div>
    </div>
  </main>
</template>
