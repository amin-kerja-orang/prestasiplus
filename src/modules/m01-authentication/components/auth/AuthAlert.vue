<script setup lang="ts">
/**
 * Error / success alert of the auth pages (v2: `UAlert`). One `<p>` per message line; renders
 * nothing when there is no message. Same props as the shared `AlertBox`.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    variant?: 'error' | 'success'
    messages?: string | readonly string[] | null
  }>(),
  { variant: 'error', messages: null },
)

const lines = computed<string[]>(() => {
  const m = props.messages
  if (m == null) return []
  return (typeof m === 'string' ? [m] : [...m]).filter((line) => line !== '')
})
</script>

<template>
  <UAlert
    v-if="lines.length > 0"
    :color="variant"
    variant="soft"
    :icon="variant === 'success' ? 'i-ph-check-circle-duotone' : 'i-ph-warning-circle-duotone'"
    :data-variant="variant"
  >
    <template #description>
      <p v-for="(line, i) in lines" :key="i">{{ line }}</p>
    </template>
  </UAlert>
</template>
