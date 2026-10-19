<script setup lang="ts">
/**
 * "Galeri Rajah" modal of S22 (FN-M10-7.2.7, DV-M10-09): `GET /api/guru/galeri-rajah` answers
 * `{folders: []}`, so the modal always ends in the live empty texts. While the request runs it says
 * "Memuatkan..."; a failed request ends the same way (as the live JSON parse failure did).
 */
import { computed, ref, watch } from 'vue'

import { DsDialog } from '@/ds'

import { fetchRajahGallery } from '../../api/guru'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const folders = ref<unknown[]>([])

const model = computed({
  get: () => props.open,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) return
    loading.value = true
    try {
      const res = await fetchRajahGallery()
      folders.value = res.folders ?? []
    } catch {
      folders.value = []
    } finally {
      loading.value = false
    }
  },
)
</script>

<template>
  <DsDialog
    v-model:open="model"
    title="Galeri Rajah"
    description="Tiada galeri tersedia"
    data-testid="galeri-modal"
  >
    <div class="flex min-w-0 flex-col gap-4">
      <p class="flex items-center gap-2 text-body text-muted" data-testid="galeri-crumb">
        <UIcon name="i-ph-arrow-left" class="size-4" />
        Semua Set
      </p>
      <p v-if="loading" class="py-6 text-center text-body text-muted" data-testid="galeri-loading">
        Memuatkan...
      </p>
      <div v-else-if="folders.length === 0" class="py-6 text-center" data-testid="galeri-empty">
        <p class="text-label text-highlighted">Tiada galeri rajah tersedia</p>
        <p class="mt-1 text-body text-muted">
          Sila muat naik imej secara manual menggunakan butang "Muat Naik"
        </p>
      </div>
    </div>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="min-h-11 justify-center"
        data-testid="galeri-cancel"
        @click="emit('close')"
        >Batal</UButton
      >
      <UButton type="button" disabled icon="i-ph-check" class="min-h-11 justify-center"
        >Pilih Rajah Ini</UButton
      >
    </template>
  </DsDialog>
</template>
