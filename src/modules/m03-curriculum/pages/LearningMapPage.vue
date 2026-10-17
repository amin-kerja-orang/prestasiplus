<script setup lang="ts">
/**
 * S14 `/peta-belajar` "Peta Belajar — PRESTASIPLUS" (M03-T4; FR-M03-80..90, BR-14/15). Hero with the
 * subject label, stat tiles (`md` and up) and a static bar, the selectors card (7 subject pills,
 * Darjah 1-4 chips in one row) and the map: above 768 px a vertical path with a dot per node and
 * islands alternating right/left, at 768 px and below islands centred with no path or dots.
 * The server serves the effective subject and grade (defaults, fallback to Darjah 4).
 */
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useApi } from '@/composables'
import { DsEmptyState, DsPage } from '@/ds'

import { fetchLearningMap } from '../api/student-curriculum'
import MapIsland from '../components/student/MapIsland.vue'
import { LOAD_ERROR, MAP_GRADES, gradeLabel, mapTo, readFilter } from '../lib/student-catalogue'

const route = useRoute()
const subject = computed(() => readFilter(route.query.subject))
const grade = computed(() => readFilter(route.query.grade))

const { data: map, error } = useApi(
  (signal) => fetchLearningMap({ subject: subject.value, grade: grade.value, signal }),
  [subject, grade],
)
</script>

<template>
  <DsPage data-testid="map-page">
    <UAlert
      v-if="error"
      color="error"
      variant="soft"
      icon="i-ph-warning-circle-duotone"
      :title="LOAD_ERROR"
      data-testid="map-error"
    />

    <template v-else-if="map">
      <section
        class="rounded-3xl bg-gradient-primary p-5 text-primary-on shadow-hero sm:p-8"
        data-testid="map-hero"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <h1 class="font-display text-title font-extrabold break-words">🗺️ Peta Belajar</h1>
            <p class="mt-1 text-body" data-testid="map-subtitle">
              Terokai perjalanan {{ map.subjectLabel }} — takluki setiap pulau! 🏝️
            </p>
          </div>
          <div class="hidden gap-3 md:flex" data-testid="map-tiles">
            <div class="rounded-chip bg-primary-on/15 px-5 py-3 text-center">
              <div class="text-title font-extrabold" data-testid="map-done">
                {{ map.stats.done }}/{{ map.stats.total }}
              </div>
              <div class="text-caption">Topik Selesai</div>
            </div>
            <div class="rounded-chip bg-primary-on/15 px-5 py-3 text-center">
              <div class="text-title font-extrabold" data-testid="map-progress">
                {{ map.stats.progress }}%
              </div>
              <div class="text-caption">Kemajuan</div>
            </div>
          </div>
        </div>
        <UProgress :model-value="map.stats.progress" size="md" class="mt-4" data-testid="map-bar" />
      </section>

      <section
        class="flex flex-col gap-3 rounded-card bg-default p-4 shadow-lift sm:p-5"
        data-testid="map-selectors"
      >
        <nav class="flex flex-wrap gap-2" aria-label="Subjek" data-testid="map-subject-pills">
          <UButton
            v-for="s in map.subjects"
            :key="s.code"
            :to="mapTo(s.code, map.grade)"
            size="lg"
            :color="s.code === map.subject ? 'primary' : 'neutral'"
            :variant="s.code === map.subject ? 'solid' : 'soft'"
            class="min-h-11 rounded-full"
            :data-active="s.code === map.subject ? 'true' : 'false'"
            data-testid="map-subject-pill"
          >
            {{ s.emoji }} {{ s.label }}
          </UButton>
        </nav>
        <nav class="flex gap-2" aria-label="Darjah" data-testid="map-grade-chips">
          <UButton
            v-for="g in MAP_GRADES"
            :key="g"
            :to="mapTo(map.subject, g)"
            size="lg"
            :color="g === map.grade ? 'primary' : 'neutral'"
            :variant="g === map.grade ? 'solid' : 'soft'"
            class="min-h-11 flex-1 justify-center"
            :data-active="g === map.grade ? 'true' : 'false'"
            data-testid="map-grade-chip"
          >
            {{ gradeLabel(g) }}
          </UButton>
        </nav>
      </section>

      <div
        v-if="map.topics.length === 0"
        class="rounded-card bg-default p-6 shadow-lift"
        data-testid="map-empty"
      >
        <div class="text-center text-display" aria-hidden="true">🗺️</div>
        <DsEmptyState
          icon="i-ph-map-trifold-duotone"
          title="Tiada Topik Dijumpai"
          description="Pilih subjek dan darjah yang lain untuk melihat peta belajar"
        />
      </div>

      <div v-else class="flex flex-col gap-6 py-2" data-testid="map-container">
        <MapIsland v-for="(t, i) in map.topics" :key="t.id" :topic="t" :index="i" />
      </div>
    </template>
  </DsPage>
</template>
