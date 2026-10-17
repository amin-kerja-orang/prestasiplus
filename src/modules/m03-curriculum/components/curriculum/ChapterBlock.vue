<script setup lang="ts">
/**
 * One chapter block of S1 (FR-M03-08..10, 15): indigo left border, chevron (open by default, per block),
 * `BookOpen`, "Bab {n}: {name}", description, "Edit Bab" link, "Padam Bab" button; the chevron shows or
 * hides the topic list and the "Tambah Topik" link. Names wrap (DV-M03-06a).
 */
import { ref } from 'vue'

import type { ChapterNode } from '../../api/admin-curriculum'
import { chapterEditTo, chapterHeading, topicCreateTo } from '../../lib/curriculum-paths'
import { useTreeActions } from '../../lib/tree-actions'
import TopicBlock from './TopicBlock.vue'

defineProps<{ chapter: ChapterNode }>()

const actions = useTreeActions()
const open = ref(true)

</script>

<template>
  <UCard :data-chapter-id="chapter.id" data-testid="chapter">
    <div class="flex items-start gap-1 sm:gap-2">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :icon="open ? 'i-ph-caret-down' : 'i-ph-caret-right'"
        :aria-label="open ? 'Tutup topik' : 'Buka topik'"
        :aria-expanded="open"
        class="size-11 shrink-0 justify-center"
        data-testid="chapter-toggle"
        @click="open = !open"
      />
      <UIcon name="i-ph-book-open" class="mt-3 size-5 shrink-0 text-primary" />
      <div class="min-w-0 flex-1 py-2">
        <h3 class="text-label break-words text-highlighted" data-testid="chapter-heading">
          {{ chapterHeading(chapter) }}
        </h3>
        <p
          v-if="chapter.description"
          class="mt-1 text-caption break-words text-muted"
          data-testid="chapter-description"
        >
          {{ chapter.description }}
        </p>
      </div>
      <UButton
        :to="chapterEditTo(chapter.id)"
        title="Edit Bab"
        aria-label="Edit Bab"
        color="neutral"
        variant="ghost"
        icon="i-ph-pencil-simple"
        class="size-11 shrink-0 justify-center"
        data-testid="chapter-edit"
      />
      <UButton
        type="button"
        title="Padam Bab"
        aria-label="Padam Bab"
        color="error"
        variant="ghost"
        icon="i-ph-trash"
        class="size-11 shrink-0 justify-center"
        data-testid="chapter-delete"
        @click="actions.deleteChapter(chapter)"
      />
    </div>

    <div v-show="open" class="mt-2 ml-4 flex flex-col gap-2 sm:ml-8" data-testid="chapter-topics">
      <TopicBlock v-for="t in chapter.topics" :key="t.id" :topic="t" />
      <div>
        <UButton
          :to="topicCreateTo(chapter.id)"
          color="neutral"
          variant="link"
          icon="i-ph-plus"
          class="min-h-11"
          data-testid="topic-add"
        >
          Tambah Topik
        </UButton>
      </div>
    </div>
  </UCard>
</template>
