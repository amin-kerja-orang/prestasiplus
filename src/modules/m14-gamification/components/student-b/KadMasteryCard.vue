<script setup lang="ts">
/** S18 "Kad Penguasaan Subjek" card (FN-M14-6.2.4): one subject of the M05 mastery records. */
import { formatNumber } from '@/lib/number'

import type { ShareCards } from '../../api'
import { KAD_COPY, masteryGradient, pct1 } from '../../lib/student/kadkongsi-lib'

type Mastery = ShareCards['mastery'][number]

defineProps<{ item: Mastery; name: string }>()
</script>

<template>
  <div :class="['rounded-2xl p-6 text-center text-white', masteryGradient(item.level)]">
    <div class="text-xs tracking-widest text-white/70 uppercase">
      {{ KAD_COPY.penguasaanLabel }}
    </div>
    <div class="mt-2 text-xl font-bold wrap-anywhere" data-testid="kad-mastery-subject">
      {{ item.subjectName }}
    </div>
    <span
      class="mt-2 inline-block rounded-full bg-white/25 px-3 py-1 text-xs font-bold"
      data-testid="kad-mastery-stage"
      >Tahap {{ item.level }} — {{ item.stage }}</span
    >
    <div class="mt-4 flex justify-center gap-3">
      <div class="min-w-0 rounded-xl bg-white/20 px-4 py-2">
        <div class="text-xl font-bold" data-testid="kad-mastery-accuracy">
          {{ pct1(item.accuracy) }}%
        </div>
        <div class="text-xs text-white/80">{{ KAD_COPY.ketepatan }}</div>
      </div>
      <div class="min-w-0 rounded-xl bg-white/20 px-4 py-2">
        <div class="text-xl font-bold" data-testid="kad-mastery-correct">
          {{ formatNumber(item.correct) }}
        </div>
        <div class="text-xs text-white/80">{{ KAD_COPY.betul }}</div>
      </div>
    </div>
    <div class="mt-4 text-base font-bold wrap-anywhere">{{ name }}</div>
    <div class="text-xs text-white/70">{{ KAD_COPY.site }}</div>
  </div>
</template>
