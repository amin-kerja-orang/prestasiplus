<script setup lang="ts">
/**
 * File picker on `UFileUpload`: drop zone, `accept`, a size limit in MB and an image preview.
 * Files over `maxSizeMb` are dropped from the model and reported through `reject` (and an inline
 * message). `preview="image"` shows the picked image as a thumbnail (the Nuxt UI file list);
 * `none` hides the list.
 */
import { computed, ref, useAttrs, useTemplateRef, watch } from 'vue'

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
    /** `area` = drop zone (default); `button` = one compact button (per-row pickers). */
    variant?: 'area' | 'button'
    /** Phosphor class of the button variant. */
    icon?: string
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
    variant: 'area',
    icon: undefined,
  },
)

defineOptions({ inheritAttrs: false })
const attrs = useAttrs()
/** `class` styles the field; every other attribute (`data-testid`, `id`, ...) lands on the file input. */
const inputAttrs = computed(() =>
  Object.fromEntries(Object.entries(attrs).filter(([k]) => k !== 'class' && k !== 'style')),
)
const emit = defineEmits<{ reject: [files: File[]] }>()
const model = defineModel<File | File[] | null>({ default: null })
const tooLarge = ref('')
const root = useTemplateRef<HTMLElement>('root')

// A cleared model (remove button, reset) also empties the native input, so the same file can be picked again.
watch(model, (v) => {
  if (v && !(Array.isArray(v) && v.length === 0)) return
  const input = root.value?.querySelector<HTMLInputElement>('input[type="file"]')
  if (input) input.value = ''
})

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
  <div ref="root" class="flex min-w-0 flex-col gap-2" :class="attrs.class" data-ds="file-field">
    <UFileUpload
      v-bind="inputAttrs"
      :model-value="model"
      :accept="accept"
      :multiple="multiple"
      :label="label ?? dsCopy.fileDrop"
      :description="hint"
      :required="required"
      :disabled="disabled"
      :name="name"
      :variant="variant"
      :icon="icon"
      :preview="preview === 'image'"
      :file-image="preview === 'image'"
      @update:model-value="onUpdate"
    >
      <!-- A custom trigger (compact button) replaces the drop zone; `open` starts the file dialog. -->
      <template v-if="$slots.default" #default="slotProps">
        <slot v-bind="slotProps" />
      </template>
    </UFileUpload>
    <p v-if="tooLarge" class="text-caption text-error" role="alert" data-testid="field-error">
      {{ tooLarge }}
    </p>
  </div>
</template>
