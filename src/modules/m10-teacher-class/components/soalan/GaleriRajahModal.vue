<script setup lang="ts">
/**
 * "Galeri Rajah" modal of S22 (FN-M10-7.2.7, DV-M10-09): `GET /api/guru/galeri-rajah` answers
 * `{folders: []}`, so the modal always ends in the live empty texts. While the request runs it says
 * "Memuatkan..."; a failed request ends the same way (as the live JSON parse failure did).
 */
import { ArrowLeft, Check, Images } from '@lucide/vue'
import { ref, watch } from 'vue'

import { BaseModal } from '@/components/overlay'

import { fetchRajahGallery } from '../../api/guru'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const folders = ref<unknown[]>([])

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
  <BaseModal :open="open" data-testid="galeri-modal" @close="emit('close')">
    <template #default="{ close }">
      <div class="min-w-0 space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <h3 class="flex items-center gap-2 text-lg font-bold text-slate-800">
              <Images class="h-5 w-5 text-indigo-600" />
              Galeri Rajah
            </h3>
            <p class="text-sm text-slate-500">Tiada galeri tersedia</p>
          </div>
        </div>
        <p class="flex items-center gap-1.5 text-sm text-slate-500" data-testid="galeri-crumb">
          <ArrowLeft class="h-4 w-4" />
          Semua Set
        </p>
        <p
          v-if="loading"
          class="py-6 text-center text-sm text-slate-500"
          data-testid="galeri-loading"
        >
          Memuatkan...
        </p>
        <div v-else-if="folders.length === 0" class="py-6 text-center" data-testid="galeri-empty">
          <p class="font-semibold text-slate-700">Tiada galeri rajah tersedia</p>
          <p class="mt-1 text-sm text-slate-500">
            Sila muat naik imej secara manual menggunakan butang "Muat Naik"
          </p>
        </div>
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="inline-flex min-h-11 items-center rounded-xl bg-slate-100 px-4 text-sm font-semibold text-slate-700 hover:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
            data-testid="galeri-cancel"
            @click="close"
          >
            Batal
          </button>
          <button
            type="button"
            disabled
            class="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white opacity-50"
          >
            <Check class="h-4 w-4" />
            Pilih Rajah Ini
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>
