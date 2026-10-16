<script setup lang="ts">
/**
 * Full-width learner surface behind a Bijak SPM page, so the page reads correctly (dark by
 * default) even inside a frame that does not paint the learner background itself.
 */
</script>

<template>
  <div class="min-h-dvh w-full bg-default text-default">
    <slot />
  </div>
</template>
