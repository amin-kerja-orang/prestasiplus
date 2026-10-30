<script setup lang="ts">
/**
 * Header of S2 (FN-M17-3.1.1): the title. The school view adds "Pemantauan langsung sekolah anda" under
 * the title (FR-M17-106 a). No LIVE badge, MYT clock or "Dashboard" / "Aktiviti Harian" buttons (owner
 * request 2026-10-29; the sidebar has "Aktiviti Harian").
 */
import { DsPageHeader } from '@/ds'

import { S2_COPY } from './board-copy'

defineProps<{ school: boolean }>()
</script>

<template>
  <header class="flex min-w-0 flex-col gap-3" data-testid="cc-s2-header">
    <DsPageHeader
      :title="S2_COPY.title"
      :subtitle="school ? S2_COPY.schoolSub : undefined"
      show-title="auto"
      title-testid="cc-title"
      subtitle-testid="cc-s2-subtitle"
      data-testid="cc-s2-heading"
    />
  </header>
</template>
