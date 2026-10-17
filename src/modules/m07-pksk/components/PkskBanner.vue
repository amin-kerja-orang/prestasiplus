<script setup lang="ts">
/**
 * Gradient A1 banner of the PKSK hub and the level dashboard (restyle spec M-19): on-primary text on
 * the primary gradient. Content comes from the slot; the hub puts its `h1` here.
 */
defineSlots<{ default?: () => unknown }>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 rounded-3xl bg-gradient-primary p-6 text-center text-primary-on shadow-hero sm:p-8"
    data-ds="pksk-banner"
  >
    <slot />
  </div>
</template>
