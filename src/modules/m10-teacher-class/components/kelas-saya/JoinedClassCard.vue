<script setup lang="ts">
/** One joined class (PROPOSED card, FN-M10-3.4.3): class name, subject, teacher, level. */
import { BookOpen, GraduationCap, UserRound } from '@lucide/vue'

import type { JoinedClass } from '../../api/types'

defineProps<{ item: JoinedClass }>()
</script>

<template>
  <li class="min-w-0 rounded-2xl bg-white p-4 shadow-sm" data-testid="joined-class">
    <h3
      class="font-heading text-base font-bold break-words text-slate-800"
      data-testid="class-name"
    >
      {{ item.name }}
    </h3>
    <ul class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
      <li
        v-if="item.subjectName"
        class="inline-flex items-center gap-1.5"
        data-testid="class-subject"
      >
        <BookOpen class="h-4 w-4 shrink-0 text-emerald-500" />
        {{ item.subjectName }}
      </li>
      <li
        v-if="item.teacherName"
        class="inline-flex items-center gap-1.5"
        data-testid="class-teacher"
      >
        <UserRound class="h-4 w-4 shrink-0 text-teal-500" />
        {{ item.teacherName }}
      </li>
      <li class="inline-flex items-center gap-1.5" data-testid="class-level">
        <GraduationCap class="h-4 w-4 shrink-0 text-indigo-500" />
        {{ item.levelLabel }}
      </li>
    </ul>
  </li>
</template>
