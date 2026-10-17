<script setup lang="ts">
/**
 * Header of S3 (FN-M17-4.1.1): "AKTIVITI PLATFORM" ("AKTIVITI SEKOLAH" for the school admin, FR-M17-116),
 * "Command Center" and "Laporan Eksekutif" (admin only), the MYT clock.
 */
import { ccDailyTitle } from '../../api/command-center-board'
import { S2_COPY, S3_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
</script>

<template>
  <header class="flex min-w-0 flex-col gap-3" data-testid="cc-s3-header">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
      <h1 class="min-w-0 text-title text-highlighted" data-testid="cc-title">
        {{ ccDailyTitle(school ? 'school' : 'platform') }}
      </h1>
      <div class="ms-auto flex items-center gap-2" data-testid="cc-s3-live">
        <span class="tabular text-label text-highlighted" data-testid="cc-clock">{{ clock }}</span>
        <span class="text-caption text-muted">{{ S2_COPY.tz }}</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        :to="paths.board"
        color="neutral"
        variant="soft"
        icon="i-ph-arrow-left"
        :label="S3_COPY.back"
        data-testid="cc-s3-back"
      />
      <UButton
        v-if="paths.report"
        :to="paths.report"
        color="primary"
        variant="soft"
        icon="i-ph-file-text"
        :label="S3_COPY.report"
        data-testid="cc-s3-report"
      />
    </div>
  </header>
</template>
