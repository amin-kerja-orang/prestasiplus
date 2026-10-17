<script setup lang="ts">
/**
 * Header of S2 (FN-M17-3.1.1): "← Dashboard", "Aktiviti Harian", the title, the LANGSUNG badge, the MYT
 * clock. The school view adds "Pemantauan langsung sekolah anda" under the title (FR-M17-106 a).
 */
import { DsLiveBadge } from '@/ds'

import { S2_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
</script>

<template>
  <header class="flex min-w-0 flex-col gap-3" data-testid="cc-s2-header">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2" data-testid="cc-s2-heading">
      <div class="flex min-w-0 flex-col gap-1">
        <h1 class="min-w-0 text-title text-highlighted" data-testid="cc-title">
          {{ S2_COPY.title }}
        </h1>
        <p v-if="school" class="text-body text-muted" data-testid="cc-s2-subtitle">
          {{ S2_COPY.schoolSub }}
        </p>
      </div>
      <div class="ms-auto flex flex-wrap items-center gap-2" data-testid="cc-s2-live">
        <DsLiveBadge :label="S2_COPY.live" data-testid="cc-live-badge" />
        <span class="tabular text-label text-highlighted" data-testid="cc-clock">{{ clock }}</span>
        <span class="text-caption text-muted">{{ S2_COPY.tz }}</span>
      </div>
    </div>
    <div class="flex flex-wrap items-center gap-2">
      <UButton
        :to="paths.dashboard"
        color="neutral"
        variant="soft"
        icon="i-ph-arrow-left"
        label="Dashboard"
        :aria-label="S2_COPY.back"
        data-testid="cc-s2-back"
      />
      <UButton
        :to="paths.daily"
        color="primary"
        variant="soft"
        icon="i-ph-chart-bar"
        :label="S2_COPY.daily"
        data-testid="cc-s2-daily"
      />
    </div>
  </header>
</template>
