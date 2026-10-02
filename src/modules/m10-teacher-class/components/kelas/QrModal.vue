<script setup lang="ts">
/**
 * Quick-QR modal `#quickQrModal` (FR-M10-30, FN-M10-3.1.4). Opening shows "-" and a spinner, then
 * `GET /api/guru/classes/:id/qr-data` fills the name, school, QR and the read-only URL. Copy uses
 * the Clipboard API and the native `alert('Disalin!')`; "Cetak" calls `window.print()`.
 */
import { Copy, Printer } from '@lucide/vue'
import { ref, watch } from 'vue'

import { AlertBox, LoadingSpinner } from '@/components/feedback'
import { BaseModal, alertNative } from '@/components/overlay'

import { fetchClassQrData } from '../../api/guru'
import type { ClassQrData } from '../../api/types'
import { KELAS_COPY } from './copy'
import QrCanvas from './QrCanvas.vue'

const props = defineProps<{ classId: number | null }>()
const emit = defineEmits<{ close: [] }>()

const data = ref<ClassQrData | null>(null)
const failed = ref(false)
let seq = 0

watch(
  () => props.classId,
  async (id) => {
    data.value = null
    failed.value = false
    const mine = ++seq
    if (id === null) return
    try {
      const result = await fetchClassQrData(id)
      if (mine === seq) data.value = result
    } catch {
      if (mine === seq) failed.value = true
    }
  },
  { immediate: true },
)

async function copy(): Promise<void> {
  if (!data.value) return
  try {
    await navigator.clipboard.writeText(data.value.joinUrl)
    alertNative(KELAS_COPY.copied)
  } catch {
    /* clipboard refused: nothing is copied */
  }
}

const print = (): void => window.print()
</script>

<template>
  <BaseModal
    :open="classId !== null"
    panel-class="relative max-h-[90vh] w-full max-w-sm overflow-hidden overflow-y-auto rounded-2xl bg-white shadow-2xl"
    data-testid="quick-qr-modal"
    @close="emit('close')"
  >
    <div class="bg-linear-to-r from-indigo-500 to-purple-600 px-4 py-5 text-center text-white">
      <h3 class="font-heading text-lg font-bold break-words" data-testid="qr-name">
        {{ data?.name ?? '-' }}
      </h3>
      <p class="text-sm break-words text-white/80" data-testid="qr-school">
        {{ data ? (data.school ?? '') : '-' }}
      </p>
    </div>
    <div class="space-y-4 p-4">
      <AlertBox v-if="failed" :messages="KELAS_COPY.qrFailed" />
      <div class="flex justify-center">
        <QrCanvas v-if="data" :text="data.joinUrl" />
        <div
          v-else
          class="flex h-48 w-48 items-center justify-center rounded-2xl bg-slate-100 text-slate-400"
          data-testid="qr-spinner"
        >
          <LoadingSpinner :size="28" />
        </div>
      </div>
      <div class="rounded-xl bg-slate-50 p-3">
        <label for="qr-join-url" class="mb-1 block text-center text-sm text-slate-600">{{
          KELAS_COPY.joinLink
        }}</label>
        <div class="flex gap-2">
          <input
            id="qr-join-url"
            type="text"
            readonly
            :value="data?.joinUrl ?? ''"
            class="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
            data-testid="qr-url"
          />
          <button
            type="button"
            class="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-indigo-500 text-white hover:bg-indigo-600"
            data-testid="qr-copy"
            @click="copy"
          >
            <Copy class="h-4 w-4" />
          </button>
        </div>
      </div>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-500 font-semibold text-white hover:bg-emerald-600"
          data-testid="qr-print"
          @click="print"
        >
          <Printer class="h-4 w-4" />{{ KELAS_COPY.print }}
        </button>
        <button
          type="button"
          class="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-slate-200 font-semibold text-slate-700 hover:bg-slate-300"
          data-testid="qr-close"
          @click="emit('close')"
        >
          {{ KELAS_COPY.close }}
        </button>
      </div>
    </div>
  </BaseModal>
</template>
