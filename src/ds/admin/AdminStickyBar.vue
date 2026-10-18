<script setup lang="ts">
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
