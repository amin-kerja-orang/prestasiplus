<script setup lang="ts">
/**
 * S5 card "Prestasi Mengikut Subjek" for the shown month (FR-M27-85; BR-M27-29): the boxes "SUBJEK TERKUAT"
 * and "SUBJEK PERLU PERHATIAN" ("{subjek}", "{p}% ({n} soalan)") and one row per subject ("{subjek}",
 * "{p}% · {n} soalan · {n} pelajar"), ordered by accuracy descending (the order of the API).
 */
import type { MonthlyReport } from '../../api/school-admin'
import { count, dec1 } from './monthly-format'

defineProps<{ subjects: MonthlyReport['subjects'] }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="lb-subjects">
    <h2 class="text-sm font-bold text-slate-700" data-testid="lb-subjects-title">
      Prestasi Mengikut Subjek
    </h2>

    <div class="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
      <div
        v-if="subjects.strongest"
        class="min-w-0 rounded-xl border border-green-200 bg-green-50 p-3"
        data-testid="lb-strongest"
      >
        <p class="text-xs font-bold tracking-wide text-green-700">SUBJEK TERKUAT</p>
        <p class="mt-1 font-bold break-words text-slate-800" data-testid="lb-strongest-name">
          {{ subjects.strongest.name }}
        </p>
        <p class="text-sm text-green-700" data-testid="lb-strongest-figure">
          {{ dec1(subjects.strongest.accuracy) }}% ({{ count(subjects.strongest.answers) }} soalan)
        </p>
      </div>
      <div
        v-if="subjects.weakest"
        class="min-w-0 rounded-xl border border-red-200 bg-red-50 p-3"
        data-testid="lb-weakest"
      >
        <p class="text-xs font-bold tracking-wide text-red-700">SUBJEK PERLU PERHATIAN</p>
        <p class="mt-1 font-bold break-words text-slate-800" data-testid="lb-weakest-name">
          {{ subjects.weakest.name }}
        </p>
        <p class="text-sm text-red-700" data-testid="lb-weakest-figure">
          {{ dec1(subjects.weakest.accuracy) }}% ({{ count(subjects.weakest.answers) }} soalan)
        </p>
      </div>
    </div>

    <ul class="mt-3 divide-y divide-slate-100" data-testid="lb-subject-rows">
      <li
        v-for="r in subjects.rows"
        :key="r.name"
        class="flex min-w-0 flex-col gap-0.5 py-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
        data-testid="lb-subject-row"
      >
        <span
          class="min-w-0 text-sm font-semibold break-words text-slate-700"
          data-testid="lb-subject-name"
          >{{ r.name }}</span
        >
        <span class="text-sm text-slate-500" data-testid="lb-subject-figure"
          >{{ dec1(r.accuracy) }}% · {{ count(r.answers) }} soalan ·
          {{ count(r.pupils) }} pelajar</span
        >
      </li>
    </ul>
  </section>
</template>
