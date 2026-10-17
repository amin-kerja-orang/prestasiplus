<script setup lang="ts">
import { LOAD_ERROR } from '../lib/load'

defineEmits<{ retry: [] }>()
</script>

<template>
  <div class="flex max-w-xl min-w-0 flex-col gap-3" data-testid="page-error">
    <UAlert color="error" variant="soft" icon="i-ph-warning-circle-duotone" :title="LOAD_ERROR" />
    <UButton size="lg" class="min-h-11 self-start" @click="$emit('retry')">Cuba Semula</UButton>
  </div>
</template>
