<script setup lang="ts">
/**
 * PHASE 1: fold into DsFormBar (docs/design/v2-ds-consolidation.md). Interim kit for the M02/M22/M03
 * admin revamp; do not build new screens on it.
 */
/** Sticky Simpan / Batal bar at the bottom of a form: Batal first on mobile, buttons to the right. */
</script>

<template>
  <div
    class="sticky bottom-0 z-10 flex flex-col-reverse gap-3 rounded-lg bg-default p-4 shadow-bar-up sm:flex-row sm:items-center sm:justify-end"
    data-ds="admin-sticky-bar"
  >
    <slot />
  </div>
</template>
