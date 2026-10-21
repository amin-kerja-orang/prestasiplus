<script setup lang="ts">
/**
 * Header of S2 (FN-M17-3.1.1): one row with the LANGSUNG badge and the MYT clock on the left and the
 * "← Dashboard" / "Aktiviti Harian" actions on the right; it wraps cleanly on small screens. The title is
 * printed by the portal navbar (or here in the bare Guru/school frame). The school view adds
 * "Pemantauan langsung sekolah anda" under the title (FR-M17-106 a).
 */
import { DsLiveBadge, DsPageHeader } from '@/ds'

import { S2_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
</script>

<template>
  <DsPageHeader
    :title="S2_COPY.title"
    :subtitle="school ? S2_COPY.schoolSub : undefined"
    show-title="auto"
    title-testid="cc-title"
    subtitle-testid="cc-s2-subtitle"
    data-testid="cc-s2-header"
  >
    <template #meta>
      <div
        class="flex flex-wrap items-center gap-x-2 gap-y-1"
        data-testid="cc-s2-live"
      >
        <DsLiveBadge :label="S2_COPY.live" data-testid="cc-live-badge" />
        <span class="tabular text-label text-highlighted" data-testid="cc-clock">{{ clock }}</span>
        <span class="text-caption text-muted">{{ S2_COPY.tz }}</span>
      </div>
    </template>
    <template #actions>
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
    </template>
  </DsPageHeader>
</template>
