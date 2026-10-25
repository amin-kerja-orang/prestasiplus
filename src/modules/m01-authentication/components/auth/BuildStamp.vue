<script setup lang="ts">
/**
 * Build stamp of the demo login screen (UAT T0): shows which commit a deployed build was made from.
 * Rendered only in demo/artifact builds (`vite build --mode demo`); the e2e build and Vitest have
 * another mode, so they never contain it. Not part of the live-site copy.
 */
import { DsText } from '@/ds'

const show = import.meta.env.MODE === 'demo'
const sha = __BUILD_SHA__
const date = __BUILD_DATE__
</script>

<template>
  <DsText
    v-if="show"
    variant="caption"
    tone="muted"
    align="center"
    wrap="anywhere"
    data-testid="build-stamp"
  >
    Binaan {{ sha }} · {{ date }}
  </DsText>
</template>
