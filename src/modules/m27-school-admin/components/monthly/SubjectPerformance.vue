<script setup lang="ts">
/**
 * S4 "Prestasi Mengikut Subjek" (restyle spec AS-50): the strongest and weakest subject as two quiet cards
 * (semantic badge with icon and word), a `DsChart` of horizontal bars of the accuracy per subject, and the
 * per-subject rows with accuracy, questions and pupils so that every figure stays readable.
 */
import { computed } from 'vue'

import { DsChart, DsPanel } from '@/ds'

import type { MonthlyReport } from '../../api/school-admin'
import { count, dec1 } from './monthly-format'

const props = defineProps<{ subjects: MonthlyReport['subjects'] }>()

const labels = computed(() => props.subjects.rows.map((r) => r.name))
const series = computed(() => [
  { label: 'Ketepatan', data: props.subjects.rows.map((r) => Math.round(r.accuracy * 10) / 10) },
])
</script>

<template>
  <DsPanel data-testid="lb-subjects">
    <div class="flex flex-col gap-4">
      <h2 class="text-subheading text-highlighted" data-testid="lb-subjects-title">
        Prestasi Mengikut Subjek
      </h2>

      <div class="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <DsPanel v-if="subjects.strongest" tone="inset" data-testid="lb-strongest">
          <UBadge
            color="success"
            variant="soft"
            icon="i-ph-trend-up"
            label="SUBJEK TERKUAT"
          />
          <p class="mt-2 text-label break-words text-highlighted" data-testid="lb-strongest-name">
            {{ subjects.strongest.name }}
          </p>
          <p class="tabular text-body text-muted" data-testid="lb-strongest-figure">
            {{ dec1(subjects.strongest.accuracy) }}% ({{ count(subjects.strongest.answers) }}
            soalan)
          </p>
        </DsPanel>
        <DsPanel v-if="subjects.weakest" tone="inset" data-testid="lb-weakest">
          <UBadge
            color="error"
            variant="soft"
            icon="i-ph-trend-down"
            label="SUBJEK PERLU PERHATIAN"
          />
          <p class="mt-2 text-label break-words text-highlighted" data-testid="lb-weakest-name">
            {{ subjects.weakest.name }}
          </p>
          <p class="tabular text-body text-muted" data-testid="lb-weakest-figure">
            {{ dec1(subjects.weakest.accuracy) }}% ({{ count(subjects.weakest.answers) }} soalan)
          </p>
        </DsPanel>
      </div>

      <DsChart
        type="bar"
        horizontal
        unit="%"
        title="Ketepatan mengikut subjek"
        table-label="Ketepatan mengikut subjek"
        :labels="labels"
        :series="series"
        data-testid="lb-subjects-chart"
      />

      <ul class="flex flex-col" data-testid="lb-subject-rows">
        <li
          v-for="r in subjects.rows"
          :key="r.name"
          class="flex min-w-0 flex-col gap-1 py-2 even:bg-soft sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          data-testid="lb-subject-row"
        >
          <span class="min-w-0 text-label break-words text-highlighted" data-testid="lb-subject-name">{{
            r.name
          }}</span>
          <span class="tabular text-caption text-muted" data-testid="lb-subject-figure"
            >{{ dec1(r.accuracy) }}% · {{ count(r.answers) }} soalan ·
            {{ count(r.pupils) }} pelajar</span
          >
        </li>
      </ul>
    </div>
  </DsPanel>
</template>
