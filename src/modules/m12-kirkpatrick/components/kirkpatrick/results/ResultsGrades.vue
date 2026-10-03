<script setup lang="ts">
/**
 * "Taburan Gred ({tahun})" (FN-M12-6.2.1; FR-M12-49; BR-M12-17): ten rows A+ ... G, bar width n ÷ max(n), count inside the
 * bar, the % at the right; each row has the live `title` and the default cursor. Not rendered by the page when the
 * scope has no distribution.
 */
import { computed } from 'vue'

import { AppIcon } from '@/components/icon'

import type { ResultsDistribution } from './results-types'
import { CARD, pct, plain } from '../common/kirkpatrick-format'
import { GRADE_FILL } from './results-format'

const props = defineProps<{ distribution: ResultsDistribution }>()

const max = computed(() => Math.max(1, ...props.distribution.rows.map((r) => r.n)))
</script>

<template>
  <section :class="[CARD, 'min-w-0 p-4 sm:p-5']" data-testid="res-grades">
    <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <AppIcon name="fa-chart-bar" class="h-4 w-4 text-indigo-600" />Taburan Gred ({{
        distribution.year
      }})
    </h2>
    <p class="mb-3 text-xs text-slate-400">
      Berdasarkan {{ plain(distribution.candidates) }} calon — sumber: Headcount OTR
    </p>
    <div class="space-y-1.5">
      <div
        v-for="r in distribution.rows"
        :key="r.grade"
        class="flex cursor-default items-center gap-2"
        :title="`${r.grade}: ${r.n} pelajar (${pct(r.pct)})`"
        data-testid="res-grade-row"
      >
        <span class="w-7 shrink-0 text-right text-xs font-medium text-slate-600">{{
          r.grade
        }}</span>
        <div class="h-6 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div
            :class="[
              'flex h-6 items-center rounded-full px-2 text-xs font-bold text-white',
              GRADE_FILL[r.grade],
            ]"
            :style="{ width: `${(r.n / max) * 100}%`, minWidth: r.n > 0 ? '1.5rem' : '0' }"
            data-testid="res-grade-bar"
          >
            <template v-if="r.n > 0">{{ r.n }}</template>
          </div>
        </div>
        <span class="w-12 shrink-0 text-right text-xs text-slate-400" data-testid="res-grade-pct">{{
          pct(r.pct)
        }}</span>
      </div>
    </div>
  </section>
</template>
