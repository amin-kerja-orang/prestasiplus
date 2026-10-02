<script setup lang="ts">
/**
 * S1 summary cards (FR-M03-05): "Subjek" (blue), "Tahap" (purple), "Jumlah Bab" (emerald) and
 * "Topik / Subtopik" (amber). 2 across below `md`, 4 from `md`; long names wrap.
 */
import { Book, BookOpen, GraduationCap, List } from '@lucide/vue'

import type { CurriculumTree } from '../../api/admin-curriculum'

defineProps<{ tree: CurriculumTree }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4" data-testid="curriculum-stats">
    <div class="min-w-0 rounded-2xl bg-white p-3 shadow sm:p-4" data-testid="stat-subject">
      <div class="flex items-center gap-2">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-500 text-white"
        >
          <Book class="h-4 w-4" />
        </div>
        <p class="text-xs font-semibold text-blue-600">Subjek</p>
      </div>
      <p class="mt-2 font-heading text-base font-bold break-words text-slate-800 sm:text-lg">
        {{ tree.subject.name }}
      </p>
    </div>
    <div class="min-w-0 rounded-2xl bg-white p-3 shadow sm:p-4" data-testid="stat-level">
      <div class="flex items-center gap-2">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-500 text-white"
        >
          <GraduationCap class="h-4 w-4" />
        </div>
        <p class="text-xs font-semibold text-purple-600">Tahap</p>
      </div>
      <p class="mt-2 font-heading text-base font-bold break-words text-slate-800 sm:text-lg">
        {{ tree.level.name }}
      </p>
    </div>
    <div class="min-w-0 rounded-2xl bg-white p-3 shadow sm:p-4" data-testid="stat-chapters">
      <div class="flex items-center gap-2">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white"
        >
          <BookOpen class="h-4 w-4" />
        </div>
        <p class="text-xs font-semibold text-emerald-600">Jumlah Bab</p>
      </div>
      <p class="mt-2 font-heading text-base font-bold text-slate-800 sm:text-lg">
        {{ tree.stats.chapters }}
      </p>
    </div>
    <div class="min-w-0 rounded-2xl bg-white p-3 shadow sm:p-4" data-testid="stat-topics">
      <div class="flex items-center gap-2">
        <div
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white"
        >
          <List class="h-4 w-4" />
        </div>
        <p class="text-xs font-semibold text-amber-600">Topik / Subtopik</p>
      </div>
      <p class="mt-2 font-heading text-base font-bold text-slate-800 sm:text-lg">
        {{ tree.stats.topics }} / {{ tree.stats.subtopics }}
      </p>
    </div>
  </div>
</template>
