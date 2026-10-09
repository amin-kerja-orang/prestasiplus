<script setup lang="ts">
/**
 * S6 category chips (FN-M20-4.1.2, FR-M20-50): "Semua" -> `/marketplace`, each category ->
 * `?category={slug}` only (the other query values are dropped, as live). The chip of the current
 * category is indigo with white text; the others white with a border.
 */
import { RouterLink } from 'vue-router'

import type { MarketplaceCategory } from '../../api'
import { categoryIcon } from './category-icons'
import { MARKETPLACE_COPY } from './copy'

defineProps<{ categories: readonly MarketplaceCategory[]; active: string }>()

const CHIP =
  'inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium transition'
const ON = 'bg-indigo-500 text-white'
const OFF = 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
</script>

<template>
  <nav class="flex flex-wrap gap-2" data-testid="marketplace-chips">
    <RouterLink
      to="/marketplace"
      :class="[CHIP, active === '' ? ON : OFF]"
      :data-active="active === '' ? 'true' : 'false'"
      data-testid="marketplace-chip-all"
    >
      {{ MARKETPLACE_COPY.chipAll }}
    </RouterLink>
    <RouterLink
      v-for="c in categories"
      :key="c.id"
      :to="`/marketplace?category=${c.slug}`"
      :class="[CHIP, active === c.slug ? ON : OFF]"
      :data-active="active === c.slug ? 'true' : 'false'"
      :data-testid="`marketplace-chip-${c.slug}`"
    >
      <component :is="categoryIcon(c.slug)" class="h-4 w-4 shrink-0" aria-hidden="true" />
      {{ c.name }}
    </RouterLink>
  </nav>
</template>
