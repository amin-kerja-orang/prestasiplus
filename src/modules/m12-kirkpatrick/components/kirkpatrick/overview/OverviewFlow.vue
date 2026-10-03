<script setup lang="ts">
/**
 * S1 "Kirkpatrick Evaluation Flow" (FN-M12-2.3.1..2.3.3; FR-M12-24, 25, 92): from `sm` four circles T1 to T4
 * on a gradient line, each a link with label, sub-label and pill; below `sm` the same four as a vertical
 * list with a chevron. `detail` off renders plain boxes (the alias has no level pages).
 */
import { Brain, ChevronRight, FaceSlightlySmiling, Footprints, Trophy, Workflow } from '@lucide/vue'
import { computed, type Component } from 'vue'

import type { Overview } from '../../../api/types'
import { CARD, gps, KirkpatrickLink, mean, pct, plain, type KirkpatrickPaths } from '../common'

const props = defineProps<{ data: Overview; paths: KirkpatrickPaths; detail: boolean }>()

interface Step {
  key: string
  label: string
  sub: string
  pill: string
  to: string | null
  icon: Component
  tile: string
  pillClass: string
}

const to = (path: string) => (props.detail ? path : null)

const steps = computed<Step[]>(() => [
  {
    key: 't1',
    label: 'T1: Reaksi',
    sub: 'Kepuasan pengguna',
    pill: `${mean(props.data.t1.satisfaction)}/5`,
    to: to(props.paths.reaction),
    icon: FaceSlightlySmiling,
    tile: 'bg-purple-100 text-purple-600',
    pillClass: 'bg-purple-50 text-purple-600',
  },
  {
    key: 't2',
    label: 'T2: Pembelajaran',
    sub: 'Peningkatan kemahiran',
    pill: `${pct(props.data.t2.accuracy)} ketepatan`,
    to: to(props.paths.learning),
    icon: Brain,
    tile: 'bg-green-100 text-green-600',
    pillClass: 'bg-green-50 text-green-600',
  },
  {
    key: 't3',
    label: 'T3: Tingkah Laku',
    sub: 'Konsistensi penggunaan',
    pill: `${plain(props.data.t3.active)} pelajar aktif`,
    to: to(props.paths.behavior),
    icon: Footprints,
    tile: 'bg-blue-100 text-blue-600',
    pillClass: 'bg-blue-50 text-blue-600',
  },
  {
    key: 't4',
    label: 'T4: Hasil',
    sub: 'Keputusan peperiksaan',
    pill: `GPS ${props.data.t4.gps === null ? '-' : gps(props.data.t4.gps)}`,
    to: to(props.paths.results),
    icon: Trophy,
    tile: 'bg-amber-100 text-amber-600',
    pillClass: 'bg-amber-50 text-amber-600',
  },
])
</script>

<template>
  <section :class="[CARD, 'p-3 sm:p-5']" data-testid="kirk-flow">
    <div class="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 class="flex items-center gap-2 font-heading text-base font-bold text-slate-800">
        <Workflow class="h-5 w-5 text-indigo-600" />Kirkpatrick Evaluation Flow
      </h2>
      <p class="text-xs text-slate-400">Klik mana-mana tahap untuk lihat detail</p>
    </div>

    <div class="relative hidden sm:block" data-testid="kirk-flow-circles">
      <div
        class="absolute top-6 right-[12%] left-[12%] h-0.5 bg-gradient-to-r from-purple-300 via-blue-300 via-green-300 to-amber-300"
      />
      <div class="relative grid grid-cols-4 gap-2">
        <KirkpatrickLink
          v-for="s in steps"
          :key="s.key"
          :to="s.to"
          class="flex min-w-0 flex-col items-center gap-1 text-center"
          :data-testid="`kirk-flow-${s.key}`"
        >
          <span :class="['flex h-12 w-12 items-center justify-center rounded-full shadow', s.tile]">
            <component :is="s.icon" class="h-5 w-5" />
          </span>
          <span class="text-sm font-semibold text-slate-800">{{ s.label }}</span>
          <span class="text-xs text-slate-400">{{ s.sub }}</span>
          <span
            :class="['rounded-full px-2 py-0.5 text-xs font-semibold', s.pillClass]"
            data-testid="kirk-flow-pill"
            >{{ s.pill }}</span
          >
        </KirkpatrickLink>
      </div>
    </div>

    <ul class="space-y-2 sm:hidden" data-testid="kirk-flow-list">
      <li v-for="s in steps" :key="s.key">
        <KirkpatrickLink
          :to="s.to"
          class="flex min-h-11 items-center gap-3 rounded-xl p-2"
          :data-testid="`kirk-flow-list-${s.key}`"
        >
          <span
            :class="['flex h-10 w-10 shrink-0 items-center justify-center rounded-full', s.tile]"
          >
            <component :is="s.icon" class="h-5 w-5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-slate-800">{{ s.label }}</span>
            <span class="block text-xs text-slate-400">{{ s.sub }}</span>
          </span>
          <span
            :class="['shrink-0 text-xs font-semibold', s.pillClass]"
            data-testid="kirk-flow-pill"
            >{{ s.pill }}</span
          >
          <ChevronRight v-if="s.to !== null" class="h-4 w-4 shrink-0 text-slate-300" />
        </KirkpatrickLink>
      </li>
    </ul>
  </section>
</template>
