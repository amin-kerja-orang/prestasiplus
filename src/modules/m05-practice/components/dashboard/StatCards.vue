<script setup lang="ts">
/** FR-M05-10 / 11: the five gamification stat cards, each number counting up from 0. */
import type { Dashboard } from '../../api/types'
import CountNumber from './CountNumber.vue'
import { COUNT_RULES } from './dashboard-lib'

defineProps<{ wallet: Dashboard['wallet']; streak: Dashboard['streak']; week: Dashboard['week'] }>()
</script>

<template>
  <div class="grid grid-cols-2 gap-3 sm:gap-5 md:gap-7 lg:grid-cols-5" data-testid="dash-stats">
    <div class="gamification-card gold" data-testid="dash-stat-coins">
      <div class="text-center">
        <div class="icon-sparkle mb-2 text-2xl sm:mb-4 sm:text-5xl md:text-6xl">🪙</div>
        <div
          class="number-display mb-1 text-xl text-amber-700 sm:mb-3 sm:text-3xl md:text-5xl"
          data-testid="dash-stat-value"
        >
          <CountNumber :target="wallet.coins" :rule="COUNT_RULES.coins" />
        </div>
        <div
          class="text-sm font-black text-amber-800 sm:text-lg"
          style="font-family: 'Outfit', sans-serif"
        >
          Syiling Kamu
        </div>
      </div>
    </div>

    <div class="gamification-card purple" data-testid="dash-stat-points">
      <div class="text-center">
        <div class="icon-sparkle mb-2 text-2xl sm:mb-4 sm:text-5xl md:text-6xl">⭐</div>
        <div
          class="number-display mb-1 text-xl text-violet-700 sm:mb-3 sm:text-3xl md:text-5xl"
          data-testid="dash-stat-value"
        >
          <CountNumber :target="wallet.points" :rule="COUNT_RULES.points" />
        </div>
        <div
          class="text-sm font-black text-violet-800 sm:text-lg"
          style="font-family: 'Outfit', sans-serif"
        >
          Mata (Lvl {{ wallet.level }})
        </div>
        <div class="mt-2 h-2 w-full rounded-full bg-white/40">
          <div
            class="h-2 rounded-full bg-violet-600 transition-all duration-1000"
            :style="{ width: `${wallet.levelProgressPct}%` }"
            data-testid="dash-level-bar"
          ></div>
        </div>
      </div>
    </div>

    <div class="gamification-card fire" data-testid="dash-stat-streak">
      <div class="text-center">
        <div class="icon-sparkle mb-2 text-2xl sm:mb-4 sm:text-5xl md:text-6xl">🔥</div>
        <div
          class="number-display mb-1 text-xl text-orange-700 sm:mb-3 sm:text-3xl md:text-5xl"
          data-testid="dash-stat-value"
        >
          <CountNumber :target="streak.count" :rule="COUNT_RULES.streak" />
        </div>
        <div
          class="text-sm font-black text-orange-800 sm:text-lg"
          style="font-family: 'Outfit', sans-serif"
        >
          Hari Berturut
        </div>
      </div>
    </div>

    <div class="gamification-card blue" data-testid="dash-stat-sessions">
      <div class="text-center">
        <div class="icon-sparkle mb-2 text-2xl sm:mb-4 sm:text-5xl md:text-6xl">📋</div>
        <div
          class="number-display mb-1 text-xl text-blue-700 sm:mb-3 sm:text-3xl md:text-5xl"
          data-testid="dash-stat-value"
        >
          <CountNumber :target="week.sessions" :rule="COUNT_RULES.sessions" />
        </div>
        <div
          class="text-sm font-black text-blue-800 sm:text-lg"
          style="font-family: 'Outfit', sans-serif"
        >
          Sesi Minggu Ini
        </div>
      </div>
    </div>

    <div class="gamification-card green" data-testid="dash-stat-accuracy">
      <div class="text-center">
        <div class="icon-sparkle mb-2 text-2xl sm:mb-4 sm:text-5xl md:text-6xl">🎯</div>
        <div
          class="number-display mb-1 text-xl text-emerald-700 sm:mb-3 sm:text-3xl md:text-5xl"
          data-testid="dash-stat-value"
        >
          <CountNumber :target="week.accuracyPct" :rule="COUNT_RULES.accuracy" /><span
            class="text-4xl"
            >%</span
          >
        </div>
        <div
          class="text-sm font-black text-emerald-800 sm:text-lg"
          style="font-family: 'Outfit', sans-serif"
        >
          Ketepatan
        </div>
      </div>
    </div>
  </div>
</template>
