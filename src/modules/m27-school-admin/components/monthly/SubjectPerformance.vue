<script setup lang="ts">
/**
 * S4 "Prestasi Mengikut Subjek" (restyle spec AS-50): the strongest and weakest subject as two quiet cards
 * (semantic badge with icon and word), a `DsChart` of horizontal bars of the accuracy per subject, and the
 * per-subject rows with accuracy, questions and pupils so that every figure stays readable.
 */
import { computed } from 'vue'

import { DsChart, DsPanel, DsStack, DsGrid, DsHeading, DsText } from '@/ds'

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
    <DsStack>
      <DsHeading :level="2" variant="subheading" data-testid="lb-subjects-title">
        Prestasi Mengikut Subjek
      </DsHeading>

      <DsGrid :cols="{ base: 1, sm: 2 }" gap="sm">
        <DsPanel v-if="subjects.strongest" tone="inset" data-testid="lb-strongest">
          <UBadge color="success" variant="soft" icon="i-ph-trend-up" label="SUBJEK TERKUAT" />
          <p class="mt-2 text-label break-words text-highlighted" data-testid="lb-strongest-name">
            {{ subjects.strongest.name }}
          </p>
          <DsText variant="body" tone="muted" tabular data-testid="lb-strongest-figure">
            {{ dec1(subjects.strongest.accuracy) }}% ({{ count(subjects.strongest.answers) }}
            soalan)
          </DsText>
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
          <DsText variant="body" tone="muted" tabular data-testid="lb-weakest-figure">
            {{ dec1(subjects.weakest.accuracy) }}% ({{ count(subjects.weakest.answers) }} soalan)
          </DsText>
        </DsPanel>
      </DsGrid>

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

      <DsStack as="ul" gap="none" data-testid="lb-subject-rows">
        <li
          v-for="r in subjects.rows"
          :key="r.name"
          class="flex min-w-0 flex-col gap-1 py-2 even:bg-soft sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          data-testid="lb-subject-row"
        >
          <DsText
            variant="label"
            tone="highlighted"
            wrap="anywhere"
            class="min-w-0"
            data-testid="lb-subject-name"
            >{{ r.name }}</DsText
          >
          <DsText variant="caption" as="span" tabular data-testid="lb-subject-figure"
            >{{ dec1(r.accuracy) }}% · {{ count(r.answers) }} soalan ·
            {{ count(r.pupils) }} pelajar</DsText
          >
        </li>
      </DsStack>
    </DsStack>
  </DsPanel>
</template>
