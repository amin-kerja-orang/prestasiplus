<script setup lang="ts">
/** One cell of `CardRow`; `label` is printed before the value below `md` (omit it for a full-width cell). */
defineProps<{ label?: string; colspan?: number }>()
</script>

<template>
  <td :data-label="label" :colspan="colspan">
    <slot />
  </td>
</template>
