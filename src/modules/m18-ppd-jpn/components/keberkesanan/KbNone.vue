<script setup lang="ts">
/** S21 zero state (design section 5.1 item 4): "Belum Ada Intervensi" with a link back to the risk list. */
import { DsEmptyState, DsPanel } from '@/ds'
</script>

<template>
  <DsPanel data-testid="kb-none">
    <DsEmptyState
      title="Belum Ada Intervensi"
      description="Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod intervensi dari halaman Amaran Awal."
      icon="clipboard-text"
    >
      <template #actions>
        <UButton to="/amaran/sekolah" label="Lihat Senarai Risiko" class="min-h-11" data-testid="kb-none-link" />
      </template>
    </DsEmptyState>
  </DsPanel>
</template>
