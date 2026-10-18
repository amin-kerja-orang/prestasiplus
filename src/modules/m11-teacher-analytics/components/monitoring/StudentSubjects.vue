<script setup lang="ts">
/** S4 "Mengikut Subjek" (FN-M11-4.2.4; FR-M11-65): one bar row per answered subject. */
import type { StudentDetail } from '../../api/types'
import { ACCURACY_COLOR, accuracyBand, count, pct1 } from './monitoring-format'

defineProps<{ subjects: StudentDetail['subjects'] }>()
</script>

<template>
  <UCard data-testid="mon-panel-subject">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-book" class="size-5 text-primary-t" />Mengikut Subjek
      </h2>
      <div class="flex flex-col gap-3">
        <div
          v-for="s in subjects"
          :key="s.subjectId"
          class="flex items-center gap-3"
          data-testid="mon-subject-row"
        >
          <span class="w-28 shrink-0 truncate text-body text-default sm:w-40" :title="s.name">{{
            s.name
          }}</span>
          <UProgress
            :model-value="s.pct"
            :color="ACCURACY_COLOR[accuracyBand(s.pct)]"
            size="md"
            class="min-w-0 flex-1"
            :data-band="accuracyBand(s.pct)"
            data-testid="mon-subject-bar"
          />
          <span class="tabular w-14 shrink-0 text-end text-label text-default">{{
            pct1(s.pct)
          }}</span>
          <span class="tabular w-16 shrink-0 text-end text-caption text-muted"
            >{{ count(s.correct) }}/{{ count(s.total) }}</span
          >
        </div>
      </div>
    </div>
  </UCard>
</template>
