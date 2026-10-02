<script setup lang="ts">
/**
 * Gradient hero of S12 and S13 (FR-M08-75, FR-M08-82): icon + h1 + subtitle, the translucent action
 * buttons in the default slot. Below 640px the buttons wrap under the title; every text is ≥ 12px
 * (DV-18) and every button is at least 44px high.
 */
import type { Component } from 'vue'

defineProps<{ title: string; subtitle: string; icon: Component }>()
</script>

<template>
  <section
    class="flex min-w-0 flex-col gap-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-5 text-white shadow-lg sm:flex-row sm:items-center sm:justify-between sm:p-6"
    data-testid="headcount-hero"
  >
    <div class="flex min-w-0 items-center gap-3">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 sm:h-12 sm:w-12"
      >
        <component :is="icon" class="h-6 w-6" />
      </span>
      <div class="min-w-0">
        <h1 class="font-heading text-xl font-bold text-white sm:text-2xl">{{ title }}</h1>
        <p class="text-xs text-white/80 sm:text-sm">{{ subtitle }}</p>
      </div>
    </div>
    <div class="flex flex-wrap gap-2" data-testid="hero-actions">
      <slot />
    </div>
  </section>
</template>
