<script setup lang="ts">
/**
 * Sticky action bar of a learner page (a "Hantar" row). Below `md` it sticks above the bottom tab
 * bar (`bottom-16`) on the muted surface; from `md` it sits in the flow. Below `lg` it reserves
 * end-side clearance for the floating AI button (fixed, `size-14` at `end-4`), so the last action
 * is never covered; from `lg` the button moves and the clearance drops. Actions go in the default
 * slot in reading order; a full-width primary action should use `flex-1`.
 */
</script>

<template>
  <div
    class="sticky bottom-16 flex flex-wrap items-center gap-3 bg-muted py-3 pe-20 md:static md:py-0 lg:pe-0"
    data-ds="sticky-actions"
  >
    <slot />
  </div>
</template>
