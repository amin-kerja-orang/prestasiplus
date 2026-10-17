<script setup lang="ts">
/** Red error list above a form or table (server messages, one line each). Renders nothing when empty. */
defineProps<{ messages: readonly string[] }>()
</script>

<template>
  <UAlert
    v-if="messages.length > 0"
    color="error"
    variant="subtle"
    icon="i-ph-warning-circle"
    role="alert"
  >
    <template #description>
      <div class="flex flex-col gap-1">
        <p v-for="m in messages" :key="m">{{ m }}</p>
      </div>
    </template>
  </UAlert>
</template>
