<script setup lang="ts">
/**
 * S23 "Set Semula Data" and "Padam" dialogs (FR-M08-136): the scrim, Esc and "Batal" close them without
 * calling the API; "Ya, Set Semula" / "Ya, Padam" emit `confirm-reset` / `confirm-delete` (effects INFERRED,
 * FR-M08-137).
 */
import { DsDialog, DsPanel } from '@/ds'

defineProps<{
  subject: string
  className: string
  year: number
  busy: boolean
}>()
const resetOpen = defineModel<boolean>('resetOpen', { required: true })
const deleteOpen = defineModel<boolean>('deleteOpen', { required: true })
defineEmits<{ 'confirm-reset': []; 'confirm-delete': [] }>()
</script>

<template>
  <DsDialog v-model:open="resetOpen" title="Set Semula Semua Data?">
    <div class="flex flex-col gap-4" data-testid="reset-modal">
      <p class="text-body text-default">
        Semua markah murid akan dikosongkan — <strong>TOV, ETR, OTR, AR &amp; RS</strong>.
      </p>
      <DsPanel tone="inset">
        <div class="flex flex-col gap-2">
          <p class="text-label text-highlighted">Yang kekal selamat:</p>
          <ul class="flex flex-col gap-2 text-body text-default">
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check-circle" class="mt-1 size-5 shrink-0 text-success" />Senarai
              murid (tidak dipadam)
            </li>
            <li class="flex items-start gap-2">
              <UIcon name="i-ph-check-circle" class="mt-1 size-5 shrink-0 text-success" />Tetapan
              headcount (subjek, kelas, tahun)
            </li>
          </ul>
        </div>
      </DsPanel>
    </div>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        label="Batal"
        data-testid="reset-cancel"
        @click="resetOpen = false"
      />
      <UButton
        type="button"
        color="primary"
        icon="i-ph-arrow-counter-clockwise"
        label="Ya, Set Semula"
        :disabled="busy"
        data-testid="reset-confirm"
        @click="$emit('confirm-reset')"
      />
    </template>
  </DsDialog>

  <DsDialog v-model:open="deleteOpen" title="Padam Headcount?">
    <div class="flex flex-col gap-3" data-testid="delete-modal">
      <p class="text-body break-words text-default">
        Anda pasti mahu padam headcount <strong>{{ subject }}</strong> ({{ className }},
        {{ year }})?
      </p>
      <p class="text-body text-default">
        Semua data murid, TOV, ETR, OTR, AR &amp; RS akan dipadam secara kekal.
      </p>
    </div>
    <template #footer>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        label="Batal"
        data-testid="delete-cancel"
        @click="deleteOpen = false"
      />
      <UButton
        type="button"
        color="error"
        icon="i-ph-trash"
        label="Ya, Padam"
        :disabled="busy"
        data-testid="delete-confirm"
        @click="$emit('confirm-delete')"
      />
    </template>
  </DsDialog>
</template>
