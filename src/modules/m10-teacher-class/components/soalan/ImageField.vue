<script setup lang="ts">
/**
 * Image chooser of S22 (FN-M10-7.2.7, 7.2.8, DV-M10-21). `question`: "Muat Naik" (file
 * `question_image`), "Galeri Rajah" and the hint; `option`: a small image button per answer option.
 * A chosen file shows a preview and a remove button (the `DsFileField` list). Only an image the user
 * uploads at runtime is ever shown (D22). The buttons wrap below 640px so the page never scrolls
 * sideways at 375px.
 */
import { DsFileField, DsCluster } from '@/ds'

defineProps<{
  variant: 'question' | 'option'
  /** Names the input (`question_image`, `options[i][image]`) and the test ids. */
  name: string
  testid: string
}>()

const file = defineModel<File | null>('file', { required: true })
const emit = defineEmits<{ gallery: [] }>()

function onPick(value: File | File[] | null): void {
  file.value = Array.isArray(value) ? (value[0] ?? null) : value
}
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <DsCluster gap="xs" align="start">
      <DsFileField
        :model-value="file"
        variant="button"
        :icon="variant === 'question' ? 'i-ph-upload-simple' : 'i-ph-image'"
        :label="variant === 'question' ? 'Muat Naik' : 'Gambar'"
        :name="name"
        accept="image/*"
        preview="image"
        class="w-auto"
        :data-testid="`${testid}-input`"
        @update:model-value="onPick"
      />
      <UButton
        v-if="variant === 'question'"
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-images"
        class="min-h-11"
        data-testid="galeri-open"
        @click="emit('gallery')"
        >Galeri Rajah</UButton
      >
      <span v-if="variant === 'question'" class="self-center text-caption text-muted">
        Muat naik imej soalan (pilihan)
      </span>
    </DsCluster>
  </div>
</template>
