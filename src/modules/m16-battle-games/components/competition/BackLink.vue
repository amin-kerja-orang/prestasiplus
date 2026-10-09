<script setup lang="ts">
/** The "Permainan" back link (`fa-arrow-left`) at the top of S18-S21 (URS FN-M16-7.3.1, 7.4.1). */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { BACK_LINK } from './copy'
</script>

<template>
  <RouterLink
    :to="BACK_LINK.to"
    class="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
    data-testid="m16-back-link"
  >
    <ArrowLeft class="h-4 w-4" />
    {{ BACK_LINK.label }}
  </RouterLink>
</template>
