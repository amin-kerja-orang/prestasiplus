<script setup lang="ts">
import { DsStack } from '@/ds'

/** Loading skeleton shared by the M15 pages. */
defineProps<{ testid: string }>()
</script>

<template>
  <DsStack gap="sm" aria-busy="true" :data-testid="testid">
    <USkeleton class="h-28 w-full" />
    <USkeleton class="h-40 w-full" />
  </DsStack>
</template>
