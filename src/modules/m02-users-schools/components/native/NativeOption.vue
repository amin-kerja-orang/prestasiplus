<script setup lang="ts">
/** One row of a search picker list (44 px target). */
</script>

<template>
  <button
    type="button"
    class="block min-h-11 w-full px-3 py-2 text-start text-label text-default hover:bg-elevated focus-visible:bg-elevated disabled:text-dimmed disabled:hover:bg-transparent"
  >
    <slot />
  </button>
</template>
