<script setup lang="ts">
/** FN-M10-2.1.3: four stat cards, 2 per row below lg, 4 at lg (FR-M10-10, BR-M10-06). */
import { computed } from 'vue'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'

const props = defineProps<{ stats: GuruDashboard['stats'] }>()
const cards = computed(() => [
  {
    key: 'classes',
    label: DASH_COPY.statActiveClasses,
    value: props.stats.activeClasses,
    caption: `${props.stats.totalClasses} jumlah kelas`,
    check: false,
    tone: 'from-teal-500 to-emerald-600',
  },
  {
    key: 'students',
    label: DASH_COPY.statStudents,
    value: props.stats.students,
    caption: DASH_COPY.statStudentsCaption,
    check: false,
    tone: 'from-blue-500 to-indigo-600',
  },
  {
    key: 'questions',
    label: DASH_COPY.statQuestions,
    value: props.stats.questions,
    caption: `✅ ${props.stats.questionsApproved} diluluskan`,
    check: true,
    tone: 'from-green-500 to-emerald-600',
  },
  {
    key: 'assignments',
    label: DASH_COPY.statAssignments,
    value: props.stats.assignments,
    caption: DASH_COPY.statAssignmentsCaption,
    check: false,
    tone: 'from-amber-500 to-orange-600',
  },
])
</script>

<template>
  <div class="grid min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4" data-testid="stat-cards">
    <div
      v-for="c in cards"
      :key="c.key"
      :class="['min-w-0 rounded-2xl bg-linear-to-br p-4 text-white shadow-sm sm:p-5', c.tone]"
      :data-testid="`stat-${c.key}`"
    >
      <p class="text-xs font-semibold tracking-wider uppercase">{{ c.label }}</p>
      <p class="font-heading text-3xl leading-tight font-bold" data-testid="stat-value">
        {{ c.value }}
      </p>
      <p class="flex items-center gap-1 text-xs text-white/90" data-testid="stat-caption">
        <span>{{ c.caption }}</span>
      </p>
    </div>
  </div>
</template>
