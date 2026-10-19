<script setup lang="ts">
/** "ROI Platform (Anggaran)" (FN-M12-6.8.1; FR-M12-58; BR-M12-23): four figures and the static note. */
import { DsPanel, DsStack, DsGrid, DsText } from '@/ds'

import type { Results } from '../../../api/types'
import { gps, mean, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ roi: Results['roi'] }>()

const STEPS = [
  'Keputusan peperiksaan sebenar (SPM/dalaman) diimport',
  'Data kos langganan platform dimasukkan',
  'Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat',
]
</script>

<template>
  <DsPanel title="ROI Platform (Anggaran)" icon="i-ph-coins" data-testid="res-roi">
    <DsStack>
      <DsGrid :cols="{ base: 2, sm: 4 }" gap="sm" class="text-center">
        <div>
          <DsText variant="body" tone="muted">Pelajar Aktif</DsText>
          <DsText variant="subheading" tabular data-testid="roi-active">
            {{ plain(roi.active) }}
          </DsText>
        </div>
        <div>
          <DsText variant="body" tone="muted">Purata Soalan/Pelajar</DsText>
          <DsText variant="subheading" tabular data-testid="roi-per-student">
            {{ mean(roi.perStudent) }}
          </DsText>
        </div>
        <div>
          <DsText variant="body" tone="muted">Ketepatan Aktif</DsText>
          <DsText variant="subheading" tabular data-testid="roi-accuracy">
            {{ pct(roi.accuracy) }}
          </DsText>
        </div>
        <div>
          <DsText variant="body" tone="muted">GPS Headcount</DsText>
          <DsText variant="subheading" tabular data-testid="roi-gps">
            {{ roi.gps === null ? '-' : gps(roi.gps) }}
          </DsText>
        </div>
      </DsGrid>
      <UAlert
        color="warning"
        variant="soft"
        icon="i-ph-calculator"
        title="ROI penuh akan dapat dikira apabila:"
      >
        <template #description>
          <DsStack as="ol" gap="2xs">
            <li v-for="(s, i) in STEPS" :key="s">{{ i + 1 }}. {{ s }}</li>
          </DsStack>
        </template>
      </UAlert>
    </DsStack>
  </DsPanel>
</template>
