<script setup lang="ts">
/**
 * S1 "🎓 Perbandingan Tingkatan" (FR-M08-19) and "👩‍🏫 Prestasi Guru" (FR-M08-20). The level figures are the
 * S2/S3 level aggregate (DV-M08-05); "On Track" / "Below" per teacher are null until the headcount
 * figures exist (M08-T1b), which shows "Tiada data headcount".
 */
import { DsPanel } from '@/ds'
import { RouterLink } from 'vue-router'

import type { SchoolPerformance } from '../../api/types'
import {
  TONE_COLOR,
  TONE_TEXT,
  accuracyTone,
  levelNumber,
  pct1,
  plain,
} from '../../lib/prestasi/format'

defineProps<{
  levels: SchoolPerformance['levels']
  teachers: SchoolPerformance['teachers']
}>()

const teacherBar = (on: number, below: number): number =>
  on + below > 0 ? Math.round((on / (on + below)) * 100) : 0
</script>

<template>
  <div class="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
    <DsPanel class="min-w-0" data-testid="levels-card">
      <div class="flex flex-col gap-4">
        <h2 class="text-subheading text-highlighted">🎓 Perbandingan Tingkatan</h2>
        <RouterLink
          v-for="l in levels"
          :key="l.code"
          :to="`/prestasi/tingkatan/${l.code}`"
          class="flex flex-col gap-2 bg-soft p-4"
          :data-testid="`level-card-${l.code}`"
        >
          <span class="flex items-baseline justify-between gap-3">
            <span class="text-label text-highlighted">Tingkatan {{ levelNumber(l.code) }}</span>
            <span :class="[TONE_TEXT[accuracyTone(l.accuracy)], 'tabular text-heading']">{{
              pct1(l.accuracy)
            }}</span>
          </span>
          <UProgress
            :model-value="Math.floor(l.accuracy)"
            :max="100"
            :color="TONE_COLOR[accuracyTone(l.accuracy)]"
            :aria-label="`Ketepatan Tingkatan ${levelNumber(l.code)}`"
          />
          <span class="flex flex-wrap gap-x-4 text-caption text-muted">
            <span>{{ plain(l.classes) }} kelas</span>
            <span>{{ plain(l.students) }} murid</span>
            <span>{{ plain(l.sessions) }} sesi latihan</span>
          </span>
        </RouterLink>
      </div>
    </DsPanel>

    <DsPanel class="min-w-0" data-testid="teachers-card">
      <div class="flex flex-col gap-4">
        <h2 class="text-subheading text-highlighted">👩‍🏫 Prestasi Guru</h2>
        <ul class="flex max-h-96 flex-col gap-3 overflow-y-auto" data-testid="teachers-list">
          <li
            v-for="t in teachers"
            :key="t.userId"
            class="flex flex-col gap-2 bg-soft p-3"
            :data-testid="`teacher-${t.userId}`"
          >
            <div class="flex flex-wrap items-baseline justify-between gap-x-3">
              <span class="min-w-0 text-label break-words text-highlighted">{{ t.name }}</span>
              <span class="text-caption text-muted"
                >{{ t.classCount }} kelas · {{ t.studentCount }} murid</span
              >
            </div>
            <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption">
              <span class="text-muted"
                >Ketepatan:
                <span :class="TONE_TEXT[accuracyTone(t.accuracy)]"
                  ><strong>{{ pct1(t.accuracy) }}</strong></span></span
              >
              <span v-if="t.onTrack === null || t.below === null" class="text-dimmed"
                >Tiada data headcount</span
              >
              <template v-else>
                <span class="text-success"
                  >On Track: <strong>{{ t.onTrack }}</strong></span
                >
                <span class="text-error"
                  >Below: <strong>{{ t.below }}</strong></span
                >
              </template>
            </div>
            <UProgress
              v-if="t.onTrack !== null && t.below !== null"
              :model-value="teacherBar(t.onTrack, t.below)"
              :max="100"
              color="success"
              size="sm"
              :aria-label="`On Track ${t.name}`"
            />
          </li>
        </ul>
      </div>
    </DsPanel>
  </div>
</template>
