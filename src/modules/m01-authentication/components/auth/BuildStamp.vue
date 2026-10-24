<script setup lang="ts">
/**
 * Build stamp of the demo login screen (UAT T0): shows which commit a deployed build was made from.
 * Rendered only in demo/artifact builds (`vite build --mode demo`); the e2e build and Vitest have
 * another mode, so they never contain it. Not part of the live-site copy.
 */
const show = import.meta.env.MODE === 'demo'
const sha = __BUILD_SHA__
const date = __BUILD_DATE__
</script>

<template>
  <p
    v-if="show"
    class="mt-1 text-center text-caption break-words text-muted"
    data-testid="build-stamp"
  >
    Binaan {{ sha }} · {{ date }}
  </p>
</template>
