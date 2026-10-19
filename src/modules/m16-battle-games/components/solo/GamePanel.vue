<script setup lang="ts">
/**
 * The play area of S13-S16 and S19 (v2 learner theme): a centred column on the page surface. The
 * game colour now comes from the DS composites (accent chips, rings, quiz options), so the panel
 * itself is neutral and works in light and dark mode.
 */
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-4 py-2" data-testid="game-panel">
    <slot />
  </div>
</template>
