<script setup lang="ts">
/** FR-M05-26: "Soalan Terkini" — the 5 newest questions (not links). */
import { diffForHumans } from '@/lib/time'

import type { DashboardRecentQuestion, PracticeSubject } from '../../api/types'
import { starStates, subjectColorByName } from './dashboard-lib'

defineProps<{ questions: DashboardRecentQuestion[]; subjects: PracticeSubject[] }>()
</script>

<template>
  <div class="card min-w-0" data-testid="dash-recent">
    <div class="mb-3 flex items-center justify-between sm:mb-6">
      <h2
        class="text-lg font-black text-slate-800 sm:text-2xl md:text-3xl"
        style="font-family: 'Outfit', sans-serif"
      >
        ⚡ Soalan Terkini
      </h2>
      <span class="icon-sparkle text-3xl">📝</span>
    </div>
    <div class="space-y-4">
      <div v-for="q in questions" :key="q.id" class="question-item" data-testid="dash-recent-item">
        <div class="mb-3 flex items-start justify-between gap-2">
          <span
            class="rounded-full bg-indigo-100 px-4 py-1.5 text-xs font-black text-indigo-700 uppercase"
            data-testid="dash-recent-subject"
          >
            {{ q.subjectName }}
          </span>
          <div class="flex flex-shrink-0 items-center space-x-0.5" data-testid="dash-recent-stars">
            <span
              v-for="(on, i) in starStates(q.difficulty)"
              :key="i"
              :class="['text-base', on ? 'text-amber-500' : 'text-slate-300']"
              :data-on="on ? 'true' : 'false'"
              >⭐</span
            >
          </div>
        </div>
        <p
          class="mb-3 line-clamp-2 text-base leading-relaxed font-semibold break-words text-slate-700"
          data-testid="dash-recent-text"
        >
          {{ q.text }}
        </p>
        <div class="flex items-center justify-between gap-2">
          <span class="text-xs font-semibold text-slate-400">{{ diffForHumans(q.createdAt) }}</span>
          <span
            class="rounded-full px-3 py-1 text-xs font-black"
            :style="{
              background: `${subjectColorByName(subjects, q.subjectName)}25`,
              color: subjectColorByName(subjects, q.subjectName),
            }"
            data-testid="dash-recent-level"
          >
            {{ q.levelCode }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
