<script setup lang="ts">
/** Reviews card of S7: the title with the count, the empty line or the review list. */
import type { ProductReview } from '../../api'
import { DETAIL_COPY } from './copy'

defineProps<{ reviews: readonly ProductReview[]; count: number }>()

function stars(rating: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(rating)))
  return '★'.repeat(filled) + '☆'.repeat(5 - filled)
}
</script>

<template>
  <UCard class="min-w-0" data-testid="reviews-card">
    <div class="flex flex-col gap-3">
      <h2 class="flex items-center gap-2 text-heading text-highlighted">
        <UIcon name="i-ph-star-duotone" class="size-5 text-warning" aria-hidden="true" />
        <span data-testid="reviews-title">{{ DETAIL_COPY.reviews }} ({{ count }})</span>
      </h2>
      <p
        v-if="reviews.length === 0"
        class="py-4 text-center text-body text-muted"
        data-testid="reviews-empty"
      >
        {{ DETAIL_COPY.noReviews }}
      </p>
      <ul v-else class="flex flex-col gap-3">
        <li v-for="r in reviews" :key="r.id" class="text-body text-toned" data-testid="review-item">
          <span class="text-warning">{{ stars(r.rating) }}</span>
          <p class="break-words">{{ r.text }}</p>
        </li>
      </ul>
    </div>
  </UCard>
</template>
