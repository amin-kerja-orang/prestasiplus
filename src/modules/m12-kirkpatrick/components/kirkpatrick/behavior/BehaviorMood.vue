<script setup lang="ts">
/**
 * Mood empty card (FN-M12-5.7.1; FR-M12-47; BR-M12-15): shown while the mood check-in count in scope is 0 (always
 * in the prototype: the mood store owner, M26, is not built). The populated mood analysis is unverified on live
 * and not built, so a count above 0 renders nothing.
 */
import { DsEmptyState } from '@/ds'

defineProps<{ moodCount: number }>()
</script>

<template>
  <UCard v-if="moodCount === 0" class="min-w-0" data-testid="beh-mood">
    <DsEmptyState
      icon="chat-circle-dots"
      title="Data Mood Belum Mencukupi"
      description="Pelajar perlu check-in mood harian untuk analisis kesejahteraan vs prestasi."
    />
  </UCard>
</template>
