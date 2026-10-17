<script setup lang="ts">
/**
 * Typography wrapper for rich text (headings, lists, quotes on `bg-elevated`, images with the
 * card radius, `max-w-prose`). The element rules live in `src/theme/ds-extras.css`, keyed on
 * `[data-ds='prose']`, and use only DS tokens. Pass sanitised HTML in `html`, or use the slot.
 */
defineProps<{
  /** Sanitised HTML. The caller is responsible for sanitising it. */
  html?: string
}>()
</script>

<template>
  <div class="max-w-prose min-w-0" data-ds="prose">
    <!-- eslint-disable-next-line vue/no-v-html -- the caller passes sanitised HTML -->
    <div v-if="html" v-html="html" />
    <slot v-else />
  </div>
</template>
