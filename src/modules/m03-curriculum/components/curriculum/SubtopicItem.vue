<script setup lang="ts">
/**
 * One subtopic of an open topic (FR-M03-16..19): the row (chevron icon, name, "Edit Subtopik",
 * "Padam Subtopik") and, in its place while editing, the inline purple form ("Simpan" / "Batal").
 * Both are rendered with `v-show` and the form values are kept by this component, so "Batal" only hides
 * the form and the typed text is still there when it is reopened until the page reloads (OBSERVED, AUD-01).
 */
import { ChevronRight, Save, SquarePen, Trash } from '@lucide/vue'
import { reactive } from 'vue'

import { FORM_INPUT_CLASS, FORM_TEXTAREA_CLASS } from '@/components/form'

import type { CurriculumSubtopic } from '../../api/admin-curriculum'
import { orNull } from '../../lib/curriculum-paths'
import { useTreeActions } from '../../lib/tree-actions'

const props = defineProps<{ subtopic: CurriculumSubtopic; editing: boolean }>()
const emit = defineEmits<{ edit: []; cancel: [] }>()

const actions = useTreeActions()

const form = reactive({
  name: props.subtopic.name,
  nameEn: props.subtopic.nameEn ?? '',
  learningObjective: props.subtopic.learningObjective ?? '',
})

async function save(): Promise<void> {
  await actions.saveSubtopic(props.subtopic.id, {
    name: form.name,
    nameEn: orNull(form.nameEn),
    learningObjective: orNull(form.learningObjective),
  })
}

const ICON_BTN =
  'inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-400 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 lg:min-h-8 lg:min-w-8'
</script>

<template>
  <div data-testid="subtopic">
    <div
      v-show="!editing"
      class="flex items-center gap-1 rounded-lg bg-white px-2 py-1 sm:gap-2"
      data-testid="subtopic-row"
    >
      <ChevronRight class="h-3 w-3 shrink-0 text-slate-400" />
      <span class="min-w-0 flex-1 text-xs break-words text-slate-700 sm:text-sm">{{
        subtopic.name
      }}</span>
      <button
        type="button"
        title="Edit Subtopik"
        :class="[ICON_BTN, 'hover:bg-indigo-50 hover:text-indigo-600']"
        data-testid="subtopic-edit"
        @click="emit('edit')"
      >
        <SquarePen class="h-4 w-4" />
      </button>
      <button
        type="button"
        title="Padam Subtopik"
        :class="[ICON_BTN, 'hover:bg-red-50 hover:text-red-600']"
        data-testid="subtopic-delete"
        @click="actions.deleteSubtopic(subtopic.id)"
      >
        <Trash class="h-4 w-4" />
      </button>
    </div>

    <form
      v-show="editing"
      method="post"
      class="space-y-2 rounded-lg border border-purple-200 bg-purple-50 p-2.5 sm:p-3"
      data-testid="subtopic-edit-form"
      @submit.prevent="save"
    >
      <input
        v-model="form.name"
        type="text"
        name="name"
        required
        placeholder="Nama Subtopik (BM)"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="subtopic-edit-name"
      />
      <input
        v-model="form.nameEn"
        type="text"
        name="name_en"
        placeholder="Nama Subtopik (EN)"
        :class="[FORM_INPUT_CLASS, 'min-h-11']"
        data-testid="subtopic-edit-name-en"
      />
      <textarea
        v-model="form.learningObjective"
        name="learning_objective"
        rows="2"
        placeholder="Objektif Pembelajaran"
        :class="[FORM_TEXTAREA_CLASS, 'px-3.5 py-2.5']"
        data-testid="subtopic-edit-objective"
      ></textarea>
      <div class="flex gap-2">
        <button
          type="submit"
          class="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg bg-purple-600 px-4 text-xs font-bold text-white transition hover:bg-purple-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 sm:text-sm"
          data-testid="subtopic-edit-save"
        >
          <Save class="h-4 w-4" />
          Simpan
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300 sm:text-sm"
          data-testid="subtopic-edit-cancel"
          @click="emit('cancel')"
        >
          Batal
        </button>
      </div>
    </form>
  </div>
</template>
