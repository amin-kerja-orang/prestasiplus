<script setup lang="ts">
/** Sticky "Batal" / submit bar at the bottom of the S7/S8/S10/S11 forms. */
import { AdminStickyBar } from '@/ds/admin'

defineProps<{
  cancelTo: string
  submitLabel: string
  saving?: boolean
}>()
</script>

<template>
  <AdminStickyBar>
    <UButton :to="cancelTo" color="neutral" variant="soft" data-testid="form-cancel">Batal</UButton>
    <UButton
      type="submit"
      :loading="saving"
      :disabled="saving"
      :icon="saving ? undefined : 'i-ph-floppy-disk'"
      data-testid="form-submit"
    >
      {{ submitLabel }}
    </UButton>
  </AdminStickyBar>
</template>
