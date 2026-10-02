<script setup lang="ts">
/** FN-M11-5.1.3: legend dots and the discrimination note; the note wraps under the dots on narrow screens. */
import { Info } from '@lucide/vue'

import { BAND_DOT } from './bands'
import { ITEM_COPY } from './copy'
</script>

<template>
  <div
    class="flex flex-wrap items-center gap-x-4 gap-y-2 px-1 text-sm text-slate-600"
    data-testid="item-legend"
  >
    <span class="inline-flex items-center gap-1.5"
      ><span :class="['h-3 w-3 rounded-full', BAND_DOT.mudah]" />{{ ITEM_COPY.legendMudah }}</span
    >
    <span class="inline-flex items-center gap-1.5"
      ><span :class="['h-3 w-3 rounded-full', BAND_DOT.sederhana]" />{{
        ITEM_COPY.legendSederhana
      }}</span
    >
    <span class="inline-flex items-center gap-1.5"
      ><span :class="['h-3 w-3 rounded-full', BAND_DOT.sukar]" />{{ ITEM_COPY.legendSukar }}</span
    >
    <span class="inline-flex items-center gap-1.5 sm:ml-2" data-testid="item-legend-note"
      ><Info class="h-4 w-4 text-slate-400" />{{ ITEM_COPY.legendNote }}</span
    >
  </div>
</template>
