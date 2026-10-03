<script setup lang="ts">
/**
 * "Taburan Tahap Engagement" (FN-M12-5.3.1; FR-M12-43): five tiles, 5 columns at every width, each a link to
 * the monitoring overview with count, label, caption, mini bar (width = %) and the %.
 */
import { RouterLink } from 'vue-router'

import { AppIcon } from '@/components/icon'

import type { BandCount } from '../../../api/types'
import { BAND, CARD, pct, plain } from '../common/kirkpatrick-format'
import { BAND_CAPTION, BAND_FILL } from './behavior-format'

defineProps<{ bands: BandCount[]; monitoringPath: string }>()
</script>

<template>
  <section :class="[CARD, 'min-w-0 p-3 sm:p-5']" data-testid="beh-bands">
    <h2 class="mb-3 flex items-center gap-2 font-heading text-base font-bold text-slate-800">
      <AppIcon name="fa-chart-pie" class="h-4 w-4 text-indigo-600" />Taburan Tahap Engagement
    </h2>
    <div class="grid grid-cols-5 gap-1 sm:gap-3">
      <RouterLink
        v-for="b in bands"
        :key="b.key"
        :to="monitoringPath"
        :class="['block min-w-0 rounded-xl p-1.5 text-center sm:p-3', BAND[b.key].tile]"
        :data-testid="`beh-band-${b.key}`"
      >
        <p
          :class="['font-heading text-xl font-bold sm:text-3xl', BAND[b.key].text]"
          data-testid="band-count"
        >
          {{ plain(b.count) }}
        </p>
        <p
          class="text-[10px] leading-tight font-semibold break-words text-slate-700 sm:text-sm"
          data-testid="band-label"
        >
          {{ BAND[b.key].label }}
        </p>
        <p class="text-[10px] leading-tight text-slate-400 sm:text-xs" data-testid="band-caption">
          {{ BAND_CAPTION[b.key] }}
        </p>
        <div class="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            :class="['h-2 rounded-full', BAND_FILL[b.key]]"
            :style="{ width: `${b.pct}%` }"
            data-testid="band-bar"
          />
        </div>
        <p
          :class="['mt-1 text-[10px] font-medium sm:text-xs', BAND[b.key].text]"
          data-testid="band-pct"
        >
          {{ pct(b.pct) }}
        </p>
      </RouterLink>
    </div>
  </section>
</template>
