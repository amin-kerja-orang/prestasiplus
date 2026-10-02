<script setup lang="ts">
/**
 * S1 delete modals (FR-M02-13, FR-M02-16): single ("Padam Pengguna?") and bulk ("Padam Pengguna
 * Terpilih?"). Backdrop click and Esc close, 200 ms fade/scale (BaseModal `margin` variant); a
 * pending request keeps the confirm button disabled.
 */
import { Trash } from '@lucide/vue'

import BaseModal from '@/components/overlay/BaseModal.vue'

defineProps<{
  /** The user of the single modal, or null when closed. */
  single: { id: number; name: string } | null
  /** The number of selected users for the bulk modal, or 0 when closed. */
  bulkCount: number
  busy: boolean
}>()

const emit = defineEmits<{ closeSingle: []; closeBulk: []; confirmSingle: []; confirmBulk: [] }>()

const CANCEL =
  'rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 min-h-11 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300'
const CONFIRM =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 min-h-11 disabled:cursor-wait disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300'
</script>

<template>
  <BaseModal
    :open="single !== null"
    data-testid="users-delete-modal"
    @update:open="emit('closeSingle')"
  >
    <template v-if="single">
      <h3 class="mb-2 font-heading text-lg font-bold text-slate-800">Padam Pengguna?</h3>
      <p class="mb-6 text-sm text-slate-600">
        Anda pasti mahu memadam pengguna ini?
        <strong class="text-slate-800" data-testid="users-delete-name">{{ single.name }}</strong>
      </p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          :class="CANCEL"
          data-testid="users-delete-cancel"
          @click="emit('closeSingle')"
        >
          Batal
        </button>
        <button
          type="button"
          :class="CONFIRM"
          :disabled="busy"
          data-testid="users-delete-confirm"
          @click="emit('confirmSingle')"
        >
          <Trash class="h-4 w-4" aria-hidden="true" />
          Ya, Padam
        </button>
      </div>
    </template>
  </BaseModal>

  <BaseModal :open="bulkCount > 0" data-testid="users-bulk-modal" @update:open="emit('closeBulk')">
    <h3 class="mb-2 font-heading text-lg font-bold text-slate-800">Padam Pengguna Terpilih?</h3>
    <p class="mb-1 text-sm text-slate-600">
      Anda pasti mahu memadam
      <strong data-testid="users-bulk-count">{{ bulkCount }}</strong> pengguna?
    </p>
    <p class="mb-6 text-sm text-slate-500">Tindakan ini tidak boleh dibatalkan.</p>
    <div class="flex justify-end gap-3">
      <button
        type="button"
        :class="CANCEL"
        data-testid="users-bulk-cancel"
        @click="emit('closeBulk')"
      >
        Batal
      </button>
      <button
        type="button"
        :class="CONFIRM"
        :disabled="busy"
        data-testid="users-bulk-confirm"
        @click="emit('confirmBulk')"
      >
        <Trash class="h-4 w-4" aria-hidden="true" />
        Ya, Padam Semua
      </button>
    </div>
  </BaseModal>
</template>
