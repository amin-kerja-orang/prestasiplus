<script setup lang="ts">
/**
 * Layout of S3/S4/S5 (M01-T4; discovery M01 §2.3-2.5): the same animated gradient as S1/S2 but a
 * single centred card (448px on desktop, full width minus the margins on mobile) with no logo,
 * no floating emoji, no wave and no welcome column. The page fills the card through the slots.
 */
import AuthFooter from './AuthFooter.vue'

defineProps<{
  /** H1 text; the `icon` slot holds the large emoji or icon above it (🔑, 🔒, S5 id-card). */
  heading: string
  intro: string
}>()

defineSlots<{ icon: () => unknown; default: () => unknown }>()
</script>

<template>
  <main
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-auth p-3 motion-safe:animate-cool-gradient sm:p-4"
    data-testid="password-layout"
  >
    <div class="relative z-10 w-full max-w-md">
      <div class="rounded-2xl bg-white p-5 shadow-2xl sm:rounded-3xl sm:p-8">
        <div class="mb-6 text-center">
          <div class="mb-3 flex justify-center text-[60px] leading-none" aria-hidden="true">
            <slot name="icon" />
          </div>
          <h1 class="text-2xl font-bold text-slate-800" data-testid="password-heading">
            {{ heading }}
          </h1>
          <p class="mt-2 text-sm text-slate-500">{{ intro }}</p>
        </div>
        <slot />
      </div>
      <AuthFooter />
    </div>
  </main>
</template>
