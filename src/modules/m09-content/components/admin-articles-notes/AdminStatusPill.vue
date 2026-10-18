<script setup lang="ts">
/**
 * Publish status badge (S4, S8): "Diterbitkan" (success) or "Draf" (neutral; PROPOSED COPY placeholder,
 * SRS 8.2, OQ-M09-02).
 */
import { COPY } from '../../lib/admin-articles-notes'

defineProps<{ published: boolean }>()
</script>

<template>
  <UBadge
    :color="published ? 'success' : 'neutral'"
    variant="subtle"
    :icon="published ? 'i-ph-check-circle' : undefined"
    :label="published ? COPY.published : COPY.draft"
    data-testid="status-pill"
  />
</template>
