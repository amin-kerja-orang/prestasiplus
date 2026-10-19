<script setup lang="ts">
/**
 * One subtopic of an open topic (FR-M03-16..19): the row (chevron icon, name, "Edit Subtopik",
 * "Padam Subtopik") and, in its place while editing, the inline purple form ("Simpan" / "Batal").
 * Both are rendered with `v-show` and the form values are kept by this component, so "Batal" only hides
 * the form and the typed text is still there when it is reopened until the page reloads (OBSERVED, AUD-01).
 */
import { reactive } from 'vue'

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

</script>

<template>
  <div data-testid="subtopic">
    <div v-show="!editing" class="flex items-center gap-1 sm:gap-2" data-testid="subtopic-row">
      <UIcon name="i-ph-caret-right" class="size-3 shrink-0 text-dimmed" />
      <span class="min-w-0 flex-1 text-body break-words text-default">{{ subtopic.name }}</span>
      <UButton
        type="button"
        title="Edit Subtopik"
        aria-label="Edit Subtopik"
        color="neutral"
        variant="ghost"
        icon="i-ph-pencil-simple"
        class="size-11 shrink-0 justify-center"
        data-testid="subtopic-edit"
        @click="emit('edit')"
      />
      <UButton
        type="button"
        title="Padam Subtopik"
        aria-label="Padam Subtopik"
        color="error"
        variant="ghost"
        icon="i-ph-trash"
        class="size-11 shrink-0 justify-center"
        data-testid="subtopic-delete"
        @click="actions.deleteSubtopic(subtopic.id)"
      />
    </div>

    <form
      v-show="editing"
      method="post"
      class="flex flex-col gap-2"
      data-testid="subtopic-edit-form"
      @submit.prevent="save"
    >
      <UInput
        v-model="form.name"
        type="text"
        name="name"
        required
        placeholder="Nama Subtopik (BM)"
        aria-label="Nama Subtopik (BM)"
        class="w-full"
        data-testid="subtopic-edit-name"
      />
      <UInput
        v-model="form.nameEn"
        type="text"
        name="name_en"
        placeholder="Nama Subtopik (EN)"
        aria-label="Nama Subtopik (EN)"
        class="w-full"
        data-testid="subtopic-edit-name-en"
      />
      <UTextarea
        v-model="form.learningObjective"
        name="learning_objective"
        :rows="2"
        placeholder="Objektif Pembelajaran"
        aria-label="Objektif Pembelajaran"
        class="w-full"
        data-testid="subtopic-edit-objective"
      />
      <div class="flex gap-2">
        <UButton type="submit" icon="i-ph-floppy-disk" class="min-h-11" data-testid="subtopic-edit-save">
          Simpan
        </UButton>
        <UButton
          type="button"
          color="neutral"
          variant="soft"
          class="min-h-11"
          data-testid="subtopic-edit-cancel"
          @click="emit('cancel')"
        >
          Batal
        </UButton>
      </div>
    </form>
  </div>
</template>
