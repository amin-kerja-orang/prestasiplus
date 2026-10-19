<script setup lang="ts">
/** S1 "📊 GPS Anggaran" (FR-M08-14). A null GPS (no graded headcount entries yet) shows "—" and no badge. */
import { DsPanel, DsStack, DsHeading, DsText } from '@/ds'
import { computed } from 'vue'

import type { SchoolPerformance } from '../../api/types'
import { BAND_STYLE, DASH, dec2 } from '../../lib/prestasi/format'

const props = defineProps<{ gps: SchoolPerformance['gps'] }>()

const style = computed(() => (props.gps.band ? BAND_STYLE[props.gps.band] : null))
</script>

<template>
  <DsPanel data-testid="gps-card">
    <DsStack gap="sm" align="center" class="text-center">
      <DsHeading :level="2" variant="subheading">📊 GPS Anggaran</DsHeading>
      <DsText variant="caption">Gred Purata Sekolah (lebih rendah = lebih baik)</DsText>
      <p class="flex flex-col items-center">
        <span
          class="tabular text-display"
          :class="style?.text ?? 'text-dimmed'"
          data-testid="gps-value"
          >{{ gps.value === null ? DASH : dec2(gps.value) }}</span
        >
        <DsText variant="caption" as="span">GPS</DsText>
      </p>
      <UBadge
        v-if="gps.band && style"
        :color="style.badge"
        variant="subtle"
        size="lg"
        :label="gps.band"
        data-testid="gps-band"
      />
      <DsText variant="body">
        Berdasarkan <strong data-testid="gps-entries">{{ gps.entries }}</strong> entri headcount
      </DsText>
      <DsText variant="caption">* Anggaran dari markah OTR, bukan SPM sebenar</DsText>
    </DsStack>
  </DsPanel>
</template>
