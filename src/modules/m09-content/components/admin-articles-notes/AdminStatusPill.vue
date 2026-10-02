<script setup lang="ts">
/**
 * Publish status pill (S1, S4, S5, S8): `fa-check-circle` "Diterbitkan" emerald-100/emerald-700;
 * a draft shows "Draf" slate-100/slate-700 (PROPOSED COPY placeholder, SRS §8.2, OQ-M09-02).
 */
import { CircleCheck } from '@lucide/vue'

import { COPY } from '../../lib/admin-articles-notes'

defineProps<{ published: boolean }>()
</script>

<template>
  <span
    v-if="published"
    class="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-emerald-700"
    data-testid="status-pill"
  >
    <CircleCheck class="h-3 w-3" aria-hidden="true" />{{ COPY.published }}
  </span>
  <span
    v-else
    class="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap text-slate-700"
    data-testid="status-pill"
    >{{ COPY.draft }}</span
  >
</template>
