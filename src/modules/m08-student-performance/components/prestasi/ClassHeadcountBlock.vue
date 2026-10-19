<script setup lang="ts">
/** S5 "📈 Headcount — Ringkasan Kelas" (discovery §2.22.2): shown only when the class has a config. */
import { DsPanel, DsStatTile } from '@/ds'
import { RouterLink } from 'vue-router'

import type { ClassDashboard } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { pctTrim } from '../../lib/prestasi/format'

defineProps<{ block: NonNullable<ClassDashboard['headcount']> }>()

const icon = usePhIcon()
</script>

<template>
  <DsPanel data-testid="headcount-block">
    <div class="flex flex-col gap-4">
      <h2 class="text-subheading text-highlighted">📈 Headcount — Ringkasan Kelas</h2>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <li>
          <DsStatTile
            :value="block.onTrack"
            unit="On Track / Above"
            :icon="icon('check-circle')"
            data-testid="hc-on"
          />
        </li>
        <li>
          <DsStatTile
            :value="block.below"
            unit="Below Target"
            :icon="icon('warning')"
            data-testid="hc-below"
          />
        </li>
        <li>
          <DsStatTile
            :value="block.noData"
            unit="Tiada Data"
            :icon="icon('minus')"
            data-testid="hc-none"
          />
        </li>
      </ul>
      <div class="flex flex-col gap-2" data-testid="hc-bar">
        <UProgress
          :model-value="block.pct.on"
          :max="100"
          color="success"
          size="md"
          aria-label="On Track"
        />
        <p class="tabular text-caption text-muted">
          On Track {{ block.pct.on }}% · Below {{ block.pct.below }}% · Tiada Data
          {{ block.pct.none }}%
        </p>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 text-caption text-muted">
        <span class="flex flex-wrap gap-4">
          <span data-testid="hc-tov"
            >Purata TOV: {{ block.avgTov === null ? '—' : pctTrim(block.avgTov) }}</span
          >
          <span data-testid="hc-etr"
            >Purata ETR: {{ block.avgEtr === null ? '—' : pctTrim(block.avgEtr) }}</span
          >
        </span>
        <RouterLink
          :to="`/headcount/${block.configId}/summary`"
          class="inline-flex min-h-11 items-center text-label text-primary-t"
          data-testid="hc-full"
          >Lihat Penuh →</RouterLink
        >
      </div>
    </div>
  </DsPanel>
</template>
