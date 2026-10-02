<script setup lang="ts">
/**
 * S1 "🎓 Perbandingan Tingkatan" (FR-M08-19) and "👩‍🏫 Prestasi Guru" (FR-M08-20). The level figures are the
 * S2/S3 level aggregate (DV-M08-05); "On Track" / "Below" per teacher are null until the headcount
 * figures exist (M08-T1b), which shows "Tiada data headcount".
 */
import { RouterLink } from 'vue-router'

import type { SchoolPerformance } from '../../api/types'
import {
  LEVEL_BAR,
  LEVEL_TEXT,
  TEACHER_TEXT,
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
  <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
    <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="levels-card">
      <h3 class="mb-4 text-base font-bold text-slate-700">🎓 Perbandingan Tingkatan</h3>
      <div class="space-y-4">
        <RouterLink
          v-for="l in levels"
          :key="l.code"
          :to="`/prestasi/tingkatan/${l.code}`"
          class="block rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:shadow-md"
          :data-testid="`level-card-${l.code}`"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="font-bold text-slate-800">Tingkatan {{ levelNumber(l.code) }}</span>
            <span :class="['text-xl font-bold', LEVEL_TEXT[accuracyTone(l.accuracy)]]">{{
              pct1(l.accuracy)
            }}</span>
          </div>
          <div class="my-2 h-2 rounded-full bg-slate-200">
            <div
              :class="['h-2 rounded-full', LEVEL_BAR[accuracyTone(l.accuracy)]]"
              :style="{ width: `${Math.floor(l.accuracy)}%` }"
            ></div>
          </div>
          <div class="flex flex-wrap gap-x-4 text-xs text-slate-500">
            <span>{{ plain(l.classes) }} kelas</span>
            <span>{{ plain(l.students) }} murid</span>
            <span>{{ plain(l.sessions) }} sesi latihan</span>
          </div>
        </RouterLink>
      </div>
    </section>

    <section class="min-w-0 rounded-2xl bg-white p-5 shadow" data-testid="teachers-card">
      <h3 class="mb-4 text-base font-bold text-slate-700">👩‍🏫 Prestasi Guru</h3>
      <div class="max-h-96 space-y-3 overflow-y-auto" data-testid="teachers-list">
        <div
          v-for="t in teachers"
          :key="t.userId"
          class="rounded-xl border border-slate-100 bg-slate-50 p-3"
          :data-testid="`teacher-${t.userId}`"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
            <span class="min-w-0 font-semibold break-words text-slate-800">{{ t.name }}</span>
            <span class="text-xs text-slate-500"
              >{{ t.classCount }} kelas · {{ t.studentCount }} murid</span
            >
          </div>
          <div class="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span class="text-slate-500"
              >Ketepatan:
              <strong :class="TEACHER_TEXT[accuracyTone(t.accuracy)]">{{
                pct1(t.accuracy)
              }}</strong></span
            >
            <span v-if="t.onTrack === null || t.below === null" class="text-slate-400"
              >Tiada data headcount</span
            >
            <template v-else>
              <span class="text-emerald-400"
                >On Track: <strong>{{ t.onTrack }}</strong></span
              >
              <span class="text-red-400"
                >Below: <strong>{{ t.below }}</strong></span
              >
            </template>
          </div>
          <div
            v-if="t.onTrack !== null && t.below !== null"
            class="mt-2 h-1.5 rounded-full bg-slate-200"
          >
            <div
              class="h-1.5 rounded-full bg-emerald-500"
              :style="{ width: `${teacherBar(t.onTrack, t.below)}%` }"
            ></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>
