<script setup lang="ts">
/** A panel of the Command Center: a raised card with a tinted icon chip and the heading (FN-M10-2.2.4, 2.2.5). */
import { DsPanel, type DsAccent } from '@/ds'

withDefaults(defineProps<{ icon: string; title: string; testid: string; accent?: DsAccent }>(), {
  accent: 'action',
})
</script>

<template>
  <DsPanel class="min-w-0" :title="title" :icon="icon" :accent="accent" :data-testid="testid">
    <slot />
  </DsPanel>
</template>
