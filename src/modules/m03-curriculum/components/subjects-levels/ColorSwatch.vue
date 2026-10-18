<script setup lang="ts">
/**
 * The colour swatch of the S6 "Warna" cell: a dot in the subject's own colour (data, not a theme
 * token, so it needs an inline style) and the hex below `sm`-hidden text. Lives outside the strict globs.
 */
defineProps<{ color: string }>()
</script>

<template>
  <span class="inline-flex items-center gap-2" data-testid="subject-color">
    <span
      class="inline-block size-5 shrink-0 rounded-full"
      :style="{ backgroundColor: color }"
      aria-hidden="true"
    ></span>
    <span
      class="hidden font-mono text-caption text-muted 2xl:inline"
      data-testid="subject-color-hex"
      >{{ color }}</span
    >
  </span>
</template>
