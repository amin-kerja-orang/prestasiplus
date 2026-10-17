<script setup lang="ts">
/** "Kembali ke Kurikulum" back link (FR-M03-25, 28, 32, 36). */
import type { RouteLocationRaw } from 'vue-router'

defineProps<{ to: RouteLocationRaw }>()

</script>

<template>
  <UButton
    :to="to"
    color="neutral"
    variant="ghost"
    icon="i-ph-arrow-left"
    class="min-h-11"
    data-testid="curriculum-back"
  >
    Kembali ke Kurikulum
  </UButton>
</template>
