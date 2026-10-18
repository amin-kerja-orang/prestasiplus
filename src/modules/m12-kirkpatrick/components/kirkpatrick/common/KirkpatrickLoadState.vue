<script setup lang="ts">
/** Loading line and error box shared by the Kirkpatrick screens. */
import { LOAD_ERROR_COPY } from './kirkpatrick-format'

defineProps<{ loading: boolean; error: unknown; hasData: boolean }>()
</script>

<template>
  <UAlert
    v-if="error"
    color="error"
    variant="subtle"
    icon="i-ph-warning-circle"
    :title="LOAD_ERROR_COPY"
    role="alert"
    data-testid="kirk-error"
  />
  <p
    v-else-if="!hasData && loading"
    class="flex items-center gap-2 text-label text-muted"
    data-testid="kirk-loading"
    role="status"
  >
    <UIcon name="i-ph-circle-notch" class="size-5" />Memuatkan...
  </p>
</template>
