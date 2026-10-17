<script setup lang="ts">
/** "Kembali ke Marketplace" -> S6 (FN-M20-4.2.1, FN-M20-4.3.1). */
import { MARKETPLACE_COPY } from './copy'
</script>

<template>
  <UButton
    to="/marketplace"
    color="neutral"
    variant="ghost"
    icon="i-ph-arrow-left-duotone"
    class="min-h-11 self-start"
    data-testid="marketplace-back"
  >
    {{ MARKETPLACE_COPY.back }}
  </UButton>
</template>
