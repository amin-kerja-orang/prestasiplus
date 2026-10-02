<script setup lang="ts">
/**
 * One set of S34 (PROPOSED row, FN-M10-5.7.2): title, teacher, "{n} soalan", optional time limit and
 * attempts, and "Mula" to the M05 quiz.  "Mula" is always a link: M05 Q6 answers a set with no attempt left (409).
 */
import { ClipboardList, Clock, Play, RotateCcw, UserRound } from '@lucide/vue'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { StudentQuestionSet } from '../../api/types'
import { SET_COPY } from './copy'
import { attemptsLabel, questionCountLabel, quizPath, timeLimitLabel } from './format'

const props = defineProps<{ item: StudentQuestionSet }>()

const time = computed(() => timeLimitLabel(props.item.timeLimitMinutes))

const START =
  'inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold sm:w-auto'
const START_ON =
  'bg-indigo-500 text-white transition hover:bg-indigo-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <li
    class="flex min-w-0 flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
    data-testid="set-row"
  >
    <div class="min-w-0">
      <h3
        class="font-heading text-base font-bold break-words text-slate-800"
        data-testid="set-title"
      >
        {{ item.title }}
      </h3>
      <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <li
          v-if="item.teacherName"
          class="inline-flex items-center gap-1.5"
          data-testid="set-teacher"
        >
          <UserRound class="h-4 w-4 shrink-0 text-teal-500" />
          {{ item.teacherName }}
        </li>
        <li class="inline-flex items-center gap-1.5" data-testid="set-count">
          <ClipboardList class="h-4 w-4 shrink-0 text-cyan-500" />
          {{ questionCountLabel(item.questionCount) }}
        </li>
        <li v-if="time" class="inline-flex items-center gap-1.5" data-testid="set-time">
          <Clock class="h-4 w-4 shrink-0 text-amber-500" />
          {{ time }}
        </li>
        <li class="inline-flex items-center gap-1.5" data-testid="set-attempts">
          <RotateCcw class="h-4 w-4 shrink-0 text-indigo-500" />
          {{ attemptsLabel(item.attemptsLeft) }}
        </li>
      </ul>
    </div>
    <RouterLink :to="quizPath(item.id)" :class="[START, START_ON]" data-testid="set-start">
      <Play class="h-4 w-4" />
      {{ SET_COPY.start }}
    </RouterLink>
  </li>
</template>
