<script setup lang="ts">
/** S1 "📊 GPS Anggaran" (FR-M08-14). A null GPS (no graded headcount entries yet) shows "—" and no badge. */
import { DsPanel } from '@/ds'
import { computed } from 'vue'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, DASH, dec2 } from '../../lib/prestasi/format'

const props = defineProps<{ gps: SchoolPerformance['gps'] }>()

const style = computed(() => (props.gps.band ? BAND_STYLE[props.gps.band] : null))
</script>

<template>
  <DsPanel data-testid="gps-card">
    <div class="flex flex-col items-center gap-3 text-center">
      <h2 class="text-subheading text-highlighted">📊 GPS Anggaran</h2>
      <p class="text-caption text-muted">Gred Purata Sekolah (lebih rendah = lebih baik)</p>
      <p class="flex flex-col items-center">
        <span
          class="tabular text-display"
          :class="style?.text ?? 'text-dimmed'"
          data-testid="gps-value"
          >{{ gps.value === null ? DASH : dec2(gps.value) }}</span
        >
        <span class="text-caption text-muted">GPS</span>
      </p>
      <UBadge
        v-if="gps.band && style"
        :color="style.badge"
        variant="subtle"
        size="lg"
        :label="gps.band"
        data-testid="gps-band"
      />
      <p class="text-body text-default">
        Berdasarkan <strong data-testid="gps-entries">{{ gps.entries }}</strong> entri headcount
      </p>
      <p class="text-caption text-muted">* Anggaran dari markah OTR, bukan SPM sebenar</p>
    </div>
  </DsPanel>
</template>
