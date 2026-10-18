<script setup lang="ts">
/**
 * File picker on `UFileUpload`: drop zone, `accept`, a size limit in MB and an image preview.
 * Files over `maxSizeMb` are dropped from the model and reported through `reject` (and an inline
 * message). `preview="image"` shows the picked image as a thumbnail (the Nuxt UI file list);
 * `none` hides the list.
 */
import { computed, ref } from 'vue'

import { dsCopy } from './copy'

const props = withDefaults(
  defineProps<{
    accept?: string
    maxSizeMb?: number
    multiple?: boolean
    preview?: 'none' | 'image'
    label?: string
    hint?: string
    required?: boolean
    disabled?: boolean
    name?: string
  }>(),
  {
    accept: undefined,
    maxSizeMb: undefined,
    multiple: false,
    preview: 'image',
    label: undefined,
    hint: undefined,
    required: false,
    disabled: false,
    name: undefined,
  },
)

const emit = defineEmits<{ reject: [files: File[]] }>()
const model = defineModel<File | File[] | null>({ default: null })
const tooLarge = ref('')

const limit = computed(() => (props.maxSizeMb ? props.maxSizeMb * 1024 * 1024 : Infinity))

function onUpdate(value: File | File[] | null | undefined): void {
  tooLarge.value = ''
  if (!value) {
    model.value = null
    return
  }
  const list = Array.isArray(value) ? value : [value]
  const ok = list.filter((f) => f.size <= limit.value)
  const bad = list.filter((f) => f.size > limit.value)
  if (bad.length) {
    tooLarge.value = dsCopy.fileTooLarge.replace('{n}', String(props.maxSizeMb))
    emit('reject', bad)
  }
  model.value = props.multiple ? ok : (ok[0] ?? null)
}
</script>

<template>
  <div class="flex min-w-0 flex-col gap-2" data-ds="file-field">
    <UFileUpload
      :model-value="model"
      :accept="accept"
      :multiple="multiple"
      :label="label ?? dsCopy.fileDrop"
      :description="hint"
      :required="required"
      :disabled="disabled"
      :name="name"
      :preview="preview === 'image'"
      :file-image="preview === 'image'"
      @update:model-value="onUpdate"
    />
    <p v-if="tooLarge" class="text-caption text-error" role="alert" data-testid="field-error">
      {{ tooLarge }}
    </p>
  </div>
</template>
