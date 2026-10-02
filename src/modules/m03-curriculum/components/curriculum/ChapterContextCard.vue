<script setup lang="ts">
/** S4/S5 chapter context card (FR-M03-32): tile, label "Bab", heading "Bab {n}: {name}", subject and level chips. */
import { Book, BookOpen, GraduationCap } from '@lucide/vue'

import type { ChapterDetail } from '../../api/admin-curriculum'
import { chapterHeading } from '../../lib/curriculum-paths'

defineProps<{ chapter: ChapterDetail }>()
</script>

<template>
  <div
    class="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50 p-4"
    data-testid="chapter-context"
  >
    <div
      class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-white"
    >
      <BookOpen class="h-5 w-5" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="text-xs font-semibold text-indigo-600">Bab</p>
      <h2 class="font-heading text-base font-bold break-words text-slate-800">
        {{ chapterHeading(chapter) }}
      </h2>
      <div class="mt-2 flex flex-wrap gap-2 text-xs">
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-1 font-semibold text-blue-700"
          data-testid="context-subject"
        >
          <Book class="h-3.5 w-3.5" />{{ chapter.subject.name }}
        </span>
        <span
          class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-2.5 py-1 font-semibold text-purple-700"
          data-testid="context-level"
        >
          <GraduationCap class="h-3.5 w-3.5" />{{ chapter.level.name }}
        </span>
      </div>
    </div>
  </div>
</template>
