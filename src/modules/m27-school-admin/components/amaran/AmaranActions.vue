<script setup lang="ts">
/**
 * S4 action row (FR-M27-73; restyle spec AS-49): "Keberkesanan Intervensi", "Ringkasan Eksekutif" and "Muat
 * Turun CSV" as tonal buttons, right-aligned from `sm`. The CSV button is a link whose click is taken over
 * by the page (it downloads the file through the client); it is disabled while the download runs.
 */
import { usePrototypeScope } from '@/composables'

import { csvHref, keberkesananHref, ringkasanHref } from './amaran-format'

defineProps<{ schoolId: number; downloading: boolean }>()
defineEmits<{ download: [] }>()

// Prototype scope (D43): the two deferred pages are outside the matrix, so their buttons are hidden.
const { allows } = usePrototypeScope()
</script>

<template>
  <div
    class="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end"
    data-testid="am-actions"
  >
    <UButton
      v-if="allows(keberkesananHref)"
      :to="keberkesananHref"
      color="neutral"
      variant="soft"
      size="lg"
      icon="i-ph-chart-pie"
      label="Keberkesanan Intervensi"
      data-icon="fa-chart-pie"
      data-testid="am-btn-keberkesanan"
    />
    <UButton
      v-if="allows(ringkasanHref(schoolId))"
      :to="ringkasanHref(schoolId)"
      color="neutral"
      variant="soft"
      size="lg"
      icon="i-ph-file-text"
      label="Ringkasan Eksekutif"
      data-icon="fa-file-alt"
      data-testid="am-btn-ringkasan"
    />
    <UButton
      :href="csvHref(schoolId)"
      color="primary"
      variant="soft"
      size="lg"
      icon="i-ph-download-simple"
      label="Muat Turun CSV"
      :disabled="downloading"
      data-icon="fa-download"
      data-testid="am-btn-csv"
      @click.prevent="$emit('download')"
    />
  </div>
</template>
