<script setup lang="ts">
/**
 * Header of S2 (FN-M17-3.1.1): "← Dashboard", "Aktiviti Harian", the title, the LANGSUNG badge, the MYT
 * clock. The school view adds "Pemantauan langsung sekolah anda" under the title (FR-M17-106 a).
 */
import { DsLiveBadge, DsPageHeader, DsStack, DsCluster, DsText } from '@/ds'

import { S2_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
</script>

<template>
  <DsStack as="header" gap="sm" data-testid="cc-s2-header">
    <DsPageHeader
      :title="S2_COPY.title"
      :subtitle="school ? S2_COPY.schoolSub : undefined"
      show-title="auto"
      title-testid="cc-title"
      subtitle-testid="cc-s2-subtitle"
      data-testid="cc-s2-heading"
    >
      <template #actions>
        <DsCluster gap="xs" data-testid="cc-s2-live">
          <DsLiveBadge :label="S2_COPY.live" data-testid="cc-live-badge" />
          <DsText variant="label" tone="highlighted" tabular data-testid="cc-clock">{{
            clock
          }}</DsText>
          <DsText variant="caption" as="span">{{ S2_COPY.tz }}</DsText>
        </DsCluster>
      </template>
    </DsPageHeader>
    <DsCluster gap="xs">
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
    </DsCluster>
  </DsStack>
</template>
