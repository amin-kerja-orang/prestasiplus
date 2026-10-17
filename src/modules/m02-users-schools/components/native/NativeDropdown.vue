<script setup lang="ts">
/** Result list of a search picker: a raised panel under the input, scrolling inside itself. */
</script>

<template>
  <div class="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-card bg-default shadow-card">
    <slot />
  </div>
</template>
