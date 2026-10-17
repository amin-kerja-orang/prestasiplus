<script setup lang="ts">
/**
 * Text in a semantic tone: `tone` is a theme text token from `lib/` (`text-success`, `text-warning`,
 * `text-error`, `text-info`, `text-dimmed`, ...). Keeps the lookup out of the page templates.
 */
defineProps<{ tone: string }>()
</script>

<template>
  <span :class="tone"><slot /></span>
</template>
