<script setup lang="ts">
/** The "Tentang Model Kirkpatrick" button, a secondary action on the filter row (FN-M12-2.7.1; FR-M12-31). */
defineProps<{ open: boolean; controls: string }>()
defineEmits<{ toggle: [] }>()
</script>

<template>
  <UButton
    type="button"
    color="neutral"
    variant="outline"
    size="lg"
    icon="i-ph-info"
    label="Tentang Model Kirkpatrick"
    :aria-expanded="open"
    :aria-controls="controls"
    data-testid="kirk-info-toggle"
    @click="$emit('toggle')"
  />
</template>
