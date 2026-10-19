<script setup lang="ts">
/**
 * One topic row of S1 (FR-M03-12..16, 20, 21): chevron (closed by default), `List` icon, "Topik {n}: {name}",
 * description, "Edit Topik" link and "Padam Topik" button. The subtopic area (list, "Tambah Subtopik"
 * toggle and add form) is created on the first open and then only shown/hidden, so the typed values of
 * the inline forms survive "Batal" (OBSERVED). At most one subtopic per topic is in edit mode.
 */
import { reactive, ref } from 'vue'

import type { TopicNode } from '../../api/admin-curriculum'
import { orNull, topicEditTo, topicHeading } from '../../lib/curriculum-paths'
import { useTreeActions } from '../../lib/tree-actions'
import SubtopicItem from './SubtopicItem.vue'
import { DsStack, DsText } from '@/ds'

const props = defineProps<{ topic: TopicNode }>()

const actions = useTreeActions()

const open = ref(false)
/** The area is built on the first open (large trees have hundreds of topics) and then kept. */
const opened = ref(false)
const showAdd = ref(false)
const editingSubtopic = ref<number | null>(null)

function toggle(): void {
  open.value = !open.value
  if (open.value) opened.value = true
}

const add = reactive({ name: '', nameEn: '', learningObjective: '' })

async function submitAdd(): Promise<void> {
  await actions.addSubtopic(props.topic.id, {
    name: add.name,
    nameEn: orNull(add.nameEn),
    learningObjective: orNull(add.learningObjective),
  })
}
</script>

<template>
  <UCard variant="subtle" :data-topic-id="topic.id" data-testid="topic">
    <div class="flex items-start gap-1 sm:gap-2">
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        :icon="open ? 'i-ph-caret-down' : 'i-ph-caret-right'"
        :aria-label="open ? 'Tutup subtopik' : 'Buka subtopik'"
        :aria-expanded="open"
        class="size-11 shrink-0 justify-center"
        data-testid="topic-toggle"
        @click="toggle"
      />
      <UIcon name="i-ph-list" class="mt-3 size-5 shrink-0 text-muted" />
      <div class="min-w-0 flex-1 py-2">
        <h4 class="text-body break-words text-highlighted" data-testid="topic-heading">
          {{ topicHeading(topic) }}
        </h4>
        <p
          v-if="topic.description"
          class="mt-1 text-caption break-words text-muted"
          data-testid="topic-description"
        >
          {{ topic.description }}
        </p>
      </div>
      <UButton
        :to="topicEditTo(topic.id)"
        title="Edit Topik"
        aria-label="Edit Topik"
        color="neutral"
        variant="ghost"
        icon="i-ph-pencil-simple"
        class="size-11 shrink-0 justify-center"
        data-testid="topic-edit"
      />
      <UButton
        type="button"
        title="Padam Topik"
        aria-label="Padam Topik"
        color="error"
        variant="ghost"
        icon="i-ph-trash"
        class="size-11 shrink-0 justify-center"
        data-testid="topic-delete"
        @click="actions.deleteTopic(topic)"
      />
    </div>

    <div
      v-if="opened"
      v-show="open"
      class="mt-2 ml-2 flex flex-col gap-2 sm:ml-6"
      data-testid="topic-subtopics"
    >
      <DsText v-if="topic.subtopics.length === 0" variant="caption">Tiada subtopik</DsText>
      <SubtopicItem
        v-for="s in topic.subtopics"
        :key="s.id"
        :subtopic="s"
        :editing="editingSubtopic === s.id"
        @edit="editingSubtopic = s.id"
        @cancel="editingSubtopic = null"
      />

      <div>
        <UButton
          type="button"
          color="neutral"
          variant="link"
          :icon="showAdd ? 'i-ph-minus' : 'i-ph-plus'"
          class="min-h-11"
          data-testid="subtopic-add-toggle"
          @click="showAdd = !showAdd"
        >
          {{ showAdd ? 'Batal' : 'Tambah Subtopik' }}
        </UButton>
      </div>

      <DsStack
        v-show="showAdd"
        method="post"
        as="form"
        gap="xs"
        data-testid="subtopic-add-form"
        @submit.prevent="submitAdd"
      >
        <UInput
          v-model="add.name"
          type="text"
          name="name"
          required
          placeholder="Nama Subtopik (BM)"
          aria-label="Nama Subtopik (BM)"
          class="w-full"
          data-testid="subtopic-add-name"
        />
        <UInput
          v-model="add.nameEn"
          type="text"
          name="name_en"
          placeholder="Nama Subtopik (EN)"
          aria-label="Nama Subtopik (EN)"
          class="w-full"
          data-testid="subtopic-add-name-en"
        />
        <UTextarea
          v-model="add.learningObjective"
          name="learning_objective"
          :rows="2"
          placeholder="Objektif Pembelajaran"
          aria-label="Objektif Pembelajaran"
          class="w-full"
          data-testid="subtopic-add-objective"
        />
        <div>
          <UButton
            type="submit"
            icon="i-ph-plus"
            class="min-h-11"
            data-testid="subtopic-add-submit"
          >
            Tambah Subtopik
          </UButton>
        </div>
      </DsStack>
    </div>
  </UCard>
</template>
