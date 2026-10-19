<script setup lang="ts">
/**
 * Layout of S3/S4/S5 (M01-T4), v2 theme: the learner "Elektrik" gradient strip on top and a
 * single centred raised card (28rem). The page fills the card through the slots.
 */
import { useThemeMode } from '@/theme/color-mode'

import AuthBrandStrip from './AuthBrandStrip.vue'
import AuthFooter from './AuthFooter.vue'

defineProps<{
  /** H1 text; the `icon` slot holds the large emoji or icon above it (🔑, 🔒, S5 id-card). */
  heading: string
  intro: string
}>()

defineSlots<{ icon: () => unknown; default: () => unknown }>()

useThemeMode('learner')
</script>

<template>
  <main class="flex min-h-dvh flex-col bg-muted" data-testid="password-layout">
    <AuthBrandStrip class="flex!" />
    <div class="flex flex-1 items-center justify-center p-4 sm:p-8">
      <div class="w-full max-w-md">
        <UCard>
          <div class="mb-6 flex flex-col items-center gap-2 text-center">
            <div
              class="flex size-16 items-center justify-center rounded-card bg-primary-soft text-title leading-none text-primary-t"
              aria-hidden="true"
            >
              <slot name="icon" />
            </div>
            <h1 class="text-heading text-highlighted" data-testid="password-heading">
              {{ heading }}
            </h1>
            <p class="text-label text-muted">{{ intro }}</p>
          </div>
          <slot />
        </UCard>
        <AuthFooter />
      </div>
    </div>
  </main>
</template>
