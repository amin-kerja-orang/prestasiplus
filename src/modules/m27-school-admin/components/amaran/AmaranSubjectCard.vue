<script setup lang="ts">
/**
 * S4 card "Analisis Risiko Mengikut Subjek" (FR-M27-76, BR-M18-16): one row per subject, "{Subjek}" and
 * "{w}/{m} pelajar lemah ({p}%)", in the order M18 returns. The page renders the card only when rows exist.
 */
import { formatCount } from '@/lib/number'

import type { SubjectRiskRow } from '../../api/amaran'

defineProps<{ rows: SubjectRiskRow[] }>()
</script>

<template>
  <section
    class="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
    data-testid="am-subjects"
  >
    <h2 class="text-base font-bold text-slate-800">Analisis Risiko Mengikut Subjek</h2>
    <ul class="mt-3 divide-y divide-slate-100">
      <li
        v-for="r in rows"
        :key="r.subjectId"
        class="flex min-w-0 flex-col gap-1 py-2 sm:flex-row sm:items-center sm:justify-between"
        data-testid="am-subject-row"
      >
        <span class="min-w-0 font-semibold break-words text-slate-800" data-testid="am-subject-name">{{
          r.subjectName
        }}</span>
        <span class="text-sm text-slate-600" data-testid="am-subject-weak"
          >{{ formatCount(r.weak) }}/{{ formatCount(r.total) }} pelajar lemah ({{ r.pct }}%)</span
        >
      </li>
    </ul>
  </section>
</template>
