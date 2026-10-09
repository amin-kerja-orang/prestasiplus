<script setup lang="ts">
/**
 * The "Permainan" back link (`fa-arrow-left`) at the top of S18-S21 (URS FN-M16-7.3.1, 7.4.1). Green on
 * S20 and centred pink on S21, as the live captures.
 */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import { BACK_LINK } from './copy'

withDefaults(defineProps<{ tone?: 'green' | 'pink' }>(), { tone: 'green' })
</script>

<template>
  <RouterLink
    :to="BACK_LINK.to"
    class="inline-flex min-h-11 items-center gap-1.5 text-sm"
    :class="
      tone === 'pink'
        ? 'text-pink-600 hover:text-pink-800'
        : 'text-emerald-600 hover:text-emerald-800'
    "
    data-testid="m16-back-link"
  >
    <ArrowLeft class="h-4 w-4" />
    {{ BACK_LINK.label }}
  </RouterLink>
</template>
