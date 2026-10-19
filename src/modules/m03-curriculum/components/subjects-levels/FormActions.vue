<script setup lang="ts">
/** Sticky "Batal" / submit bar at the bottom of the S7/S8/S10/S11 forms (`DsFormBar`). */
import { DsFormBar } from '@/ds'

defineProps<{
  cancelTo: string
  submitLabel: string
  saving?: boolean
}>()
</script>

<template>
  <DsFormBar :cancel-to="cancelTo" :submit-label="submitLabel" :saving="saving" />
</template>
