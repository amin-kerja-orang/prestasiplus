<script setup lang="ts">
/**
 * Image chooser of S22 (FN-M10-7.2.7, 7.2.8, DV-M10-21). `question`: "Muat Naik" (file
 * `question_image`), "Galeri Rajah" and the hint; `option`: a small image button per answer option.
 * A chosen file shows a preview and a remove button. Only an image the user uploads at runtime is
 * ever shown (D22). The buttons wrap below 640px so the page never scrolls sideways at 375px.
 */
import { Image as ImageIcon, Images, Upload, X } from '@lucide/vue'
import { ref, watch } from 'vue'

defineProps<{
  variant: 'question' | 'option'
  /** Names the input (`question_image`, `options[i][image]`) and the test ids. */
  name: string
  testid: string
}>()

const file = defineModel<File | null>('file', { required: true })
const emit = defineEmits<{ gallery: [] }>()

const input = ref<HTMLInputElement | null>(null)
const preview = ref<string | null>(null)

watch(
  file,
  (next) => {
    if (next === null) {
      preview.value = null
      if (input.value) input.value.value = ''
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

const BTN =
  'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold transition focus-within:ring-2 focus-within:ring-indigo-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
</script>

<template>
  <div class="min-w-0" :data-testid="testid">
    <div class="flex min-w-0 flex-wrap items-center gap-2">
      <label :class="[BTN, 'cursor-pointer bg-slate-100 text-slate-700 hover:bg-slate-200']">
        <Upload v-if="variant === 'question'" class="h-4 w-4" />
        <ImageIcon v-else class="h-4 w-4" />
        <span>
          {{ variant === 'question' ? 'Muat Naik' : 'Gambar' }}
        </span>
        <input
          ref="input"
          type="file"
          :name="name"
          accept="image/*"
          class="sr-only"
          :data-testid="`${testid}-input`"
          @change="onChange"
        />
      </label>
      <button
        v-if="variant === 'question'"
        type="button"
        :class="[BTN, 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100']"
        data-testid="galeri-open"
        @click="emit('gallery')"
      >
        <Images class="h-4 w-4" />
        Galeri Rajah
      </button>
      <span v-if="variant === 'question'" class="text-xs text-slate-500">
        Muat naik imej soalan (pilihan)
      </span>
    </div>
    <div
      v-if="preview"
      class="mt-2 flex min-w-0 items-start gap-2"
      :data-testid="`${testid}-preview`"
    >
      <img
        :src="preview"
        alt="Pratonton imej"
        class="max-h-40 max-w-full min-w-0 rounded-lg border border-slate-200 object-contain"
      />
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
        :data-testid="`${testid}-remove`"
        @click="file = null"
      >
        <X class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
