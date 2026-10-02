<script setup lang="ts">
/**
 * One topic row of S1 (FR-M03-12..16, 20, 21): chevron (closed by default), `List` icon, "Topik {n}: {name}",
 * description, "Edit Topik" link and "Padam Topik" button. The subtopic area (list, "Tambah Subtopik"
 * toggle and add form) is created on the first open and then only shown/hidden, so the typed values of
 * the inline forms survive "Batal" (OBSERVED). At most one subtopic per topic is in edit mode.
 */
import { ChevronDown, ChevronRight, List, Minus, Plus, SquarePen, Trash } from '@lucide/vue'
import { reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

import type { TopicNode } from '../../api/admin-curriculum'
import { orNull, topicEditTo, topicHeading } from '../../lib/curriculum-paths'
import { useTreeActions } from '../../lib/tree-actions'
import SubtopicItem from './SubtopicItem.vue'

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

const ICON_BTN =
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-8 lg:min-w-8'
</script>

<template>
  <div
    class="rounded-xl border border-slate-200 bg-white p-2.5 sm:p-4"
    :data-topic-id="topic.id"
    data-testid="topic"
  >
    <div class="flex items-start gap-1 sm:gap-2">
      <button
        type="button"
        :class="[ICON_BTN, 'text-slate-500 hover:bg-slate-100']"
        data-testid="topic-toggle"
        @click="toggle"
      >
        <ChevronDown v-if="open" class="h-4 w-4" />
        <ChevronRight v-else class="h-4 w-4" />
      </button>
      <List class="mt-3.5 h-4 w-4 shrink-0 text-purple-500 lg:mt-2.5" />
      <div class="min-w-0 flex-1 py-2.5 lg:py-1.5">
        <h4
          class="text-xs font-semibold break-words text-slate-800 sm:text-sm"
          data-testid="topic-heading"
        >
          {{ topicHeading(topic) }}
        </h4>
        <p
          v-if="topic.description"
          class="mt-0.5 text-xs break-words text-slate-500"
          data-testid="topic-description"
        >
          {{ topic.description }}
        </p>
      </div>
      <RouterLink
        :to="topicEditTo(topic.id)"
        title="Edit Topik"
        :class="[ICON_BTN, 'hover:bg-indigo-50 hover:text-indigo-600']"
        data-testid="topic-edit"
      >
        <SquarePen class="h-4 w-4" />
      </RouterLink>
      <button
        type="button"
        title="Padam Topik"
        :class="[ICON_BTN, 'hover:bg-red-50 hover:text-red-600']"
        data-testid="topic-delete"
        @click="actions.deleteTopic(topic)"
      >
        <Trash class="h-4 w-4" />
      </button>
    </div>

    <div
      v-if="opened"
      v-show="open"
      class="mt-2 ml-2 space-y-2 border-l-2 border-purple-200 pl-2 sm:ml-6 sm:pl-4"
      data-testid="topic-subtopics"
    >
      <p v-if="topic.subtopics.length === 0" class="text-xs text-slate-400 italic sm:text-sm">
        Tiada subtopik
      </p>
      <SubtopicItem
        v-for="s in topic.subtopics"
        :key="s.id"
        :subtopic="s"
        :editing="editingSubtopic === s.id"
        @edit="editingSubtopic = s.id"
        @cancel="editingSubtopic = null"
      />

      <button
        type="button"
        class="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-purple-600 transition hover:bg-purple-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 sm:text-sm lg:min-h-8"
        data-testid="subtopic-add-toggle"
        @click="showAdd = !showAdd"
      >
        <Minus v-if="showAdd" class="h-4 w-4" />
        <Plus v-else class="h-4 w-4" />
        {{ showAdd ? 'Batal' : 'Tambah Subtopik' }}
      </button>

      <form
        v-show="showAdd"
        method="post"
        class="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-2.5 sm:p-3"
        data-testid="subtopic-add-form"
        @submit.prevent="submitAdd"
      >
        <input type="hidden" name="curriculum_topic_id" :value="topic.id" />
        <input
          v-model="add.name"
          type="text"
          name="name"
          required
          placeholder="Nama Subtopik (BM)"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="subtopic-add-name"
        />
        <input
          v-model="add.nameEn"
          type="text"
          name="name_en"
          placeholder="Nama Subtopik (EN)"
          :class="[FORM_INPUT_CLASS, 'min-h-11']"
          data-testid="subtopic-add-name-en"
        />
        <textarea
          v-model="add.learningObjective"
          name="learning_objective"
          rows="2"
          placeholder="Objektif Pembelajaran"
          :class="[FORM_TEXTAREA_CLASS, 'px-3.5 py-2.5']"
          data-testid="subtopic-add-objective"
        ></textarea>
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 text-xs font-bold text-white transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 sm:text-sm"
          data-testid="subtopic-add-submit"
        >
          <Plus class="h-4 w-4" />
          Tambah Subtopik
        </button>
      </form>
    </div>
  </div>
</template>
