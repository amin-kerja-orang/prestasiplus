<script setup lang="ts">
/**
 * Result of `GET /admin/papers/:id/review`: blockers (red, stop Terbitkan), notes (amber, never
 * block) and "Blueprint perlu semakan" when flagged, plus the "Dilihat murid" line. Lines are shown
 * verbatim from the server.
 */
import type { BijakBuilderReview } from '@pp/contract'

import { NotServedNotice } from '@/components/question-display'

import { builderCopy as t } from '../domain/copy'

defineProps<{ review: BijakBuilderReview }>()
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="review-block">
    <div v-if="review.blockers.length" role="alert" data-testid="review-blockers">
      <h3 class="flex items-center gap-2 text-subheading text-error">
        <UIcon name="i-ph-warning-octagon" class="size-5" aria-hidden="true" />
        {{ t.blockers }}
      </h3>
      <ul class="mt-2 flex list-disc flex-col gap-1 ps-6 text-body text-error">
        <li v-for="b in review.blockers" :key="b">{{ b }}</li>
      </ul>
    </div>
    <p v-else class="flex items-center gap-2 text-body text-success" data-testid="review-ok">
      <UIcon name="i-ph-check-circle" class="size-5" aria-hidden="true" />
      {{ t.reviewOk }}
    </p>

    <div v-if="review.notes.length || review.blueprintNeedsReview" data-testid="review-notes">
      <UBadge
        v-if="review.blueprintNeedsReview"
        color="warning"
        variant="subtle"
        icon="i-ph-warning"
        :label="t.blueprintNeedsReview"
        data-testid="blueprint-needs-review"
      />
      <h3 v-if="review.notes.length" class="mt-2 text-subheading text-warning">{{ t.notes }}</h3>
      <ul v-if="review.notes.length" class="mt-1 flex list-disc flex-col gap-1 ps-6 text-body text-warning">
        <li v-for="n in review.notes" :key="n">{{ n }}</li>
      </ul>
    </div>

    <ul
      v-if="review.rows.some((r) => !r.ok)"
      class="flex flex-col gap-2"
      data-testid="review-rows"
    >
      <li v-for="r in review.rows.filter((x) => !x.ok)" :key="r.questionId" class="flex flex-col gap-1">
        <span class="text-caption text-muted">{{ r.section }} · {{ r.questionId }}</span>
        <NotServedNotice :reason="r.reason" />
      </li>
    </ul>

    <p class="text-caption text-muted" data-testid="review-visible">
      <span class="font-semibold">{{ t.seen }}:</span>
      {{ review.visibleToStudents ? t.visibleLive : t.visibleDraft }}
    </p>
  </div>
</template>
