<script setup lang="ts">
/**
 * Image picker of S2 / S4 (FR-M04-20, 51; FN-M04-1.2.6, 1.2.7, 1.7.5): the question image as an upload
 * zone and the option images as a small "Gambar" button. A chosen file shows a FileReader preview with
 * a remove button that clears the input; the prompt returns after removal. On S4 the saved image is the
 * preview until removed or replaced (INFERRED); a `blob:mock/...` placeholder is shown as a neutral
 * image. The zone reads "Tukar gambar" once a new file is chosen on S4. Type and size are checked by the
 * server only (accept list as live).
 */
import { computed, ref, watch } from 'vue'

import { imageSrc } from '../lib/image-url'
import NativeFile from './native/NativeFile.vue'
import PreviewImage from './native/PreviewImage.vue'

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

const hasSaved = computed(() => props.saved !== null && props.saved !== '' && !removed.value)
const shown = computed(() => (file.value !== null ? 'new' : hasSaved.value ? 'saved' : 'none'))

function onChange(event: Event): void {
  const picked = (event.target as HTMLInputElement).files?.[0] ?? null
  file.value = picked
  if (picked) removed.value = false
}

function remove(): void {
  if (input.value?.el) input.value.el.value = ''
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
  <div class="flex min-w-0 flex-col gap-2" :data-testid="testid">
    <!-- The upload control: a button-like label around the (screen-reader only) native file input. -->
    <div class="flex min-w-0 flex-wrap items-center gap-3">
      <UButton as="label" color="neutral" variant="soft" class="min-h-11">
        <UIcon
          :name="variant === 'zone' ? 'i-ph-cloud-arrow-up' : 'i-ph-image'"
          class="size-5"
        />
        <span v-if="variant === 'chip'">Gambar</span>
        <span v-else-if="!hideZoneText" :data-testid="`${testid}-text`">{{ zoneText }}</span>
        <span v-else>Tukar gambar</span>
        <NativeFile
          ref="input"
          hidden
          accept="image/jpeg,image/png,image/webp"
          :data-testid="`${testid}-input`"
          @change="onChange"
        />
      </UButton>
      <span v-if="variant === 'zone' && !(edit && file !== null)" class="text-caption text-muted">
        JPG, PNG, WebP — Maks 2MB
      </span>
    </div>

    <div v-if="shown !== 'none'" class="flex min-w-0 items-start gap-2">
      <PreviewImage
        v-if="shown === 'new' && preview"
        :src="preview"
        alt=""
        :data-testid="`${testid}-preview`"
      />
      <PreviewImage
        v-else-if="shown === 'saved' && saved"
        :src="imageSrc(saved ?? '')"
        alt=""
        :data-testid="`${testid}-preview`"
      />
      <span v-else class="inline-grid size-16 place-items-center bg-elevated" :data-testid="`${testid}-preview`">
        <UIcon name="i-ph-image" class="size-6 text-dimmed" />
      </span>
      <UButton
        type="button"
        color="error"
        variant="soft"
        icon="i-ph-x"
        aria-label="Buang gambar"
        class="size-11 shrink-0 justify-center"
        :data-testid="`${testid}-remove`"
        @click.prevent.stop="remove"
      />
    </div>
  </div>
</template>
