<script setup lang="ts">
/**
 * Quick-QR modal `#quickQrModal` (FR-M10-30, FN-M10-3.1.4). Opening shows "-" and a spinner, then
 * `GET /api/guru/classes/:id/qr-data` fills the name, school, QR and the read-only URL. Copy uses
 * the Clipboard API and a "Disalin!" toast; "Cetak" calls `window.print()`.
 */
import { computed, ref, watch } from 'vue'

import { DsDialog, DsFormField } from '@/ds'

import { fetchClassQrData } from '../../api/guru'
import type { ClassQrData } from '../../api/types'
import { KELAS_COPY } from './copy'
import QrCanvas from './QrCanvas.vue'

const props = defineProps<{ classId: number | null }>()
const emit = defineEmits<{ close: [] }>()

const data = ref<ClassQrData | null>(null)
const failed = ref(false)
const toast = useToast()
let seq = 0

const open = computed({
  get: () => props.classId !== null,
  set: (v: boolean) => {
    if (!v) emit('close')
  },
})

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
    toast.add({ title: KELAS_COPY.copied, color: 'success' })
  } catch {
    /* clipboard refused: nothing is copied */
  }
}

const print = (): void => window.print()
</script>

<template>
  <DsDialog v-model:open="open" :title="data?.name ?? '-'" data-testid="quick-qr-modal">
    <div class="flex flex-col gap-4">
      <p class="text-center text-body break-words text-muted" data-testid="qr-school">
        {{ data ? (data.school ?? '') : '-' }}
      </p>
      <UAlert
        v-if="failed"
        color="error"
        variant="subtle"
        icon="i-ph-warning-circle-duotone"
        :title="KELAS_COPY.qrFailed"
        role="alert"
      />
      <div class="flex justify-center">
        <QrCanvas v-if="data" :text="data.joinUrl" />
        <USkeleton v-else class="size-48" data-testid="qr-spinner" />
      </div>
      <DsFormField :label="KELAS_COPY.joinLink" name="qr-join-url">
        <div class="flex gap-2">
          <UInput
            id="qr-join-url"
            type="text"
            readonly
            :model-value="data?.joinUrl ?? ''"
            class="min-w-0 grow"
            data-testid="qr-url"
          />
          <UButton
            type="button"
            color="neutral"
            variant="soft"
            icon="i-ph-copy-duotone"
            aria-label="Salin"
            class="size-11 justify-center"
            data-testid="qr-copy"
            @click="copy"
          />
        </div>
      </DsFormField>
    </div>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        icon="i-ph-printer-duotone"
        class="min-h-11 justify-center"
        data-testid="qr-print"
        @click="print"
        >{{ KELAS_COPY.print }}</UButton
      >
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        class="min-h-11 justify-center"
        data-testid="qr-close"
        @click="emit('close')"
        >{{ KELAS_COPY.close }}</UButton
      >
    </template>
  </DsDialog>
</template>
