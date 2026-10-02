<script setup lang="ts">
/**
 * One chapter block of S1 (FR-M03-08..10, 15): indigo left border, chevron (open by default, per block),
 * `BookOpen`, "Bab {n}: {name}", description, "Edit Bab" link, "Padam Bab" button; the chevron shows or
 * hides the topic list and the "Tambah Topik" link. Names wrap (DV-M03-06a).
 */
import { BookOpen, ChevronDown, ChevronRight, Plus, SquarePen, Trash } from '@lucide/vue'
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

import type { ChapterNode } from '../../api/admin-curriculum'
import { chapterEditTo, chapterHeading, topicCreateTo } from '../../lib/curriculum-paths'
import { useTreeActions } from '../../lib/tree-actions'
import TopicBlock from './TopicBlock.vue'

defineProps<{ chapter: ChapterNode }>()

const actions = useTreeActions()
const open = ref(true)

const ICON_BTN =
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-8 lg:min-w-8'
</script>

<template>
  <section
    class="rounded-r-xl border-l-4 border-indigo-500 bg-slate-50 p-2.5 sm:p-4"
    :data-chapter-id="chapter.id"
    data-testid="chapter"
  >
    <div class="flex items-start gap-1 sm:gap-2">
      <button
        type="button"
        :class="[ICON_BTN, 'text-slate-500 hover:bg-slate-200']"
        data-testid="chapter-toggle"
        @click="open = !open"
      >
        <ChevronDown v-if="open" class="h-4 w-4" />
        <ChevronRight v-else class="h-4 w-4" />
      </button>
      <BookOpen class="mt-3.5 h-4 w-4 shrink-0 text-indigo-500 lg:mt-2.5" />
      <div class="min-w-0 flex-1 py-2.5 lg:py-1.5">
        <h3
          class="text-sm font-bold break-words text-slate-800 sm:text-base"
          data-testid="chapter-heading"
        >
          {{ chapterHeading(chapter) }}
        </h3>
        <p
          v-if="chapter.description"
          class="mt-0.5 text-xs break-words text-slate-500 sm:text-sm"
          data-testid="chapter-description"
        >
          {{ chapter.description }}
        </p>
      </div>
      <RouterLink
        :to="chapterEditTo(chapter.id)"
        title="Edit Bab"
        :class="[ICON_BTN, 'hover:bg-indigo-50 hover:text-indigo-600']"
        data-testid="chapter-edit"
      >
        <SquarePen class="h-4 w-4" />
      </RouterLink>
      <button
        type="button"
        title="Padam Bab"
        :class="[ICON_BTN, 'hover:bg-red-50 hover:text-red-600']"
        data-testid="chapter-delete"
        @click="actions.deleteChapter(chapter)"
      >
        <Trash class="h-4 w-4" />
      </button>
    </div>

    <div v-show="open" class="mt-2 ml-4 space-y-2 sm:ml-8" data-testid="chapter-topics">
      <TopicBlock v-for="t in chapter.topics" :key="t.id" :topic="t" />
      <RouterLink
        :to="topicCreateTo(chapter.id)"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-indigo-600 transition hover:bg-indigo-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 sm:text-sm lg:min-h-8"
        data-testid="topic-add"
      >
        <Plus class="h-4 w-4" />
        Tambah Topik
      </RouterLink>
    </div>
  </section>
</template>
