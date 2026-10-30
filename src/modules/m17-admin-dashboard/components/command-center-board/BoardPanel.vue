<script setup lang="ts">
/** A panel of S2: the DS panel with the icon chip, the heading and the shared padding and radius (FR-M17-33). */
import { DsPanel } from '@/ds'

import { accentFor } from '../command-center/cc-format'

defineProps<{ icon: string; title: string; testid: string }>()
</script>

<template>
  <DsPanel
    as="section"
    :title="title"
    :icon="icon"
    :accent="accentFor(icon)"
    stretch
    :data-testid="testid"
  >
    <slot />
  </DsPanel>
</template>
