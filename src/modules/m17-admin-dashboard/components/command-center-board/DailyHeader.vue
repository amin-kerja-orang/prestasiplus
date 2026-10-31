<script setup lang="ts">
/**
 * Header of S3 (FN-M17-4.1.1): the shell prints the page title (`DsPageHeader showTitle="auto"`); the live
 * copy "AKTIVITI PLATFORM" ("AKTIVITI SEKOLAH" for the school admin, FR-M17-116) is the subtitle in normal
 * case, then "Laporan Eksekutif" (admin only). No LIVE badge, MYT clock or back button (owner request
 * 2026-10-29).
 */
import { computed } from 'vue'

import { DsPageHeader } from '@/ds'

import { ccDailyTitle } from '../../api/command-center-board'
import { S2_COPY, S3_COPY, type BoardPaths } from './board-copy'

const props = defineProps<{ paths: BoardPaths; school: boolean }>()

/** The live copy is upper case; shown calmly ("Aktiviti Platform"), not shouted. */
const subtitle = computed(() =>
  ccDailyTitle(props.school ? 'school' : 'platform')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (c) => c.toUpperCase()),
)
</script>

<template>
  <header class="flex min-w-0 flex-col gap-3" data-testid="cc-s3-header">
    <DsPageHeader
      :title="S2_COPY.title"
      :subtitle="subtitle"
      show-title="auto"
      title-testid="cc-title"
      subtitle-testid="cc-s3-subtitle"
    />
    <div v-if="paths.report" class="flex flex-wrap items-center gap-2">
      <UButton
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
