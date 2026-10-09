<script setup lang="ts">
/**
 * S0 "Ringkasan Prestasi" card (FR-M27-31…37): blue icon tile, title and subtitle, then four panels (GPS
 * SEKOLAH, AMARAN AWAL, LATIHAN, TINGKATAN) and the grade list. 4 panels per row at 1280, 2 at 768, 1 at 375
 * (FR-M27-25). AMARAN AWAL is rendered when the M18 risk read answers (`risk` not null; XR-M27-08 resolved).
 * The TINGKATAN panel is the link to `/prestasi/tingkatan`. No-data states follow BR-M27-18.
 */
import { ChartColumn } from '@lucide/vue'
import { RouterLink } from 'vue-router'

import type { SchoolDashboard } from '../../api/dashboard'
import GradeList from './GradeList.vue'
import {
  BAND_PANEL,
  BAND_TEXT,
  barWidth,
  count,
  DEFAULT_GPS_PANEL,
  gps,
  levelTone,
  PATHS,
  percent,
} from './dashboard-format'

defineProps<{ performance: SchoolDashboard['performance'] }>()

const PANEL = 'flex min-w-0 flex-col rounded-xl border p-4'
const CENTRED = 'items-center justify-center text-center'
const PANEL_LABEL = 'text-xs font-bold uppercase tracking-wide'
</script>

<template>
  <section class="min-w-0 rounded-2xl bg-white p-4 shadow sm:p-6" data-testid="sd-performance">
    <div class="flex min-w-0 items-center gap-3">
      <span
        class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white sm:h-12 sm:w-12"
      >
        <ChartColumn class="h-5 w-5" />
      </span>
      <div class="min-w-0">
        <h2 class="text-base font-bold text-slate-800" data-testid="sd-performance-title">
          Ringkasan Prestasi
        </h2>
        <p class="text-xs text-slate-500 sm:text-sm" data-testid="sd-performance-subtitle">
          GPS, risiko murid, ketepatan latihan &amp; perbandingan tingkatan
        </p>
      </div>
    </div>

    <div
      class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
      data-testid="sd-panels"
    >
      <div
        :class="[
          PANEL,
          CENTRED,
          performance.gps.band
            ? (BAND_PANEL[performance.gps.band] ?? DEFAULT_GPS_PANEL)
            : DEFAULT_GPS_PANEL,
        ]"
        data-testid="sd-panel-gps"
      >
        <p :class="[PANEL_LABEL, 'text-amber-600']">GPS Sekolah</p>
        <p
          :class="[
            'mt-1 text-4xl font-bold',
            performance.gps.band
              ? (BAND_TEXT[performance.gps.band] ?? 'text-amber-500')
              : 'text-amber-500',
          ]"
          data-testid="sd-gps-value"
        >
          {{ gps(performance.gps.value) }}
        </p>
        <p
          v-if="performance.gps.grade && performance.gps.band"
          :class="['text-sm font-semibold', BAND_TEXT[performance.gps.band] ?? 'text-amber-500']"
          data-testid="sd-gps-grade"
        >
          {{ performance.gps.grade }} · {{ performance.gps.band }}
        </p>
        <p class="mt-1 text-xs text-slate-500" data-testid="sd-gps-entries">
          {{ count(performance.gps.entries) }} entri headcount
        </p>
      </div>

      <div
        v-if="performance.risk"
        :class="[PANEL, CENTRED, 'border-rose-200 bg-rose-50']"
        data-testid="sd-panel-risk"
      >
        <p :class="[PANEL_LABEL, 'text-rose-600']">Amaran Awal</p>
        <div class="mt-2 flex items-start justify-center gap-4">
          <div>
            <p class="text-2xl font-bold text-green-600" data-testid="sd-risk-safe">
              {{ count(performance.risk.safe) }}
            </p>
            <p class="text-xs font-semibold text-green-600">Selamat</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-amber-500" data-testid="sd-risk-watch">
              {{ count(performance.risk.watch) }}
            </p>
            <p class="text-xs font-semibold text-amber-500">Berhati</p>
          </div>
          <div>
            <p class="text-2xl font-bold text-red-600" data-testid="sd-risk-high">
              {{ count(performance.risk.high) }}
            </p>
            <p class="text-xs font-semibold text-red-600">Berisiko</p>
          </div>
        </div>
        <p class="mt-2 text-xs text-slate-500" data-testid="sd-risk-total">
          {{ count(performance.risk.total) }} murid dinilai
        </p>
      </div>

      <div
        :class="[PANEL, CENTRED, 'border-violet-200 bg-violet-50']"
        data-testid="sd-panel-practice"
      >
        <p :class="[PANEL_LABEL, 'text-violet-600']">Latihan</p>
        <p class="mt-1 text-4xl font-bold text-violet-700" data-testid="sd-practice-accuracy">
          {{ percent(performance.practice.accuracy) }}
        </p>
        <p class="text-sm font-semibold text-violet-500">Purata Ketepatan</p>
        <p class="mt-1 text-xs text-slate-500" data-testid="sd-practice-counts">
          {{ count(performance.practice.sessions) }} sesi ·
          {{ count(performance.practice.questions) }} soalan
        </p>
      </div>

      <RouterLink
        :to="PATHS.levels"
        :class="[PANEL, 'border-indigo-200 bg-indigo-50']"
        data-testid="sd-panel-levels"
      >
        <p :class="[PANEL_LABEL, 'text-center text-indigo-600']">Tingkatan</p>
        <div
          v-for="level in performance.levels"
          :key="level.code"
          class="mt-2"
          data-testid="sd-level-row"
        >
          <div class="flex items-baseline justify-between gap-2 text-sm">
            <span class="font-semibold text-slate-700">{{ level.name }}</span>
            <span
              :class="['font-bold', levelTone(level.accuracy).text]"
              data-testid="sd-level-pct"
              >{{ percent(level.accuracy) }}</span
            >
          </div>
          <div class="mt-1 h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              :class="['h-full rounded-full', levelTone(level.accuracy).bar]"
              :style="{ width: `${barWidth(level.accuracy)}%` }"
              data-testid="sd-level-bar"
            ></div>
          </div>
        </div>
        <p class="mt-3 text-center text-xs text-slate-500">Click untuk detail</p>
      </RouterLink>
    </div>

    <GradeList :distribution="performance.distribution" :total="performance.total" />
  </section>
</template>
