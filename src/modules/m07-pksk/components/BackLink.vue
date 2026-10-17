<script setup lang="ts">
defineProps<{ to: string; label: string }>()
</script>

<template>
  <UButton
    :to="to"
    variant="link"
    color="neutral"
    icon="i-ph-arrow-left-duotone"
    class="min-h-11 self-start"
    data-testid="back-link"
    >{{ label }}</UButton
  >
</template>
