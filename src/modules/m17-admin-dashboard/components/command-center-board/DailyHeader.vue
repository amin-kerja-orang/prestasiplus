<script setup lang="ts">
/**
 * Header of S3 (FN-M17-4.1.1): the shell prints the page title (`DsPageHeader showTitle="auto"`); the live
 * copy "AKTIVITI PLATFORM" ("AKTIVITI SEKOLAH" for the school admin, FR-M17-116) is the subtitle in normal
 * case, the LIVE badge and the MYT clock are the header actions, then "Command Center" and "Laporan
 * Eksekutif" (admin only).
 */
import { computed } from 'vue'

import { DsLiveBadge, DsPageHeader, DsStack, DsCluster, DsText } from '@/ds'

import { ccDailyTitle } from '../../api/command-center-board'
import { S2_COPY, S3_COPY, type BoardPaths } from './board-copy'
import { useBoardClock } from './composables'

const props = defineProps<{ paths: BoardPaths; school: boolean }>()

const clock = useBoardClock()
/** The live copy is upper case; shown calmly ("Aktiviti Platform"), not shouted. */
const subtitle = computed(() =>
  ccDailyTitle(props.school ? 'school' : 'platform')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
)
</script>

<template>
  <DsStack as="header" gap="sm" data-testid="cc-s3-header">
    <DsPageHeader
      :title="S2_COPY.title"
      :subtitle="subtitle"
      show-title="auto"
      title-testid="cc-title"
      subtitle-testid="cc-s3-subtitle"
    >
      <template #actions>
        <DsCluster gap="xs" data-testid="cc-s3-live">
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
    </DsCluster>
  </DsStack>
</template>
