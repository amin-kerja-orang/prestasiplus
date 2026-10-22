<script setup lang="ts">
/** S21 zero state (design section 5.1 item 4): "Belum Ada Intervensi" with a link back to the risk list (not for the teacher: S4 is not on the teacher's routes). */
import { DsEmptyState, DsPanel } from '@/ds'

withDefaults(defineProps<{ showRiskLink?: boolean }>(), { showRiskLink: true })
</script>

<template>
  <DsPanel data-testid="kb-none">
    <DsEmptyState
      title="Belum Ada Intervensi"
      description="Tiada rekod intervensi ditemui untuk sekolah ini. Guru boleh mula merekod intervensi dari halaman Amaran Awal."
      icon="clipboard-text"
    >
      <template v-if="showRiskLink" #actions>
        <UButton to="/amaran/sekolah" label="Lihat Senarai Risiko" class="min-h-11" data-testid="kb-none-link" />
      </template>
    </DsEmptyState>
  </DsPanel>
</template>
