<script setup lang="ts">
/**
 * S3 "Prestasi Mengikut Subjek" (FN-M12-4.3.1, 4.3.2; FR-M12-37, 38): one row per subject with answers,
 * accuracy descending (the API order): name, progress bar with the 1-decimal label, status badge and
 * "{n} soalan". Rows have no action (DV-M12-05). Status is carried by the badge word, not colour alone.
 */
import { DsPanel } from '@/ds'

import type { Learning, SubjectStatus } from '../../../api/types'
import { pct1, plain, type KirkColor } from '../common'

defineProps<{ subjects: Learning['subjects'] }>()

const STATUS: Record<SubjectStatus, KirkColor> = {
  Mastered: 'success',
  Developing: 'warning',
  Beginning: 'error',
}

/** BM word of the API status (FB-025). */
const STATUS_LABEL: Record<SubjectStatus, string> = {
  Mastered: 'Dikuasai',
  Developing: 'Berkembang',
  Beginning: 'Permulaan',
}
</script>

<template>
  <DsPanel title="Prestasi Mengikut Subjek" icon="i-ph-book" data-testid="kirk-subjects">
    <ul class="flex flex-col gap-3">
      <li
        v-for="s in subjects"
        :key="s.subjectId"
        class="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 sm:flex-nowrap"
        data-testid="kirk-subject-row"
        :data-status="s.status"
      >
        <span
          class="w-24 shrink-0 truncate text-body text-highlighted sm:w-40"
          data-testid="kirk-subject-name"
          >{{ s.name }}</span
        >
        <UProgress
          :model-value="s.accuracy"
          :max="100"
          :color="STATUS[s.status]"
          size="md"
          class="min-w-0 flex-1"
          :aria-label="`${s.name} ${pct1(s.accuracy)}`"
          data-testid="kirk-subject-bar"
        />
        <span
          class="tabular w-14 shrink-0 text-right text-body text-muted"
          data-testid="kirk-subject-pct"
          >{{ pct1(s.accuracy) }}</span
        >
        <!-- Below sm the badge and the count wrap under the bar (320 px: the row cannot fit them beside it). -->
        <div class="flex w-full items-center justify-between gap-2 sm:contents">
          <UBadge
            :color="STATUS[s.status]"
            variant="soft"
            :label="STATUS_LABEL[s.status]"
            data-testid="kirk-subject-status"
          />
          <span
            class="shrink-0 text-right text-body text-muted sm:w-20"
            data-testid="kirk-subject-count"
            >{{ plain(s.answers) }} soalan</span
          >
        </div>
      </li>
    </ul>
  </DsPanel>
</template>
