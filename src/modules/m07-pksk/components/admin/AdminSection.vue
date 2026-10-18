<script setup lang="ts">
/** A titled card that groups related fields of an admin form (heading with icon chip, optional hint). */
import type { DsAccent } from '@/ds'
import { DsIconChip } from '@/ds'

withDefaults(
  defineProps<{
    title: string
    icon?: string
    description?: string
    accent?: DsAccent
    titleTestid?: string
  }>(),
  { icon: undefined, description: undefined, accent: 'action', titleTestid: undefined },
)
</script>

<template>
  <UCard :ui="{ header: 'p-6', body: 'p-6' }">
    <template #header>
      <div class="flex items-start gap-3">
        <DsIconChip v-if="icon" :icon="icon" :accent="accent" size="sm" />
        <div class="min-w-0">
          <h2 class="text-label text-highlighted" :data-testid="titleTestid">{{ title }}</h2>
          <p v-if="description" class="text-caption text-muted">{{ description }}</p>
        </div>
      </div>
    </template>
    <div class="flex min-w-0 flex-col gap-6">
      <slot />
    </div>
  </UCard>
</template>
