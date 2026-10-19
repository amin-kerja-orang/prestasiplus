<script setup lang="ts">
/**
 * S1 delete dialogs (FR-M02-13, FR-M02-16): single ("Padam Pengguna?") and bulk ("Padam Pengguna
 * Terpilih?"). Scrim click and Esc close; a pending request keeps the confirm button disabled.
 */
import { computed } from 'vue'

import { DsDialog } from '@/ds'

const props = defineProps<{
  /** The user of the single dialog, or null when closed. */
  single: { id: number; name: string } | null
  /** The number of selected users for the bulk dialog, or 0 when closed. */
  bulkCount: number
  busy: boolean
}>()

const emit = defineEmits<{ closeSingle: []; closeBulk: []; confirmSingle: []; confirmBulk: [] }>()

const singleOpen = computed({
  get: () => props.single !== null,
  set: (open: boolean) => {
    if (!open) emit('closeSingle')
  },
})
const bulkOpen = computed({
  get: () => props.bulkCount > 0,
  set: (open: boolean) => {
    if (!open) emit('closeBulk')
  },
})
</script>

<template>
  <DsDialog v-model:open="singleOpen" title="Padam Pengguna?" data-testid="users-delete-modal">
    <p v-if="single" class="text-body text-default">
      Anda pasti mahu memadam pengguna ini?
      <strong class="text-highlighted" data-testid="users-delete-name">{{ single.name }}</strong>
    </p>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        label="Batal"
        data-testid="users-delete-cancel"
        @click="emit('closeSingle')"
      />
      <UButton
        type="button"
        color="error"
        icon="i-ph-trash"
        label="Ya, Padam"
        :disabled="busy"
        data-testid="users-delete-confirm"
        @click="emit('confirmSingle')"
      />
    </template>
  </DsDialog>

  <DsDialog v-model:open="bulkOpen" title="Padam Pengguna Terpilih?" data-testid="users-bulk-modal">
    <div class="flex flex-col gap-1">
      <p class="text-body text-default">
        Anda pasti mahu memadam
        <strong data-testid="users-bulk-count">{{ bulkCount }}</strong> pengguna?
      </p>
      <p class="text-label text-muted">Tindakan ini tidak boleh dibatalkan.</p>
    </div>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="soft"
        label="Batal"
        data-testid="users-bulk-cancel"
        @click="emit('closeBulk')"
      />
      <UButton
        type="button"
        color="error"
        icon="i-ph-trash"
        label="Ya, Padam Semua"
        :disabled="busy"
        data-testid="users-bulk-confirm"
        @click="emit('confirmBulk')"
      />
    </template>
  </DsDialog>
</template>
