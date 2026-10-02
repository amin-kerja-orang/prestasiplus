<script setup lang="ts">
/** "Kembali ke Senarai" link (S2-S4, S6-S8): arrow + text, 44 px tall. */
import { ArrowLeft } from '@lucide/vue'
import { RouterLink } from 'vue-router'

defineProps<{ to: string }>()
</script>

<template>
  <RouterLink
    :to="to"
    class="inline-flex min-h-11 items-center gap-2 text-sm text-slate-500 transition hover:text-slate-700"
    data-testid="back-link"
  >
    <ArrowLeft class="h-4 w-4" aria-hidden="true" />
    Kembali ke Senarai
  </RouterLink>
</template>
