<script setup lang="ts">
/**
 * S4 / S5 "Kaedah Import *" (FR-M02-54, FR-M02-62): the buttons "Upload CSV" / "Paste Manual" (active one
 * highlighted, default paste), then the paste textarea or the CSV drop zone ("Seret & Lepas fail CSV di
 * sini" / "atau" / "Pilih Fail", `accept=".csv,.txt"`; a drop copies the file into the input; status "Tiada
 * fail dipilih" / "Fail dipilih: {name}"). The format box differs per screen and comes in the `format` slot.
 */
import { DsFileField } from '@/ds'

import type { ImportMode } from '../api/imports'

defineProps<{ pastePlaceholder: string }>()

const mode = defineModel<ImportMode>('mode', { required: true })
const paste = defineModel<string>('paste', { required: true })
const file = defineModel<File | null>('file', { required: true })

defineSlots<{ format?: (props: { mode: ImportMode }) => unknown }>()

/** `DsFileField` (the `UFileUpload` drop zone) hands over one file; a rejected file clears the choice. */
function onPick(value: File | File[] | null): void {
  file.value = Array.isArray(value) ? (value[0] ?? null) : value
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
      <div class="flex flex-col gap-2" data-testid="import-dropzone">
        <DsFileField
          :model-value="file"
          name="csv_file"
          accept=".csv,.txt"
          label="Seret &amp; Lepas fail CSV di sini"
          preview="none"
          hint="atau klik untuk memilih fail"
          @update:model-value="onPick"
        />
        <p class="text-label text-muted" data-testid="import-file-status">
          {{ file ? `Fail dipilih: ${file.name}` : 'Tiada fail dipilih' }}
        </p>
      </div>
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
