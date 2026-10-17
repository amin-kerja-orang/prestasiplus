<script setup lang="ts">
/**
 * Image chooser of S22 (FN-M10-7.2.7, 7.2.8, DV-M10-21). `question`: "Muat Naik" (file
 * `question_image`), "Galeri Rajah" and the hint; `option`: a small image button per answer option.
 * A chosen file shows a preview and a remove button. Only an image the user uploads at runtime is
 * ever shown (D22). The buttons wrap below 640px so the page never scrolls sideways at 375px.
 */
import { ref, watch } from 'vue'

import NativeFile from '../native/NativeFile.vue'
import PreviewImage from '../native/PreviewImage.vue'

defineProps<{
  variant: 'question' | 'option'
  /** Names the input (`question_image`, `options[i][image]`) and the test ids. */
  name: string
  testid: string
}>()

const file = defineModel<File | null>('file', { required: true })
const emit = defineEmits<{ gallery: [] }>()

const input = ref<{ el: HTMLInputElement | null } | null>(null)
const preview = ref<string | null>(null)

watch(
  file,
  (next) => {
    if (next === null) {
      preview.value = null
      if (input.value?.el) input.value.el.value = ''
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (file.value === next && typeof reader.result === 'string') preview.value = reader.result
    }
    reader.readAsDataURL(next)
  },
  { immediate: true },
)

function onChange(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <UButton as="label" color="neutral" variant="soft" class="min-h-11">
        <UIcon
          :name="variant === 'question' ? 'i-ph-upload-simple-duotone' : 'i-ph-image-duotone'"
          class="size-4"
        />
        <span>
          {{ variant === 'question' ? 'Muat Naik' : 'Gambar' }}
        </span>
        <NativeFile
          ref="input"
          hidden
          :name="name"
          accept="image/*"
          :data-testid="`${testid}-input`"
          @change="onChange"
        />
      </UButton>
      <UButton
        v-if="variant === 'question'"
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-images-duotone"
        class="min-h-11"
        data-testid="galeri-open"
        @click="emit('gallery')"
        >Galeri Rajah</UButton
      >
      <span v-if="variant === 'question'" class="text-caption text-muted">
        Muat naik imej soalan (pilihan)
      </span>
    </div>
    <div
      v-if="preview"
      class="mt-2 flex min-w-0 items-start gap-2"
      :data-testid="`${testid}-preview`"
    >
      <PreviewImage :src="preview" alt="Pratonton imej" />
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        icon="i-ph-x"
        aria-label="Buang imej"
        class="size-11 shrink-0 justify-center"
        :data-testid="`${testid}-remove`"
        @click="file = null"
      />
    </div>
  </div>
</template>
