<script setup lang="ts">
/**
 * S14 `/admin/tools/screenshots` "Upload Screenshot - Admin PRESTASIPLUS" (M09; FR-M09-119, 120,
 * BR-M09-30).
 *
 * - Card "Upload Gambar": format line, drop zone (click to pick, drag-over `border-indigo-400
 *   bg-indigo-50`, drop sends at once), the hidden `files` input (`accept="image/*"`, multiple) whose
 *   change sends at once, and the tip.
 * - Card "Fail Sedia Ada": "Jumlah: {n} fail", the sanitised names (provisional, L-5) or "Tiada
 *   fail lagi.".
 * - The server decides what is accepted (JPG, PNG, GIF, WebP, BMP, 10 MB each); refused files come
 *   back as an error flash, kept files as the success flash and in the list.
 */
import { FolderOpen, Images, Inbox, UploadCloud } from '@lucide/vue'
import { ref } from 'vue'

import { AlertBox } from '@/components/feedback'
import { useApi, useFlash } from '@/composables'

import { fetchScreenshots, uploadScreenshots } from '../api/admin-media'
import { COPY, errorLines } from '../lib/admin-media/common'

const flash = useFlash()

const { data: files, error, reload } = useApi((signal) => fetchScreenshots({ signal }))

const dragging = ref(false)
const sending = ref(false)

async function send(list: FileList | File[] | null): Promise<void> {
  const picked = list ? [...list] : []
  if (picked.length === 0 || sending.value) return
  sending.value = true
  try {
    const result = await uploadScreenshots(picked)
    const { saved, rejected } = result.data
    if (rejected.length > 0) {
      const lines = rejected.map((r) => r.reason)
      flash.show({
        type: 'error',
        message: saved.length > 0 ? [result.status, ...lines] : lines,
      })
    } else {
      flash.show({ type: 'success', message: result.status })
    }
    await reload()
  } catch (err) {
    flash.show({ type: 'error', message: errorLines(err) })
  } finally {
    sending.value = false
  }
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  const picked = input.files ? [...input.files] : []
  input.value = ''
  void send(picked)
}

function onDrop(event: DragEvent): void {
  dragging.value = false
  void send(event.dataTransfer?.files ?? null)
}
</script>

<template>
  <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3" data-testid="screenshots-page">
    <section class="min-w-0 rounded-2xl bg-white p-5 shadow-sm lg:col-span-1">
      <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
        <UploadCloud class="h-5 w-5 text-indigo-500" aria-hidden="true" />
        Upload Gambar
      </h2>
      <p class="mt-1 text-sm text-slate-500">
        Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail.
      </p>
      <form class="mt-4" method="post" enctype="multipart/form-data" data-testid="upload-form">
        <label
          for="screenshot-input"
          :class="[
            'flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition',
            dragging
              ? 'border-indigo-400 bg-indigo-50'
              : 'border-slate-300 bg-slate-50 hover:border-indigo-300',
          ]"
          data-testid="drop-zone"
          @dragover.prevent="dragging = true"
          @dragleave.prevent="dragging = false"
          @drop.prevent="onDrop"
        >
          <Images class="h-9 w-9 text-slate-400" aria-hidden="true" />
          <span class="mt-3 text-sm font-semibold text-slate-700"
            >Klik atau seret fail ke sini</span
          >
          <span class="mt-1 text-xs text-slate-400">Boleh pilih banyak fail</span>
        </label>
        <input
          id="screenshot-input"
          type="file"
          name="files[]"
          accept="image/*"
          multiple
          class="sr-only"
          data-testid="file-input"
          @change="onPick"
        />
      </form>
      <p class="mt-3 text-xs text-slate-400">
        Tip: guna nama fail yang ringkas. Sistem akan auto-sanitize nama fail.
      </p>
    </section>

    <section class="min-w-0 rounded-2xl bg-white p-5 shadow-sm lg:col-span-2">
      <h2 class="flex items-center gap-2 font-heading text-lg font-bold text-slate-800">
        <FolderOpen class="h-5 w-5 text-emerald-500" aria-hidden="true" />
        Fail Sedia Ada
      </h2>
      <AlertBox v-if="error" :messages="COPY.loadFailed" class="mt-3" data-testid="files-error" />
      <template v-else-if="files">
        <p class="mt-1 text-sm text-slate-500" data-testid="files-count">
          Jumlah: {{ files.length }} fail
        </p>
        <div
          v-if="files.length === 0"
          class="flex flex-col items-center gap-3 py-12 text-slate-400"
          data-testid="files-empty"
        >
          <Inbox class="h-10 w-10" aria-hidden="true" />
          <span>Tiada fail lagi.</span>
        </div>
        <ul v-else class="mt-3 divide-y divide-slate-100" data-testid="files-list">
          <li
            v-for="file in files"
            :key="file.id"
            class="min-w-0 py-2 text-sm break-all text-slate-700"
            data-testid="file-item"
          >
            {{ file.fileName }}
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
