<script setup lang="ts">
/** LIVE badge: red, solid, with a pulsing dot (design system 5, "badge"; stays red). */
defineProps<{
  /** Badge text, e.g. "LANGSUNG" (BM from the caller). */
  label: string
}>()
</script>

<template>
  <UBadge color="error" variant="solid" size="md" data-ds="live-badge">
    <span
      class="size-2 animate-ds-live-pulse rounded-full bg-on-sem motion-reduce:animate-none"
      aria-hidden="true"
    />
    {{ label }}
  </UBadge>
</template>
