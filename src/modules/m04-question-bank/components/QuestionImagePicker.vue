<script setup lang="ts">
/**
 * Image picker of S2 / S4 (FR-M04-20, 51; FN-M04-1.2.6, 1.2.7, 1.7.5): the question image as a dashed
 * drop-zone label and the option images as a small "Gambar" chip. A chosen file shows a FileReader
 * preview with a `fa-times` remove button that clears the input; the prompt returns after removal.
 * On S4 the saved image is the preview until removed or replaced (INFERRED); a `blob:mock/...`
 * placeholder is shown as a neutral box. The zone reads "Tukar gambar" once a new file is chosen on S4.
 * Type and size are checked by the server only (accept list as live).
 */
import { CloudUpload, Image as ImageIcon, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { imageSrc } from '../lib/image-url'

const props = withDefaults(
  defineProps<{
    variant: 'zone' | 'chip'
    /** The saved image (S4). */
    saved?: string | null
    edit?: boolean
    testid: string
  }>(),
  { saved: null, edit: false },
)

const file = defineModel<File | null>('file', { required: true })
const removed = defineModel<boolean>('removed', { default: false })

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

const hasSaved = computed(() => props.saved !== null && props.saved !== '' && !removed.value)
const shown = computed(() => (file.value !== null ? 'new' : hasSaved.value ? 'saved' : 'none'))

function onChange(event: Event): void {
  const picked = (event.target as HTMLInputElement).files?.[0] ?? null
  file.value = picked
  if (picked) removed.value = false
}

function remove(): void {
  if (input.value) input.value.value = ''
  if (file.value !== null) {
    // Clears the pending file; a saved image underneath shows again.
    file.value = null
    preview.value = null
  } else if (hasSaved.value) {
    removed.value = true
  }
}

const zoneText = computed(() =>
  props.edit && file.value !== null ? 'Tukar gambar' : 'Klik untuk muat naik gambar',
)
const hideZoneText = computed(() => !props.edit && shown.value === 'new')
</script>

<template>
  <div v-if="variant === 'zone'" :data-testid="testid">
    <label
      class="relative flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 px-4 py-5 text-center transition focus-within:border-indigo-400 hover:border-indigo-300 hover:bg-indigo-50/40"
    >
      <template v-if="shown !== 'none'">
        <img
          v-if="shown === 'new' && preview"
          :src="preview"
          alt=""
          class="max-h-48 max-w-full rounded-lg object-contain"
          :data-testid="`${testid}-preview`"
        />
        <img
          v-else-if="shown === 'saved' && saved"
          :src="imageSrc(saved ?? '')"
          alt=""
          class="max-h-48 max-w-full rounded-lg object-contain"
          :data-testid="`${testid}-preview`"
        />
        <span
          v-else
          class="flex h-24 w-32 items-center justify-center rounded-lg bg-slate-100 text-slate-400"
          :data-testid="`${testid}-preview`"
        >
          <ImageIcon class="h-8 w-8" aria-hidden="true" />
        </span>
        <button
          type="button"
          class="absolute top-2 right-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-red-500 text-white shadow transition after:absolute after:-inset-1.5 hover:bg-red-600"
          :data-testid="`${testid}-remove`"
          @click.prevent.stop="remove"
        >
          <X class="h-4 w-4" aria-hidden="true" />
        </button>
      </template>
      <template v-if="!hideZoneText">
        <CloudUpload class="h-6 w-6 text-slate-400" aria-hidden="true" />
        <span class="text-sm text-slate-500" :data-testid="`${testid}-text`">{{ zoneText }}</span>
        <span v-if="!(edit && file !== null)" class="text-xs text-slate-400">
          JPG, PNG, WebP — Maks 2MB
        </span>
      </template>
      <input
        ref="input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        :data-testid="`${testid}-input`"
        @change="onChange"
      />
    </label>
  </div>

  <div v-else :data-testid="testid" class="min-w-0">
    <label
      class="relative inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-600 transition focus-within:border-indigo-400 hover:bg-slate-100"
    >
      <ImageIcon class="h-3.5 w-3.5 text-indigo-500" aria-hidden="true" />
      Gambar
      <input
        ref="input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        :data-testid="`${testid}-input`"
        @change="onChange"
      />
    </label>
    <div v-if="shown !== 'none'" class="relative mt-2 inline-block max-w-full align-top">
      <img
        v-if="shown === 'new' && preview"
        :src="preview"
        alt=""
        class="max-h-24 max-w-full rounded-lg object-contain"
        :data-testid="`${testid}-preview`"
      />
      <img
        v-else-if="shown === 'saved' && saved"
        :src="imageSrc(saved ?? '')"
        alt=""
        class="max-h-24 max-w-full rounded-lg object-contain"
        :data-testid="`${testid}-preview`"
      />
      <span
        v-else
        class="flex h-16 w-20 items-center justify-center rounded-lg bg-slate-100 text-slate-400"
        :data-testid="`${testid}-preview`"
      >
        <ImageIcon class="h-6 w-6" aria-hidden="true" />
      </span>
      <button
        type="button"
        class="absolute -top-2 -right-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-red-500 text-white shadow transition after:absolute after:-inset-2.5 hover:bg-red-600"
        :data-testid="`${testid}-remove`"
        @click.prevent.stop="remove"
      >
        <X class="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  </div>
</template>
