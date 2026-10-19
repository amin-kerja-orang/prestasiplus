<script setup lang="ts">
/** S5 "📈 Headcount — Ringkasan Kelas" (discovery §2.22.2): shown only when the class has a config. */
import { DsPanel, DsStatTile, DsStack, DsGrid, DsCluster, DsHeading, DsText } from '@/ds'
import { RouterLink } from 'vue-router'

import type { ClassDashboard } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { pctTrim } from '../../lib/prestasi/format'

defineProps<{ block: NonNullable<ClassDashboard['headcount']> }>()

const icon = usePhIcon()
</script>

<template>
  <DsPanel data-testid="headcount-block">
    <DsStack>
      <DsHeading :level="2" variant="subheading">📈 Headcount — Ringkasan Kelas</DsHeading>
      <DsGrid :cols="{ base: 1, sm: 3 }" gap="sm" as="ul">
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
      </DsGrid>
      <DsStack gap="xs" data-testid="hc-bar">
        <UProgress
          :model-value="block.pct.on"
          :max="100"
          color="success"
          size="md"
          aria-label="On Track"
        />
        <DsText variant="caption" tabular>
          On Track {{ block.pct.on }}% · Below {{ block.pct.below }}% · Tiada Data
          {{ block.pct.none }}%
        </DsText>
      </DsStack>
      <div class="flex flex-wrap items-center justify-between gap-3 text-caption text-muted">
        <DsCluster as="span" gap="md" align="stretch">
          <span data-testid="hc-tov"
            >Purata TOV: {{ block.avgTov === null ? '—' : pctTrim(block.avgTov) }}</span
          >
          <span data-testid="hc-etr"
            >Purata ETR: {{ block.avgEtr === null ? '—' : pctTrim(block.avgEtr) }}</span
          >
        </DsCluster>
        <RouterLink
          :to="`/headcount/${block.configId}/summary`"
          class="inline-flex min-h-11 items-center text-label text-primary-t"
          data-testid="hc-full"
          >Lihat Penuh →</RouterLink
        >
      </div>
    </DsStack>
  </DsPanel>
</template>
