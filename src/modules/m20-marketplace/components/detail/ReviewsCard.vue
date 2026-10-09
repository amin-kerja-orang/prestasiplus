<script setup lang="ts">
/**
 * S7 "Ulasan ({n})" card (FN-M20-4.2.7, FR-M20-59): "Belum ada ulasan untuk produk ini" with no
 * review; no review form is ever shown (submission is not observable, OQ-M20-05). Existing reviews
 * (none in the seed) list their stars and text.
 */
import { Star } from '@lucide/vue'

import type { ProductReview } from '../../api'
import { DETAIL_COPY } from './copy'

defineProps<{ reviews: readonly ProductReview[]; count: number }>()

function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow-md sm:p-5" data-testid="reviews-card">
    <h2 class="mb-3 flex items-center gap-2 text-base font-bold text-slate-800">
      <Star class="h-4 w-4 text-amber-500" aria-hidden="true" />
      <span data-testid="reviews-title">{{ DETAIL_COPY.reviews }} ({{ count }})</span>
    </h2>
    <p v-if="reviews.length === 0" class="text-sm text-slate-500" data-testid="reviews-empty">
      {{ DETAIL_COPY.noReviews }}
    </p>
    <ul v-else class="space-y-3">
      <li v-for="r in reviews" :key="r.id" class="text-sm text-slate-600" data-testid="review-item">
        <span class="text-amber-500">{{ stars(r.rating) }}</span>
        <p class="break-words">{{ r.text }}</p>
      </li>
    </ul>
  </section>
</template>
