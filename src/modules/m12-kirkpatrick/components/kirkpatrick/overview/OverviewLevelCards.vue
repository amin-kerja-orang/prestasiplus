<script setup lang="ts">
/**
 * S1 level cards (FN-M12-2.2.1..2.2.5; FR-M12-20..23, 92): `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`, order
 * T4, T3, T2, T1, each a link with a left border, upper-case label, icon tile, value, caption and "Lihat
 * detail". `detail` off (the school-administrator alias, S1 only) renders them as plain boxes without the
 * "Lihat detail" line.
 */
import { ArrowRight, Brain, FaceSlightlySmiling, Footprints, Trophy } from '@lucide/vue'
import { computed } from 'vue'

import type { Overview } from '../../../api/types'
import { count, gps, KirkpatrickLink, mean, pct, plain, type KirkpatrickPaths } from '../common'

const props = defineProps<{ data: Overview; paths: KirkpatrickPaths; detail: boolean }>()

const to = (path: string) => (props.detail ? path : null)
const noGps = computed(() => props.data.t4.gps === null)
</script>

<template>
  <div
    class="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
    data-testid="kirk-levels"
  >
    <KirkpatrickLink
      :to="to(paths.results)"
      class="block min-w-0 rounded-2xl border-l-4 border-amber-500 bg-white p-4 shadow-sm"
      data-testid="kirk-level-t4"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-semibold tracking-wide text-amber-600 uppercase">Tahap 4: Hasil</p>
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-600"
          ><Trophy class="h-5 w-5"
        /></span>
      </div>
      <template v-if="noGps">
        <p class="mt-2 text-lg font-bold text-slate-400" data-testid="kirk-level-value">
          Belum Ada Data
        </p>
        <p class="text-xs text-slate-400" data-testid="kirk-level-caption">
          Import keputusan peperiksaan
        </p>
      </template>
      <template v-else>
        <p
          class="mt-2 font-heading text-3xl font-bold text-slate-800"
          data-testid="kirk-level-value"
        >
          {{ gps(data.t4.gps ?? 0) }}
        </p>
        <p class="text-xs text-slate-500" data-testid="kirk-level-caption">
          GPS Sekolah · {{ plain(data.t4.recordsLabel) }} rekod headcount
        </p>
      </template>
      <p v-if="detail" class="mt-2 flex items-center gap-1 text-xs text-amber-600">
        Lihat detail <ArrowRight class="h-3 w-3" />
      </p>
    </KirkpatrickLink>

    <KirkpatrickLink
      :to="to(paths.behavior)"
      class="block min-w-0 rounded-2xl border-l-4 border-blue-500 bg-white p-4 shadow-sm"
      data-testid="kirk-level-t3"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-semibold tracking-wide text-blue-600 uppercase">
          Tahap 3: Tingkah Laku
        </p>
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600"
          ><Footprints class="h-5 w-5"
        /></span>
      </div>
      <p class="mt-2 font-heading text-3xl font-bold text-slate-800" data-testid="kirk-level-value">
        {{ plain(data.t3.active)
        }}<span class="text-base font-medium text-slate-400">/{{ plain(data.t3.t4t5) }}</span>
      </p>
      <p class="text-xs text-slate-500" data-testid="kirk-level-caption">
        Pelajar aktif · {{ plain(data.t3.sessions) }} sesi · {{ pct(data.t3.accuracy) }} ketepatan
      </p>
      <p v-if="detail" class="mt-2 flex items-center gap-1 text-xs text-blue-600">
        Lihat detail <ArrowRight class="h-3 w-3" />
      </p>
    </KirkpatrickLink>

    <KirkpatrickLink
      :to="to(paths.learning)"
      class="block min-w-0 rounded-2xl border-l-4 border-green-500 bg-white p-4 shadow-sm"
      data-testid="kirk-level-t2"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-semibold tracking-wide text-green-600 uppercase">
          Tahap 2: Pembelajaran
        </p>
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600"
          ><Brain class="h-5 w-5"
        /></span>
      </div>
      <p class="mt-2 font-heading text-3xl font-bold text-slate-800" data-testid="kirk-level-value">
        {{ pct(data.t2.accuracy) }}
      </p>
      <p class="text-xs text-slate-500" data-testid="kirk-level-caption">
        Ketepatan · {{ count(data.t2.answers) }} soalan dijawab
      </p>
      <p v-if="detail" class="mt-2 flex items-center gap-1 text-xs text-green-600">
        Lihat detail <ArrowRight class="h-3 w-3" />
      </p>
    </KirkpatrickLink>

    <KirkpatrickLink
      :to="to(paths.reaction)"
      class="block min-w-0 rounded-2xl border-l-4 border-purple-500 bg-white p-4 shadow-sm"
      data-testid="kirk-level-t1"
    >
      <div class="flex items-start justify-between gap-2">
        <p class="text-xs font-semibold tracking-wide text-purple-600 uppercase">Tahap 1: Reaksi</p>
        <span
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600"
          ><FaceSlightlySmiling class="h-5 w-5"
        /></span>
      </div>
      <p class="mt-2 font-heading text-3xl font-bold text-slate-800" data-testid="kirk-level-value">
        {{ mean(data.t1.satisfaction) }}<span class="text-base font-medium text-slate-400">/5</span>
      </p>
      <p class="text-xs text-slate-500" data-testid="kirk-level-caption">
        Kepuasan purata · {{ plain(data.t1.responses) }} respon
      </p>
      <p v-if="detail" class="mt-2 flex items-center gap-1 text-xs text-purple-600">
        Lihat detail <ArrowRight class="h-3 w-3" />
      </p>
    </KirkpatrickLink>
  </div>
</template>
