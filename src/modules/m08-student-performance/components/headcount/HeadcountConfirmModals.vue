<script setup lang="ts">
/**
 * S23 "Reset Data" and "Padam" modals (FR-M08-136): backdrop click, Esc and "Batal" close them without
 * calling the API; "Ya, Reset" / "Ya, Padam" emit `confirm-reset` / `confirm-delete` (effects INFERRED,
 * FR-M08-137).
 */
import { CircleCheck, RotateCcw, Trash, TriangleAlert } from '@lucide/vue'

import { BaseModal } from '@/components/overlay'

defineProps<{
  subject: string
  className: string
  year: number
  busy: boolean
}>()
const resetOpen = defineModel<boolean>('resetOpen', { required: true })
const deleteOpen = defineModel<boolean>('deleteOpen', { required: true })
defineEmits<{ 'confirm-reset': []; 'confirm-delete': [] }>()

const PANEL =
  'relative bg-white rounded-2xl shadow-2xl w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto'
const BACKDROP = 'absolute inset-0 bg-black/50'
const CANCEL =
  'min-h-11 flex-1 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-bold text-slate-600 transition hover:bg-slate-50'
</script>

<template>
  <BaseModal
    v-model:open="resetOpen"
    :backdrop-class="BACKDROP"
    :panel-class="PANEL"
    data-testid="reset-modal"
  >
    <template #default="{ close }">
      <div class="flex items-start gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-600"
          ><RotateCcw class="h-6 w-6"
        /></span>
        <div class="min-w-0">
          <h3 class="font-heading text-lg font-bold text-slate-800">Reset Semua Data?</h3>
          <p class="mt-1 text-sm text-slate-600">
            Semua markah murid akan dikosongkan — <strong>TOV, ETR, OTR, AR &amp; RS</strong>.
          </p>
        </div>
      </div>
      <div class="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
        <p class="font-bold">Yang kekal selamat:</p>
        <ul class="mt-1 space-y-1">
          <li class="flex items-start gap-2">
            <CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />Senarai murid (tidak dipadam)
          </li>
          <li class="flex items-start gap-2">
            <CircleCheck class="mt-0.5 h-4 w-4 shrink-0" />Tetapan headcount (subjek, kelas, tahun)
          </li>
        </ul>
      </div>
      <div class="mt-5 flex gap-3">
        <button type="button" :class="CANCEL" data-testid="reset-cancel" @click="close()">
          Batal
        </button>
        <button
          type="button"
          :disabled="busy"
          class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 text-sm font-bold text-white transition hover:bg-orange-700 disabled:opacity-60"
          data-testid="reset-confirm"
          @click="$emit('confirm-reset')"
        >
          <RotateCcw class="h-4 w-4" />Ya, Reset
        </button>
      </div>
    </template>
  </BaseModal>

  <BaseModal
    v-model:open="deleteOpen"
    :backdrop-class="BACKDROP"
    :panel-class="PANEL"
    data-testid="delete-modal"
  >
    <template #default="{ close }">
      <div class="flex items-start gap-3">
        <span
          class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600"
          ><TriangleAlert class="h-6 w-6"
        /></span>
        <div class="min-w-0">
          <h3 class="font-heading text-lg font-bold text-slate-800">Padam Headcount?</h3>
          <p class="mt-1 text-sm break-words text-slate-600">
            Anda pasti mahu padam headcount <strong>{{ subject }}</strong> ({{ className }},
            {{ year }})?
          </p>
          <p class="mt-2 text-sm text-slate-600">
            Semua data murid, TOV, ETR, OTR, AR &amp; RS akan dipadam secara kekal.
          </p>
        </div>
      </div>
      <div class="mt-5 flex gap-3">
        <button type="button" :class="CANCEL" data-testid="delete-cancel" @click="close()">
          Batal
        </button>
        <button
          type="button"
          :disabled="busy"
          class="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-60"
          data-testid="delete-confirm"
          @click="$emit('confirm-delete')"
        >
          <Trash class="h-4 w-4" />Ya, Padam
        </button>
      </div>
    </template>
  </BaseModal>
</template>
