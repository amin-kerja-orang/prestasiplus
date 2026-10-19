<script setup lang="ts">
/**
 * S6 category chips (FN-M20-4.1.2, FR-M20-50): "Semua" -> `/marketplace`, each category ->
 * `?category={slug}` only (the other query values are dropped, as live). The chip of the current
 * category is the solid primary one.
 */
import type { MarketplaceCategory } from '../../api'
import { MARKETPLACE_COPY } from './copy'

defineProps<{ categories: readonly MarketplaceCategory[]; active: string }>()
</script>

<template>
  <nav class="flex gap-2 overflow-x-auto sm:flex-wrap" data-testid="marketplace-chips">
    <UButton
      to="/marketplace"
      size="lg"
      class="min-h-11 shrink-0"
      :color="active === '' ? 'primary' : 'neutral'"
      :variant="active === '' ? 'solid' : 'soft'"
      :data-active="active === '' ? 'true' : 'false'"
      data-testid="marketplace-chip-all"
    >
      {{ MARKETPLACE_COPY.chipAll }}
    </UButton>
    <UButton
      v-for="c in categories"
      :key="c.id"
      :to="`/marketplace?category=${c.slug}`"
      size="lg"
      class="min-h-11 shrink-0"
      :color="active === c.slug ? 'primary' : 'neutral'"
      :variant="active === c.slug ? 'solid' : 'soft'"
      :data-active="active === c.slug ? 'true' : 'false'"
      :data-testid="`marketplace-chip-${c.slug}`"
    >
      {{ c.name }}
    </UButton>
  </nav>
</template>
