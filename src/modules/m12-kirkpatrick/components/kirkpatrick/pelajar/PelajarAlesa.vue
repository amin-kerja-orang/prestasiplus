<script setup lang="ts">
/**
 * The ALESA card of S8 (FN-M12-9.2.1 ... 9.2.3; FR-M12-79 ... 81): "AI" badge, the composed paragraph, four tiles (2 x 2 below
 * `sm`) and the "Terkuat: … · Perlu perhatian: …" line (empty for a student without answers).
 */
import { computed } from 'vue'

import type { StudentKirkpatrick } from '../../../api/types'
import { count, mean, pct, pct1 } from '../common/kirkpatrick-format'
import { alesaParagraph } from './pelajar-format'

const props = defineProps<{ data: StudentKirkpatrick }>()

const paragraph = computed(() => alesaParagraph(props.data))
const TILE = 'min-w-0 rounded-xl bg-white/15 p-3 text-center'
</script>

<template>
  <section
    class="min-w-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-4 text-white sm:p-5"
    data-testid="pel-alesa"
  >
    <div class="flex items-center gap-2">
      <span
        class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-xs font-bold"
        >AI</span
      >
      <h2 class="font-heading text-sm font-bold text-white sm:text-base">
        ALESA — Analisis Tingkah Laku Kirkpatrick
      </h2>
    </div>
    <p class="mt-3 text-sm leading-relaxed" data-testid="pel-paragraph">{{ paragraph }}</p>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div :class="TILE" data-testid="pel-tile-answers">
        <p class="font-heading text-xl font-bold">{{ count(data.answers) }}</p>
        <p class="text-xs text-white/80">Soalan</p>
      </div>
      <div :class="TILE" data-testid="pel-tile-accuracy">
        <p class="font-heading text-xl font-bold">{{ pct(data.accuracy) }}</p>
        <p class="text-xs text-white/80">Ketepatan</p>
      </div>
      <div :class="TILE" data-testid="pel-tile-konsistensi">
        <p class="font-heading text-xl font-bold">{{ mean(data.konsistensi) }}</p>
        <p class="text-xs text-white/80">Konsistensi</p>
      </div>
      <div :class="TILE" data-testid="pel-tile-streak">
        <p class="font-heading text-xl font-bold">{{ data.streak }}d</p>
        <p class="text-xs text-white/80">Streak</p>
      </div>
    </div>
    <p
      v-if="data.strongest && data.weakest"
      class="mt-3 text-xs text-white/90"
      data-testid="pel-strength"
    >
      Terkuat:
      <strong>{{ data.strongest.subjectName }} ({{ pct1(data.strongest.accuracy) }})</strong>
      · Perlu perhatian:
      <strong>{{ data.weakest.subjectName }} ({{ pct1(data.weakest.accuracy) }})</strong>
    </p>
  </section>
</template>
