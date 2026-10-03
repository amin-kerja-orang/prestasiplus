<script setup lang="ts">
/** FR-M05-28: "Statistik Subjek" — one card per subject, sorted by `bankCount` descending. */
import type { DashboardSubjectStat } from '../../api/types'
import SubjectIcon from '../quiz/SubjectIcon.vue'
import { starStates } from './dashboard-lib'

defineProps<{ stats: DashboardSubjectStat[] }>()
</script>

<template>
  <div class="card" data-testid="dash-subject-stats">
    <h2
      class="mb-3 text-lg font-black text-slate-800 sm:mb-6 sm:text-2xl md:text-3xl"
      style="font-family: 'Outfit', sans-serif"
    >
      📊 Statistik Subjek
    </h2>
    <div class="grid grid-cols-1 gap-3 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="s in stats"
        :key="s.id"
        class="subject-stat-card min-w-0"
        data-testid="dash-subject-stat"
      >
        <div class="mb-3 flex items-center space-x-3 sm:mb-5 sm:space-x-5">
          <div class="flex-shrink-0 text-2xl sm:text-4xl md:text-5xl" data-testid="dash-stat-icon">
            <SubjectIcon :icon="s.icon" class="h-6 w-6 sm:h-9 sm:w-9" :style="{ color: s.color }" />
          </div>
          <div class="min-w-0 flex-1">
            <div
              class="text-lg font-black break-words text-slate-800"
              style="font-family: 'Outfit', sans-serif"
              data-testid="dash-stat-name"
            >
              {{ s.name }}
            </div>
            <div class="text-sm font-bold text-slate-500" data-testid="dash-stat-bank">
              {{ s.bankCount }} soalan
            </div>
          </div>
        </div>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-bold text-slate-600">Kesukaran:</span>
            <div class="flex items-center space-x-0.5" data-testid="dash-stat-stars">
              <span
                v-for="(on, i) in starStates(s.avgDifficulty)"
                :key="i"
                :class="['text-sm', on ? 'text-amber-500' : 'text-slate-300']"
                :data-on="on ? 'true' : 'false'"
                >⭐</span
              >
            </div>
          </div>
          <div class="flex items-center justify-between border-t-2 border-slate-200 pt-3">
            <span class="text-sm font-bold text-slate-600">Digunakan:</span>
            <span class="text-base font-black text-indigo-600" data-testid="dash-stat-used"
              >{{ s.usedCount }}x</span
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
