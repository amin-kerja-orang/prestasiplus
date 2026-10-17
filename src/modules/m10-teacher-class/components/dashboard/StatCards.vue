<script setup lang="ts">
/** FN-M10-2.1.3: four stat tiles, 2 per row below lg, 4 at lg (FR-M10-10, BR-M10-06). */
import { computed } from 'vue'

import { DsStatTile } from '@/ds'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'

const props = defineProps<{ stats: GuruDashboard['stats'] }>()
const cards = computed(() => [
  {
    key: 'classes',
    label: DASH_COPY.statActiveClasses,
    value: props.stats.activeClasses,
    caption: `${props.stats.totalClasses} jumlah kelas`,
    icon: 'i-ph-chalkboard-teacher-duotone',
  },
  {
    key: 'students',
    label: DASH_COPY.statStudents,
    value: props.stats.students,
    caption: DASH_COPY.statStudentsCaption,
    icon: 'i-ph-student-duotone',
  },
  {
    key: 'questions',
    label: DASH_COPY.statQuestions,
    value: props.stats.questions,
    caption: `✅ ${props.stats.questionsApproved} diluluskan`,
    icon: 'i-ph-clipboard-text-duotone',
  },
  {
    key: 'assignments',
    label: DASH_COPY.statAssignments,
    value: props.stats.assignments,
    caption: DASH_COPY.statAssignmentsCaption,
    icon: 'i-ph-chart-bar-duotone',
  },
])
</script>

<template>
  <ul class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" data-testid="stat-cards">
    <li
      v-for="c in cards"
      :key="c.key"
      class="flex min-w-0 flex-col gap-1"
      :data-testid="`stat-${c.key}`"
    >
      <DsStatTile :value="c.value" :unit="c.label" :icon="c.icon" />
      <p class="px-3 text-caption text-muted" data-testid="stat-caption">
        <span>{{ c.caption }}</span>
      </p>
    </li>
  </ul>
</template>
