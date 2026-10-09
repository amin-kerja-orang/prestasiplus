<script setup lang="ts">
/** "Kembali ke Marketplace" (`fa-arrow-left`) -> S6 (FN-M20-4.2.1, FN-M20-4.3.1). */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { MARKETPLACE_COPY } from './copy'
</script>

<template>
  <RouterLink
    to="/marketplace"
    class="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800"
    data-testid="marketplace-back"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" />
    {{ MARKETPLACE_COPY.back }}
  </RouterLink>
</template>
