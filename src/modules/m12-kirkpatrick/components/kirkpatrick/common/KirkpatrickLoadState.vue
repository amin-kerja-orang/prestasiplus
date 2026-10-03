<script setup lang="ts">
/** Loading line and error box shared by the Kirkpatrick screens. */
import { LoadingSpinner } from '@/components/feedback'

import { LOAD_ERROR_COPY } from './kirkpatrick-format'

defineProps<{ loading: boolean; error: unknown; hasData: boolean }>()
</script>

<template>
  <p v-if="error" class="rounded-xl bg-red-50 p-3 text-sm text-red-700" data-testid="kirk-error">
    {{ LOAD_ERROR_COPY }}
  </p>
  <p
    v-else-if="!hasData && loading"
    class="flex items-center gap-2 text-sm text-slate-500"
    data-testid="kirk-loading"
  >
    <LoadingSpinner class="h-4 w-4" />Memuatkan...
  </p>
</template>
