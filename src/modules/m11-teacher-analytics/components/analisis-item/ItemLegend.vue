<script setup lang="ts">
/** FN-M11-5.1.3: legend dots and the discrimination note; the note wraps under the dots on narrow screens. */
import { BAND_COLOR } from './bands'
import { ITEM_COPY } from './copy'
import { DsCluster } from '@/ds'
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 text-caption text-muted" data-testid="item-legend">
    <UBadge
      :color="BAND_COLOR.mudah"
      data-band="mudah"
      variant="subtle"
      icon="i-ph-circle-fill"
      :label="ITEM_COPY.legendMudah"
    />
    <UBadge
      :color="BAND_COLOR.sederhana"
      data-band="sederhana"
      variant="subtle"
      icon="i-ph-circle-fill"
      :label="ITEM_COPY.legendSederhana"
    />
    <UBadge
      :color="BAND_COLOR.sukar"
      data-band="sukar"
      variant="subtle"
      icon="i-ph-circle-fill"
      :label="ITEM_COPY.legendSukar"
    />
    <DsCluster as="span" gap="2xs" :wrap="false" data-testid="item-legend-note"
      ><UIcon name="i-ph-info" class="size-4" />{{ ITEM_COPY.legendNote }}</DsCluster
    >
  </div>
</template>
