<script setup lang="ts">
/**
 * S4 / S5 "Kaedah Import *" (FR-M02-54, FR-M02-62): the buttons "Upload CSV" / "Paste Manual" (active one
 * highlighted, default paste), then the paste textarea or the CSV drop zone ("Seret & Lepas fail CSV di
 * sini" / "atau" / "Pilih Fail", `accept=".csv,.txt"`; a drop copies the file into the input; status "Tiada
 * fail dipilih" / "Fail dipilih: {name}"). The format box differs per screen and comes in the `format` slot.
 */
import { ClipboardPaste, FileSpreadsheet, Upload } from '@lucide/vue'
import { computed, ref } from 'vue'

import { FORM_TEXTAREA_CLASS } from '@/components/form'

import type { ImportMode } from '../api/imports'

const props = defineProps<{
  /** S4 indigo/purple, S5 amber/orange (the live active-button gradients). */
  accent: 'indigo' | 'amber'
  pastePlaceholder: string
}>()

const mode = defineModel<ImportMode>('mode', { required: true })
const paste = defineModel<string>('paste', { required: true })
const file = defineModel<File | null>('file', { required: true })

defineSlots<{ format?: (props: { mode: ImportMode }) => unknown }>()

const input = ref<HTMLInputElement | null>(null)
const dragging = ref(false)

const ACTIVE = computed(() =>
  props.accent === 'indigo'
    ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-lg'
    : 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg',
)
const FOCUS = computed(() =>
  props.accent === 'indigo' ? 'focus-visible:ring-indigo-300' : 'focus-visible:ring-amber-300',
)
const ZONE_ACTIVE = computed(() =>
  props.accent === 'indigo' ? 'border-indigo-400 bg-indigo-50' : 'border-amber-400 bg-amber-50',
)
const PICK = computed(() =>
  props.accent === 'indigo'
    ? 'bg-indigo-600 hover:bg-indigo-700 focus-within:ring-indigo-300'
    : 'bg-amber-500 hover:bg-amber-600 focus-within:ring-amber-300',
)

const BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2'

function onPick(event: Event): void {
  file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  const dropped = event.dataTransfer?.files
  if (!dropped || dropped.length === 0) return
  // As live `handleDrop`: the dropped file is copied into the file input.
  if (input.value) input.value.files = dropped
  file.value = dropped[0] ?? null
}
</script>

<template>
  <div data-testid="import-source">
    <p class="mb-1.5 flex items-center gap-2 text-sm font-semibold text-slate-700">
      <Upload class="h-4 w-4 text-purple-500" aria-hidden="true" />
      Kaedah Import <span class="text-red-500">*</span>
    </p>
    <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        :class="[
          BUTTON,
          FOCUS,
          mode === 'csv'
            ? [ACTIVE, 'border-transparent']
            : 'bg-white text-slate-700 hover:bg-slate-50',
        ]"
        data-testid="import-mode-csv"
        @click="mode = 'csv'"
      >
        <FileSpreadsheet class="h-4 w-4" aria-hidden="true" />
        Upload CSV
      </button>
      <button
        type="button"
        :class="[
          BUTTON,
          FOCUS,
          mode === 'paste'
            ? [ACTIVE, 'border-transparent']
            : 'bg-white text-slate-700 hover:bg-slate-50',
        ]"
        data-testid="import-mode-paste"
        @click="mode = 'paste'"
      >
        <ClipboardPaste class="h-4 w-4" aria-hidden="true" />
        Paste Manual
      </button>
    </div>

    <div v-if="mode === 'csv'" class="mt-4" data-testid="import-csv">
      <div
        :class="[
          'rounded-xl border-2 border-dashed p-6 text-center transition',
          dragging ? ZONE_ACTIVE : 'border-slate-300 bg-slate-50',
        ]"
        data-testid="import-dropzone"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="onDrop"
      >
        <Upload class="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
        <p class="text-sm font-medium text-slate-600">Seret &amp; Lepas fail CSV di sini</p>
        <p class="my-1 text-xs text-slate-400">atau</p>
        <label
          :class="[
            'inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus-within:ring-2',
            PICK,
          ]"
        >
          Pilih Fail
          <input
            ref="input"
            type="file"
            name="csv_file"
            accept=".csv,.txt"
            class="sr-only"
            data-testid="import-file"
            @change="onPick"
          />
        </label>
        <p class="mt-3 text-sm text-slate-500" data-testid="import-file-status">
          {{ file ? `Fail dipilih: ${file.name}` : 'Tiada fail dipilih' }}
        </p>
      </div>
    </div>

    <div v-else class="mt-4">
      <textarea
        v-model="paste"
        name="paste_content"
        rows="8"
        :placeholder="pastePlaceholder"
        :class="[FORM_TEXTAREA_CLASS, 'resize-y font-mono']"
        data-testid="import-paste"
      />
    </div>

    <slot name="format" :mode="mode" />
  </div>
</template>
