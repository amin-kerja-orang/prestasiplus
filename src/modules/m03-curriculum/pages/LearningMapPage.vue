<script setup lang="ts">
/**
 * S14 `/peta-belajar` "Peta Belajar — PRESTASIPLUS" (M03-T4; FR-M03-80..90, BR-14/15). Hero with the
 * subject label, stat tiles (`md` and up) and a static bar, the selectors card (7 subject pills,
 * Darjah 1-4 chips in one row) and the map: above 768 px a vertical path with a dot per node and
 * islands alternating right/left, at 768 px and below islands centred with no path or dots.
 * The server serves the effective subject and grade (defaults, fallback to Darjah 4).
 */
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { AlertBox } from '@/components/feedback'
import { useApi } from '@/composables'

import { fetchLearningMap } from '../api/student-curriculum'
import MapIsland from '../components/student/MapIsland.vue'
import { LOAD_ERROR, MAP_GRADES, dotTop, gradeLabel, mapTo, readFilter } from '../lib/student-catalogue'

const route = useRoute()
const subject = computed(() => readFilter(route.query.subject))
const grade = computed(() => readFilter(route.query.grade))

const { data: map, error } = useApi(
  (signal) => fetchLearningMap({ subject: subject.value, grade: grade.value, signal }),
  [subject, grade],
)

const DOT: Record<string, string> = {
  mastered: 'bg-emerald-500',
  started: 'bg-blue-500',
  unlocked: 'bg-amber-400',
  locked: 'bg-slate-300',
}

const PILL = 'inline-flex min-h-11 items-center rounded-full border-2 px-4 py-2 text-sm font-semibold transition'
const CHIP = 'inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 py-2 text-sm font-bold transition'
</script>

<template>
  <div class="space-y-5" data-testid="map-page">
    <AlertBox v-if="error" :messages="LOAD_ERROR" data-testid="map-error" />

    <template v-else-if="map">
      <section
        class="rounded-[2rem] bg-gradient-to-br from-[#059669] via-[#10B981] to-[#34D399] p-5 text-white shadow-lg sm:p-8"
        data-testid="map-hero"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h1 class="font-heading text-2xl font-bold sm:text-3xl">🗺️ Peta Belajar</h1>
            <p class="mt-1 text-sm text-white/90 sm:text-base" data-testid="map-subtitle">
              Terokai perjalanan {{ map.subjectLabel }} — takluki setiap pulau! 🏝️
            </p>
          </div>
          <div class="hidden gap-3 md:flex" data-testid="map-tiles">
            <div class="rounded-2xl bg-white/20 px-5 py-3 text-center">
              <div class="font-heading text-2xl font-bold" data-testid="map-done">
                {{ map.stats.done }}/{{ map.stats.total }}
              </div>
              <div class="text-xs">Topik Selesai</div>
            </div>
            <div class="rounded-2xl bg-white/20 px-5 py-3 text-center">
              <div class="font-heading text-2xl font-bold" data-testid="map-progress">
                {{ map.stats.progress }}%
              </div>
              <div class="text-xs">Kemajuan</div>
            </div>
          </div>
        </div>
        <div class="relative mt-4 h-3 overflow-hidden rounded-full bg-white/30">
          <div
            class="relative h-full rounded-full bg-gradient-to-r from-yellow-300 to-amber-400"
            :style="{ width: `${String(map.stats.progress)}%` }"
            data-testid="map-bar"
          >
            <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"></div>
          </div>
        </div>
      </section>

      <section class="space-y-3 rounded-2xl bg-white p-4 shadow sm:p-5" data-testid="map-selectors">
        <nav class="flex flex-wrap gap-2" aria-label="Subjek" data-testid="map-subject-pills">
          <RouterLink
            v-for="s in map.subjects"
            :key="s.code"
            :to="mapTo(s.code, map.grade)"
            :class="[
              PILL,
              s.code === map.subject ? 'text-white' : 'border-transparent bg-slate-50 text-slate-600',
            ]"
            :style="s.code === map.subject ? { backgroundColor: s.color, borderColor: s.color } : {}"
            :data-active="s.code === map.subject ? 'true' : 'false'"
            data-testid="map-subject-pill"
          >
            {{ s.emoji }} {{ s.label }}
          </RouterLink>
        </nav>
        <nav class="flex gap-2" aria-label="Darjah" data-testid="map-grade-chips">
          <RouterLink
            v-for="g in MAP_GRADES"
            :key="g"
            :to="mapTo(map.subject, g)"
            :class="[
              CHIP,
              g === map.grade
                ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white'
                : 'bg-slate-100 text-slate-600',
            ]"
            :data-active="g === map.grade ? 'true' : 'false'"
            data-testid="map-grade-chip"
          >
            {{ gradeLabel(g) }}
          </RouterLink>
        </nav>
      </section>

      <div
        v-if="map.topics.length === 0"
        class="rounded-2xl bg-white p-10 text-center shadow"
        data-testid="map-empty"
      >
        <div class="text-5xl" aria-hidden="true">🗺️</div>
        <h3 class="mt-3 font-heading text-lg font-bold text-slate-800">Tiada Topik Dijumpai</h3>
        <p class="mt-1 text-sm text-slate-500">
          Pilih subjek dan darjah yang lain untuk melihat peta belajar
        </p>
      </div>

      <div v-else class="relative space-y-6 py-2" data-testid="map-container">
        <div
          class="absolute top-0 bottom-0 left-1/2 hidden w-1 -translate-x-1/2 rounded-full bg-emerald-300 min-[769px]:block"
          data-testid="map-path"
        ></div>
        <span
          v-for="(t, i) in map.topics"
          :key="`dot-${String(t.id)}`"
          class="absolute left-1/2 hidden h-4 w-4 -translate-x-1/2 rounded-full border-2 border-white shadow min-[769px]:block"
          :class="DOT[t.state]"
          :style="{ top: dotTop(i, map.topics.length) }"
          :data-state="t.state"
          data-testid="path-dot"
        ></span>
        <MapIsland v-for="(t, i) in map.topics" :key="t.id" :topic="t" :index="i" />
      </div>
    </template>
  </div>
</template>
