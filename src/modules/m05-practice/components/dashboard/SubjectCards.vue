<script setup lang="ts">
/** FR-M05-23: "Subjek Tersedia" — one card per practice subject (BR-01 order). */
import { RouterLink } from 'vue-router'

import type { PracticeSubject } from '../../api/types'
import SubjectIcon from '../quiz/SubjectIcon.vue'

defineProps<{ subjects: PracticeSubject[] }>()
</script>

<template>
  <div data-testid="dash-subjects">
    <div class="mb-3 flex items-center justify-between gap-3 sm:mb-6">
      <h2
        class="text-lg font-black text-slate-800 sm:text-2xl md:text-4xl"
        style="font-family: 'Outfit', sans-serif"
      >
        📖 Subjek Tersedia
      </h2>
      <span
        class="rounded-full bg-linear-to-r from-indigo-400 to-purple-400 px-3 py-1.5 text-xs font-black whitespace-nowrap text-white shadow-lg sm:px-5 sm:py-2.5 sm:text-base md:text-lg"
        data-testid="dash-subjects-count"
      >
        {{ subjects.length }} subjek
      </span>
    </div>
    <div class="grid grid-cols-1 gap-3 sm:gap-7 md:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="s in subjects"
        :key="s.code"
        class="subject-card"
        :style="{ '--subject-color': s.color }"
        :data-testid="`dash-subject-${s.code}`"
      >
        <div class="mb-2 flex items-start justify-between gap-2 sm:mb-5">
          <div
            class="subject-icon-circle"
            :style="{ background: `${s.color}25`, boxShadow: `0 4px 16px ${s.color}30` }"
            data-testid="dash-subject-icon"
          >
            <SubjectIcon :icon="s.icon" class="h-5 w-5 sm:h-9 sm:w-9" :style="{ color: s.color }" />
          </div>
          <span
            class="rounded-full px-2.5 py-1 text-xs font-black shadow-md sm:px-4 sm:py-2 sm:text-sm"
            :style="{ background: `${s.color}25`, color: s.color }"
            data-testid="dash-subject-count"
          >
            {{ s.approvedCount }} soalan
          </span>
        </div>
        <h3
          class="mb-1 text-base leading-tight font-black break-words text-slate-800 sm:mb-2 sm:text-2xl md:text-3xl"
          style="font-family: 'Outfit', sans-serif"
          data-testid="dash-subject-name"
        >
          {{ s.name }}
        </h3>
        <p class="mb-2 text-xs font-semibold text-slate-500 sm:mb-6 sm:text-base">{{ s.nameEn }}</p>
        <div v-if="s.isCore" class="mb-2 sm:mb-5">
          <span
            class="inline-flex items-center rounded-full border-2 border-purple-300 bg-purple-100 px-3 py-1.5 text-sm font-black text-purple-700"
            data-testid="dash-subject-core"
          >
            <span class="mr-1.5">⭐</span> Subjek Teras
          </span>
        </div>
        <RouterLink
          :to="`/practice?subject=${s.code}`"
          class="block min-h-11 w-full transform rounded-xl py-2.5 text-center text-sm font-black text-white shadow-lg transition hover:scale-105 hover:shadow-2xl sm:rounded-2xl sm:py-4 sm:text-lg"
          :style="{ background: `linear-gradient(135deg, ${s.color} 0%, ${s.color} 100%)` }"
          data-testid="dash-subject-start"
        >
          Mula Latihan 🚀
        </RouterLink>
      </div>
    </div>
  </div>
</template>
