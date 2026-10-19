<script setup lang="ts">
/** A panel of S2: a raised card with a tinted icon chip and the heading (FR-M17-33). */
import { DsIconChip, DsCluster, DsHeading } from '@/ds'

import { accentFor } from '../command-center/cc-format'

defineProps<{ icon: string; title: string; testid: string }>()
</script>

<template>
  <UCard class="min-w-0" :data-testid="testid">
    <template #header>
      <DsCluster gap="xs" :wrap="false">
        <DsIconChip :icon="icon" :accent="accentFor(icon)" size="sm" />
        <DsHeading :level="2" variant="subheading" class="min-w-0" data-testid="board-panel-title">
          {{ title }}
        </DsHeading>
      </DsCluster>
    </template>
    <slot />
  </UCard>
</template>
