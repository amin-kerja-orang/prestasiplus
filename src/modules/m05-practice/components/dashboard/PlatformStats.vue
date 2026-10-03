<script setup lang="ts">
/**
 * FR-M05-24 / 11: "Statistik Platform" — four counters counting up from 0. D9 (DV-M05-17, proposed):
 * the live number sizes (`md:text-5xl`) overflow their card and the page at 768 px and 1280 px
 * (6-digit totals in a ~100 px content box), so the sizes step down at `md` / `lg` and the number
 * box grows by the card padding (`sm:-mx-4`) to stay centred.
 */
import type { Dashboard } from '../../api/types'
import CountNumber from './CountNumber.vue'
import { COUNT_RULES } from './dashboard-lib'

defineProps<{ stats: Dashboard['stats'] }>()
</script>

<template>
  <div data-testid="dash-platform">
    <h2
      class="mb-3 text-lg font-black text-slate-800 sm:mb-6 sm:text-2xl md:text-3xl"
      style="font-family: 'Outfit', sans-serif"
    >
      📊 Statistik Platform
    </h2>
    <div class="grid grid-cols-2 gap-2 sm:gap-5 md:grid-cols-4 md:gap-7">
      <div class="platform-stat-card" data-testid="dash-platform-total">
        <div class="icon-sparkle mb-2 text-3xl sm:mb-4 sm:text-5xl md:text-6xl">📚</div>
        <div
          class="number-display gradient-text mb-1 text-xl sm:-mx-4 sm:mb-3 sm:text-3xl md:text-4xl lg:text-3xl 2xl:text-5xl"
          data-testid="dash-platform-value"
        >
          <CountNumber :target="stats.totalQuestions" :rule="COUNT_RULES.totalQuestions" />
        </div>
        <div class="text-base font-black text-slate-600" style="font-family: 'Outfit', sans-serif">
          Total Soalan
        </div>
      </div>
      <div class="platform-stat-card" data-testid="dash-platform-subjects">
        <div class="icon-sparkle mb-2 text-3xl sm:mb-4 sm:text-5xl md:text-6xl">📖</div>
        <div
          class="number-display mb-1 text-xl text-emerald-600 sm:-mx-4 sm:mb-3 sm:text-3xl md:text-4xl lg:text-3xl 2xl:text-5xl"
          data-testid="dash-platform-value"
        >
          <CountNumber :target="stats.activeSubjects" :rule="COUNT_RULES.activeSubjects" />
        </div>
        <div class="text-base font-black text-slate-600" style="font-family: 'Outfit', sans-serif">
          Subjek Aktif
        </div>
      </div>
      <div class="platform-stat-card" data-testid="dash-platform-levels">
        <div class="icon-sparkle mb-2 text-3xl sm:mb-4 sm:text-5xl md:text-6xl">🎯</div>
        <div
          class="number-display mb-1 text-xl text-purple-600 sm:-mx-4 sm:mb-3 sm:text-3xl md:text-4xl lg:text-3xl 2xl:text-5xl"
          data-testid="dash-platform-value"
        >
          <CountNumber :target="stats.activeLevels" :rule="COUNT_RULES.activeLevels" />
        </div>
        <div class="text-base font-black text-slate-600" style="font-family: 'Outfit', sans-serif">
          Tahap Pendidikan
        </div>
      </div>
      <div class="platform-stat-card" data-testid="dash-platform-approved">
        <div class="icon-sparkle mb-2 text-3xl sm:mb-4 sm:text-5xl md:text-6xl">✅</div>
        <div
          class="number-display mb-1 text-xl text-green-600 sm:-mx-4 sm:mb-3 sm:text-3xl md:text-4xl lg:text-3xl 2xl:text-5xl"
          data-testid="dash-platform-value"
        >
          <CountNumber :target="stats.approvedQuestions" :rule="COUNT_RULES.approvedQuestions" />
        </div>
        <div class="text-base font-black text-slate-600" style="font-family: 'Outfit', sans-serif">
          Soalan Approved
        </div>
      </div>
    </div>
  </div>
</template>
