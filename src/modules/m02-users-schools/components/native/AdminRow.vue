<script setup lang="ts">
/** A body row of `AdminTable`: hover layer on desktop, a raised card below `md`. */
</script>

<template>
  <tr
    class="flex flex-col rounded-md bg-elevated p-2 hover:bg-muted md:table-row md:rounded-none md:bg-transparent md:p-0"
  >
    <slot />
  </tr>
</template>
