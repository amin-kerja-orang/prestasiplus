<script setup lang="ts">
/**
 * S4 / S5 "Kaedah Import *" (FR-M02-54, FR-M02-62): the buttons "Upload CSV" / "Paste Manual" (active one
 * highlighted, default paste), then the paste textarea or the CSV drop zone ("Seret & Lepas fail CSV di
 * sini" / "atau" / "Pilih Fail", `accept=".csv,.txt"`; a drop copies the file into the input; status "Tiada
 * fail dipilih" / "Fail dipilih: {name}"). The format box differs per screen and comes in the `format` slot.
 */
import { ref } from 'vue'

import type { ImportMode } from '../api/imports'
import NativeFile from './native/NativeFile.vue'
import NativePanel from './native/NativePanel.vue'

defineProps<{ pastePlaceholder: string }>()

const mode = defineModel<ImportMode>('mode', { required: true })
const paste = defineModel<string>('paste', { required: true })
const file = defineModel<File | null>('file', { required: true })

defineSlots<{ format?: (props: { mode: ImportMode }) => unknown }>()

const input = ref<{ el: HTMLInputElement | null } | null>(null)
const dragging = ref(false)

function onPick(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  const dropped = event.dataTransfer?.files
  if (!dropped || dropped.length === 0) return
  // As live `handleDrop`: the dropped file is copied into the file input.
  if (input.value?.el) input.value.el.files = dropped
  file.value = dropped[0] ?? null
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="import-source">
    <p class="flex items-center gap-2 text-label text-default">
      <UIcon name="i-ph-upload-simple" class="size-4 text-muted" aria-hidden="true" />
      Kaedah Import <span class="text-error">*</span>
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <UButton
        type="button"
        block
        :color="mode === 'csv' ? 'primary' : 'neutral'"
        :variant="mode === 'csv' ? 'solid' : 'soft'"
        icon="i-ph-file-csv"
        label="Upload CSV"
        data-testid="import-mode-csv"
        @click="mode = 'csv'"
      />
      <UButton
        type="button"
        block
        :color="mode === 'paste' ? 'primary' : 'neutral'"
        :variant="mode === 'paste' ? 'solid' : 'soft'"
        icon="i-ph-clipboard-text"
        label="Paste Manual"
        data-testid="import-mode-paste"
        @click="mode = 'paste'"
      />
    </div>

    <div v-if="mode === 'csv'" data-testid="import-csv">
      <NativePanel
        :tone="dragging ? 'primary' : 'soft'"
        class="flex flex-col items-center gap-2 p-6 text-center"
        data-testid="import-dropzone"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <UIcon name="i-ph-upload-simple" class="size-8 text-muted" aria-hidden="true" />
        <p class="text-label text-default">Seret &amp; Lepas fail CSV di sini</p>
        <p class="text-caption text-muted">atau</p>
        <NativeFile
          ref="input"
          name="csv_file"
          accept=".csv,.txt"
          input-testid="import-file"
          @change="onPick"
        >
          Pilih Fail
        </NativeFile>
        <p class="text-label text-muted" data-testid="import-file-status">
          {{ file ? `Fail dipilih: ${file.name}` : 'Tiada fail dipilih' }}
        </p>
      </NativePanel>
    </div>

    <UTextarea
      v-else
      v-model="paste"
      name="paste_content"
      :rows="8"
      :placeholder="pastePlaceholder"
      class="w-full"
      data-testid="import-paste"
    />

    <slot name="format" :mode="mode" />
  </div>
</template>
