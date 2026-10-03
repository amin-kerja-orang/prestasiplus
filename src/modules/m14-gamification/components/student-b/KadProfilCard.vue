<script setup lang="ts">
/** S18 "Kad Profil Pelajar" card (FN-M14-6.2.2): initial, name, stats, tier, level, syiling. */
import { formatNumber } from '@/lib/number'

import type { ShareCards } from '../../api'
import { KAD_COPY, pct1, tierName } from '../../lib/student/kadkongsi-lib'

defineProps<{ data: ShareCards }>()
</script>

<template>
  <div
    class="rounded-2xl bg-linear-to-br from-indigo-500 via-violet-500 to-violet-400 p-6 text-center text-white"
  >
    <div
      class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white/25 text-3xl font-bold"
      data-testid="kad-profil-initial"
    >
      {{ data.initial }}
    </div>
    <div class="mt-3 text-xl font-bold wrap-anywhere" data-testid="kad-profil-name">
      {{ data.name }}
    </div>
    <div class="text-xs text-white/80">{{ KAD_COPY.brand }}</div>
    <div class="mt-4 flex justify-center gap-2">
      <div class="min-w-0 flex-1 rounded-xl bg-white/15 px-2 py-2">
        <div class="text-xl font-bold" data-testid="kad-profil-answered">
          {{ formatNumber(data.profile.answered) }}
        </div>
        <div class="text-xs text-white/70">{{ KAD_COPY.soalan }}</div>
      </div>
      <div class="min-w-0 flex-1 rounded-xl bg-white/15 px-2 py-2">
        <div class="text-xl font-bold text-yellow-300" data-testid="kad-profil-accuracy">
          {{ pct1(data.profile.accuracy) }}%
        </div>
        <div class="text-xs text-white/70">{{ KAD_COPY.ketepatan }}</div>
      </div>
      <div class="min-w-0 flex-1 rounded-xl bg-white/15 px-2 py-2">
        <div class="text-xl font-bold" data-testid="kad-profil-sessions">
          {{ formatNumber(data.profile.sessions) }}
        </div>
        <div class="text-xs text-white/70">{{ KAD_COPY.sesi }}</div>
      </div>
    </div>
    <div class="mt-4 flex flex-wrap justify-center gap-2 text-xs font-bold">
      <span class="rounded-full bg-white/20 px-3 py-1" data-testid="kad-profil-tier"
        >{{ data.profile.tierIcon }} {{ tierName(data.profile.tierKey) }}</span
      >
      <span class="rounded-full bg-white/20 px-3 py-1" data-testid="kad-profil-level"
        >Lvl {{ data.profile.level }}</span
      >
      <span class="rounded-full bg-white/20 px-3 py-1" data-testid="kad-profil-syiling"
        >🪙 {{ formatNumber(data.profile.currentSyiling) }}</span
      >
    </div>
    <div class="mt-4 border-t border-white/20 pt-3 text-xs text-white/70">{{ KAD_COPY.site }}</div>
  </div>
</template>
