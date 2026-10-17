<script setup lang="ts">
/** "ROI Platform (Anggaran)" (FN-M12-6.8.1; FR-M12-58; BR-M12-23): four figures and the static note. */
import type { Results } from '../../../api/types'
import KirkpatrickPanel from '../common/KirkpatrickPanel.vue'
import { gps, mean, pct, plain } from '../common/kirkpatrick-format'

defineProps<{ roi: Results['roi'] }>()

const STEPS = [
  'Keputusan peperiksaan sebenar (SPM/dalaman) diimport',
  'Data kos langganan platform dimasukkan',
  'Perbandingan prestasi pelajar aktif vs tidak aktif dapat dibuat',
]
</script>

<template>
  <KirkpatrickPanel title="ROI Platform (Anggaran)" icon="i-ph-coins" data-testid="res-roi">
    <div class="flex flex-col gap-4">
      <div class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <div>
          <p class="text-caption text-muted">Pelajar Aktif</p>
          <p class="tabular text-subheading text-highlighted" data-testid="roi-active">
            {{ plain(roi.active) }}
          </p>
        </div>
        <div>
          <p class="text-caption text-muted">Purata Soalan/Pelajar</p>
          <p class="tabular text-subheading text-highlighted" data-testid="roi-per-student">
            {{ mean(roi.perStudent) }}
          </p>
        </div>
        <div>
          <p class="text-caption text-muted">Ketepatan Aktif</p>
          <p class="tabular text-subheading text-highlighted" data-testid="roi-accuracy">
            {{ pct(roi.accuracy) }}
          </p>
        </div>
        <div>
          <p class="text-caption text-muted">GPS Headcount</p>
          <p class="tabular text-subheading text-highlighted" data-testid="roi-gps">
            {{ roi.gps === null ? '-' : gps(roi.gps) }}
          </p>
        </div>
      </div>
      <UAlert
        color="warning"
        variant="soft"
        icon="i-ph-calculator"
        title="ROI penuh akan dapat dikira apabila:"
      >
        <template #description>
          <ol class="flex flex-col gap-1">
            <li v-for="(s, i) in STEPS" :key="s">{{ i + 1 }}. {{ s }}</li>
          </ol>
        </template>
      </UAlert>
    </div>
  </KirkpatrickPanel>
</template>
