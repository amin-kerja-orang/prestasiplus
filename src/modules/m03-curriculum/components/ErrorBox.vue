<script setup lang="ts">
/**
 * The M04 alert box in the v2 staff theme (replaces `AlertBox`): one line per message, no ARIA
 * role change beyond `alert`. Renders nothing without a message. `variant` "success" is the green box.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    messages?: string | readonly string[] | null
    variant?: 'error' | 'success'
  }>(),
  { messages: null, variant: 'error' },
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
    variant="subtle"
    :icon="variant === 'error' ? 'i-ph-warning-circle' : 'i-ph-check-circle'"
    role="alert"
    :data-variant="variant"
  >
    <template #description>
      <p v-for="(line, i) in lines" :key="i">{{ line }}</p>
    </template>
  </UAlert>
</template>
