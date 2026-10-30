<script setup lang="ts">
/** Status of a Kontrak: Draf, Spec or Disahkan. Icon plus word, never colour alone (NFR-16). */
import { computed } from 'vue'

const props = defineProps<{ source: 'Draf' | 'Spec' | 'Disahkan' }>()

const look = computed(() =>
  props.source === 'Disahkan'
    ? { color: 'success' as const, icon: 'i-ph-check-circle' }
    : props.source === 'Spec'
      ? { color: 'warning' as const, icon: 'i-ph-warning-circle' }
      : { color: 'neutral' as const, icon: 'i-ph-pencil-simple' },
)
</script>

<template>
  <UBadge
    :color="look.color"
    variant="subtle"
    :icon="look.icon"
    :label="source"
    data-testid="source-badge"
  />
</template>
