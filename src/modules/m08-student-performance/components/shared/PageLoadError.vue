<script setup lang="ts">
/** Global load-error box of the M08 pages (SRS M08 §8.3): the text and the "Cuba Semula" retry. */
import { LOAD_ERROR } from '../../lib/prestasi/load'

const emit = defineEmits<{ retry: [] }>()
</script>

<template>
  <UAlert
    color="error"
    variant="subtle"
    icon="i-ph-warning-circle"
    role="alert"
    :title="LOAD_ERROR"
    :actions="[
      {
        label: 'Cuba Semula',
        color: 'neutral',
        variant: 'soft',
        size: 'lg',
        onClick: () => emit('retry'),
      },
    ]"
    data-testid="page-error"
  />
</template>
