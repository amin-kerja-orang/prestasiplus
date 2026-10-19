<script setup lang="ts">
/**
 * "Taburan Tahap Engagement" (FN-M12-5.3.1; FR-M12-43): five tiles, 5 columns at every width, each a link to
 * the monitoring overview with count, label, caption, mini bar (value = %) and the %.
 */
import { RouterLink } from 'vue-router'

import { DsPanel } from '@/ds'

import type { BandCount } from '../../../api/types'
import { BAND, pct, plain } from '../common/kirkpatrick-format'
import { BAND_CAPTION } from './behavior-format'

defineProps<{ bands: BandCount[]; monitoringPath: string }>()
</script>

<template>
  <DsPanel title="Taburan Tahap Engagement" icon="i-ph-chart-pie" data-testid="beh-bands">
    <div class="grid grid-cols-5 gap-1 sm:gap-3">
      <RouterLink
        v-for="b in bands"
        :key="b.key"
        :to="monitoringPath"
        class="flex min-w-0 flex-col items-center gap-1 bg-muted p-1 text-center sm:p-3"
        :data-testid="`beh-band-${b.key}`"
      >
        <p :class="['tabular text-subheading', BAND[b.key].text]" data-testid="band-count">
          {{ plain(b.count) }}
        </p>
        <p class="text-body break-words text-highlighted" data-testid="band-label">
          {{ BAND[b.key].label }}
        </p>
        <p class="text-body text-muted" data-testid="band-caption">
          {{ BAND_CAPTION[b.key] }}
        </p>
        <UProgress
          :model-value="b.pct"
          :max="100"
          :color="BAND[b.key].color"
          size="sm"
          class="w-full"
          :aria-label="`${BAND[b.key].label} ${pct(b.pct)}`"
          data-testid="band-bar"
        />
        <p :class="['tabular text-body', BAND[b.key].text]" data-testid="band-pct">
          {{ pct(b.pct) }}
        </p>
      </RouterLink>
    </div>
  </DsPanel>
</template>
