<script setup lang="ts">
/** S4 "Mengikut Subjek" (FN-M11-4.2.4; FR-M11-65): one bar row per answered subject. */
import { Book } from '@lucide/vue'

import type { StudentDetail } from '../../api/types'
import { ACCURACY_BAR_500, CARD, accuracyBand, count, pct1 } from './monitoring-format'

defineProps<{ subjects: StudentDetail['subjects'] }>()
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="mon-panel-subject">
    <h3 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <Book class="h-5 w-5 text-indigo-600" />Mengikut Subjek
    </h3>
    <div class="space-y-3">
      <div
        v-for="s in subjects"
        :key="s.subjectId"
        class="flex items-center gap-3"
        data-testid="mon-subject-row"
      >
        <span class="w-28 shrink-0 truncate text-sm text-slate-700 sm:w-36" :title="s.name">{{
          s.name
        }}</span>
        <div class="h-5 min-w-0 flex-1 rounded-full bg-slate-200">
          <div
            :class="[
              'flex h-5 items-center justify-end overflow-hidden rounded-full pr-1.5',
              ACCURACY_BAR_500[accuracyBand(s.pct)],
            ]"
            :style="{ width: `${String(s.pct)}%` }"
            :data-band="accuracyBand(s.pct)"
            data-testid="mon-subject-bar"
          >
            <span class="text-xs leading-none font-semibold whitespace-nowrap text-white">{{
              pct1(s.pct)
            }}</span>
          </div>
        </div>
        <span class="w-14 shrink-0 text-right text-xs text-slate-500"
          >{{ count(s.correct) }}/{{ count(s.total) }}</span
        >
      </div>
    </div>
  </section>
</template>
