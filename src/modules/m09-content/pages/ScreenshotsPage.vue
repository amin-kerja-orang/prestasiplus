<script setup lang="ts">
/**
 * S14 `/admin/tools/screenshots` "Upload Screenshot - Admin PRESTASIPLUS" (M09; FR-M09-119, 120,
 * BR-M09-30), v2 staff theme.
 *
 * - Card "Upload Gambar": format line, drop zone (click to pick, drag-over highlight, drop sends at once),
 *   the hidden `files` input (`accept="image/*"`, multiple) whose change sends at once, and the tip.
 * - Card "Fail Sedia Ada": "Jumlah: {n} fail" and a grid of file tiles with the sanitised names (provisional,
 *   L-5; the mock keeps no image data, so a tile shows an image glyph) or "Tiada fail lagi.".
 * - The server decides what is accepted (JPG, PNG, GIF, WebP, BMP, 10 MB each); refused files come
 *   back as an error flash, kept files as the success flash and in the list.
 */
import { ref, watch } from 'vue'

import { useApi, useFlash } from '@/composables'
import { DsEmptyState, DsFileField, DsFormSection, DsLoadError, DsPage } from '@/ds'

import { fetchScreenshots, uploadScreenshots } from '../api/admin-media'
import { COPY, errorLines } from '../lib/admin-media/common'

const flash = useFlash()

const { data: files, error, reload } = useApi((signal) => fetchScreenshots({ signal }))

const sending = ref(false)

/** The picked files; sending starts at once and the field is cleared again. */
const picked = ref<File | File[] | null>(null)
watch(picked, (value) => {
  if (!value) return
  picked.value = null
  void send(Array.isArray(value) ? value : [value])
})

async function send(list: File[]): Promise<void> {
  if (list.length === 0 || sending.value) return
  sending.value = true
  try {
    const result = await uploadScreenshots(list)
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
</script>

<template>
  <DsPage data-testid="screenshots-page">
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div class="flex min-w-0 flex-col gap-6 lg:col-span-1">
        <DsFormSection
          title="Upload Gambar"
          description="Format: JPG, PNG, GIF, WebP, BMP. Maks 10MB setiap fail."
          icon="upload-simple"
          accent="action"
        >
          <form method="post" enctype="multipart/form-data" data-testid="upload-form">
            <DsFileField
              v-model="picked"
              name="files[]"
              accept="image/*"
              multiple
              preview="none"
              label="Klik atau seret fail ke sini"
              hint="Boleh pilih banyak fail"
              data-testid="drop-zone"
            />
          </form>
          <p class="text-caption text-muted">
            Tip: guna nama fail yang ringkas. Sistem akan auto-sanitize nama fail.
          </p>
        </DsFormSection>
      </div>

      <div class="flex min-w-0 flex-col gap-6 lg:col-span-2">
        <DsFormSection title="Fail Sedia Ada" icon="i-ph-folder-open" accent="win">
          <DsLoadError
            v-if="error"
            :message="COPY.loadFailed"
            testid="files-error"
            @retry="reload()"
          />
          <template v-else-if="files">
            <p class="text-body text-muted" data-testid="files-count">
              Jumlah: {{ files.length }} fail
            </p>
            <DsEmptyState
              v-if="files.length === 0"
              title="Tiada fail lagi."
              icon="tray"
              data-testid="files-empty"
            />
            <ul
              v-else
              class="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4"
              data-testid="files-list"
            >
              <li
                v-for="file in files"
                :key="file.id"
                class="flex min-w-0 flex-col gap-2"
                data-testid="file-item"
              >
                <div
                  class="grid aspect-video place-items-center bg-soft text-dimmed"
                  aria-hidden="true"
                >
                  <UIcon name="i-ph-image" class="size-8" />
                </div>
                <span class="line-clamp-2 text-caption break-all text-default">{{
                  file.fileName
                }}</span>
              </li>
            </ul>
          </template>
        </DsFormSection>
      </div>
    </div>
  </DsPage>
</template>
