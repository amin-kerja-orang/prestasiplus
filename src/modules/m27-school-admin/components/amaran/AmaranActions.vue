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

// Prototype scope (D43): each M18 button shows only when the school admin's scope allows its path. While the
// scope is on, school-admin item 49 lists `/amaran/sekolah` only, so both buttons stay hidden until
// `/amaran/ringkasan-eksekutif` and `/amaran/keberkesanan` are added to it (`src/app/prototype-scope.ts`).
// With the scope off, both show.
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
