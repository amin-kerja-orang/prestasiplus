<script setup lang="ts">
/**
 * S3 "Prestasi Mengikut Subjek" (FN-M12-4.3.1, 4.3.2; FR-M12-37, 38): one row per subject with answers,
 * accuracy descending (the API order): name, bar with the 1-decimal label inside, status pill and
 * "{n} soalan". Rows have the default cursor, no title and no action (DV-M12-05).
 */
import { Book } from '@lucide/vue'

import type { Learning, SubjectStatus } from '../../../api/types'
import { CARD, pct1, plain } from '../common'

defineProps<{ subjects: Learning['subjects'] }>()

const STATUS: Record<SubjectStatus, { bar: string; pill: string }> = {
  Mastered: { bar: 'bg-green-500', pill: 'bg-green-100 text-green-700' },
  Developing: { bar: 'bg-amber-500', pill: 'bg-amber-100 text-amber-700' },
  Beginning: { bar: 'bg-red-500', pill: 'bg-red-100 text-red-700' },
}
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="kirk-subjects">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <Book class="h-5 w-5 text-indigo-600" />Prestasi Mengikut Subjek
    </h2>
    <div class="space-y-2">
      <div
        v-for="s in subjects"
        :key="s.subjectId"
        class="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 sm:flex-nowrap"
        data-testid="kirk-subject-row"
        :data-status="s.status"
      >
        <span
          class="w-24 shrink-0 truncate text-xs text-indigo-600 sm:w-40"
          data-testid="kirk-subject-name"
          >{{ s.name }}</span
        >
        <div class="h-5 min-w-0 flex-1 rounded-full bg-slate-200">
          <div
            :class="['flex h-5 items-center justify-end rounded-full pr-1.5', STATUS[s.status].bar]"
            :style="{ width: `${s.accuracy}%` }"
            data-testid="kirk-subject-bar"
          >
            <span
              class="text-[10px] font-bold whitespace-nowrap text-white"
              data-testid="kirk-subject-pct"
              >{{ pct1(s.accuracy) }}</span
            >
          </div>
        </div>
        <!-- Below sm the pill and the count wrap under the bar (320 px: the row cannot fit them beside it). -->
        <div class="flex w-full items-center justify-between gap-2 pl-[6.5rem] sm:contents">
          <span
            :class="[
              'shrink-0 rounded px-2 py-0.5 text-center text-[10px] font-semibold',
              STATUS[s.status].pill,
            ]"
            data-testid="kirk-subject-status"
            >{{ s.status }}</span
          >
          <span
            class="shrink-0 text-right text-xs text-slate-400 sm:w-20"
            data-testid="kirk-subject-count"
            >{{ plain(s.answers) }} soalan</span
          >
        </div>
      </div>
    </div>
  </section>
</template>
