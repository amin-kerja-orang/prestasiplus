<script setup lang="ts">
/**
 * The "Permainan" back link at the top of S18-S21 (URS FN-M16-7.3.1, 7.4.1). v2: one neutral ghost
 * button with a Phosphor arrow (the live green / pink tones are dropped; colour is kept for focus points).
 */
import { BACK_LINK } from './copy'
</script>

<template>
  <UButton
    :to="BACK_LINK.to"
    color="neutral"
    variant="ghost"
    icon="i-ph-arrow-left"
    class="min-h-11"
    data-testid="m16-back-link"
  >
    {{ BACK_LINK.label }}
  </UButton>
</template>
