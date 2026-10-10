<script setup lang="ts">
/**
 * S2 card "Peta DSKP — Standard Pembelajaran" (FR-M27-58, 60…64): the caption "KSSM {Subjek} Tingkatan {n}",
 * one heading per Bidang ("{code} {name}") with one tile per SP (code, and the percent when answered),
 * the legend, and the empty text when the level or subject has no SP. Tiles are not links (FR-M27-63).
 * Text is 12 px and up.
 */
import { Map } from '@lucide/vue'

import type { HeatmapBidang } from '../../api/school-admin'
import { LEGEND, TILE_STYLE, tileTitle } from './dskp-status'

defineProps<{ caption: string | null; bidang: HeatmapBidang[]; empty: boolean }>()
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="dh-card">
    <h2 class="flex items-center gap-2 text-sm font-bold text-slate-700" data-testid="dh-heading">
      <Map class="h-4 w-4 shrink-0 text-blue-500" />Peta DSKP — Standard Pembelajaran
    </h2>

    <p
      v-if="empty"
      class="mt-4 rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500"
      data-testid="dh-empty"
    >
      Tiada Standard Pembelajaran untuk subjek dan tingkatan ini.
    </p>
    <template v-else>
      <p
        v-if="caption"
        class="mt-3 text-xs font-semibold tracking-wide text-slate-500 uppercase"
        data-testid="dh-caption"
      >
        {{ caption }}
      </p>

      <div v-for="b in bidang" :key="b.id" class="mt-4 min-w-0" data-testid="dh-bidang">
        <h3 class="text-sm font-semibold text-slate-700" data-testid="dh-bidang-title">
          {{ b.code ? `${b.code} ${b.name}` : b.name }}
        </h3>
        <div class="mt-2 flex flex-wrap gap-2" data-testid="dh-tiles">
          <div
            v-for="sp in b.sp"
            :key="sp.id"
            :class="[
              'flex min-h-11 min-w-12 flex-col items-center justify-center rounded-lg border px-2 py-1 text-xs font-semibold',
              TILE_STYLE[sp.status],
            ]"
            :title="tileTitle(sp)"
            :data-status="sp.status"
            data-testid="dh-tile"
          >
            <span data-testid="dh-tile-code">{{ sp.code }}</span>
            <span v-if="sp.pct !== null" class="font-bold" data-testid="dh-tile-pct"
              >{{ sp.pct }}%</span
            >
          </div>
        </div>
      </div>
    </template>

    <div
      class="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500"
      data-testid="dh-legend"
    >
      <span v-for="l in LEGEND" :key="l.status" class="flex items-center gap-1.5">
        <span :class="['h-3 w-3 rounded border', TILE_STYLE[l.status]]"></span>{{ l.label }}
      </span>
    </div>
  </section>
</template>
