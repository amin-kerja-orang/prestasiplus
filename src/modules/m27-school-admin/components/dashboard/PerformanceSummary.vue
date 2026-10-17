<script setup lang="ts">
/**
 * S0 "Ringkasan Prestasi" card (FR-M27-31…37; restyle spec AS-2): title and subtitle, then four panels (GPS
 * SEKOLAH, AMARAN AWAL, LATIHAN, TINGKATAN) and the grade chart. 4 panels per row at 1280, 2 at 768, 1 at
 * 375 (FR-M27-25). AMARAN AWAL is rendered when the M18 risk read answers (`risk` not null; XR-M27-08
 * resolved). The TINGKATAN panel is the link to `/prestasi/tingkatan`. No-data states follow BR-M27-18.
 * Colour appears only on the figures that carry a meaning (GPS band, risk, level accuracy).
 */
import { RouterLink } from 'vue-router'

import { DsIconChip } from '@/ds'

import type { SchoolDashboard } from '../../api/dashboard'
import GradeList from './GradeList.vue'
import { barWidth, count, gps, PATHS, percent } from './dashboard-format'

defineProps<{ performance: SchoolDashboard['performance'] }>()

</script>

<template>
  <UCard data-testid="sd-performance">
    <div class="flex min-w-0 items-center gap-3">
      <DsIconChip icon="i-ph-chart-bar-duotone" size="lg" />
      <div class="min-w-0">
        <h2 class="text-subheading text-highlighted" data-testid="sd-performance-title">
          Ringkasan Prestasi
        </h2>
        <p class="text-caption text-muted" data-testid="sd-performance-subtitle">
          GPS, risiko murid, ketepatan latihan &amp; perbandingan tingkatan
        </p>
      </div>
    </div>

    <div
      class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
      data-testid="sd-panels"
    >
      <UCard variant="soft" :ui="{ body: 'flex h-full min-w-0 flex-col gap-1 p-4' }" data-testid="sd-panel-gps">
        <div class="flex flex-col items-center justify-center gap-1 text-center">
          <p class="text-overline text-muted">GPS Sekolah</p>
          <p
            class="tabular text-display"
            :class="
              performance.gps.band === 'Cemerlang' ? 'text-success' : performance.gps.band === 'Baik' ? 'text-info' : performance.gps.band === 'Perlu Perhatian' ? 'text-error' : 'text-cat-5'
            "
            data-testid="sd-gps-value"
          >
            {{ gps(performance.gps.value) }}
          </p>
          <p
            v-if="performance.gps.grade && performance.gps.band"
            class="text-label"
            :class="
              performance.gps.band === 'Cemerlang' ? 'text-success' : performance.gps.band === 'Baik' ? 'text-info' : performance.gps.band === 'Perlu Perhatian' ? 'text-error' : 'text-cat-5'
            "
            data-testid="sd-gps-grade"
          >
            {{ performance.gps.grade }} · {{ performance.gps.band }}
          </p>
          <p class="text-caption text-muted" data-testid="sd-gps-entries">
            {{ count(performance.gps.entries) }} entri headcount
          </p>
        </div>
      </UCard>

      <UCard v-if="performance.risk" variant="soft" :ui="{ body: 'flex h-full min-w-0 flex-col gap-1 p-4' }" data-testid="sd-panel-risk">
        <div class="flex flex-col items-center justify-center gap-1 text-center">
          <p class="text-overline text-muted">Amaran Awal</p>
          <div class="mt-1 flex items-start justify-center gap-4">
            <div>
              <p class="tabular text-heading text-success" data-testid="sd-risk-safe">
                {{ count(performance.risk.safe) }}
              </p>
              <p class="text-caption text-success">Selamat</p>
            </div>
            <div>
              <p class="tabular text-heading text-warning" data-testid="sd-risk-watch">
                {{ count(performance.risk.watch) }}
              </p>
              <p class="text-caption text-warning">Berhati</p>
            </div>
            <div>
              <p class="tabular text-heading text-error" data-testid="sd-risk-high">
                {{ count(performance.risk.high) }}
              </p>
              <p class="text-caption text-error">Berisiko</p>
            </div>
          </div>
          <p class="text-caption text-muted" data-testid="sd-risk-total">
            {{ count(performance.risk.total) }} murid dinilai
          </p>
        </div>
      </UCard>

      <UCard variant="soft" :ui="{ body: 'flex h-full min-w-0 flex-col gap-1 p-4' }" data-testid="sd-panel-practice">
        <div class="flex flex-col items-center justify-center gap-1 text-center">
          <p class="text-overline text-muted">Latihan</p>
          <p class="tabular text-display text-highlighted" data-testid="sd-practice-accuracy">
            {{ percent(performance.practice.accuracy) }}
          </p>
          <p class="text-label text-muted">Purata Ketepatan</p>
          <p class="text-caption text-muted" data-testid="sd-practice-counts">
            {{ count(performance.practice.sessions) }} sesi ·
            {{ count(performance.practice.questions) }} soalan
          </p>
        </div>
      </UCard>

      <RouterLink :to="PATHS.levels" class="block min-w-0" data-testid="sd-panel-levels">
        <UCard variant="soft" :ui="{ body: 'flex h-full min-w-0 flex-col gap-1 p-4' }" class="h-full hover:bg-elevated">
          <p class="text-center text-overline text-muted">Tingkatan</p>
          <div
            v-for="level in performance.levels"
            :key="level.code"
            class="mt-2"
            data-testid="sd-level-row"
          >
            <div class="flex items-baseline justify-between gap-2">
              <span class="text-label text-highlighted">{{ level.name }}</span>
              <span
                class="tabular text-label"
                :class="
                  level.accuracy < 50
                    ? 'text-error'
                    : level.accuracy < 70
                      ? 'text-warning'
                      : 'text-success'
                "
                data-testid="sd-level-pct"
                >{{ percent(level.accuracy) }}</span
              >
            </div>
            <UProgress
              :model-value="barWidth(level.accuracy)"
              :max="100"
              size="sm"
              :color="level.accuracy < 50 ? 'error' : level.accuracy < 70 ? 'warning' : 'success'"
              :aria-label="`Ketepatan ${level.name}`"
              data-testid="sd-level-bar"
            />
          </div>
          <p class="mt-3 text-center text-caption text-muted">Click untuk detail</p>
        </UCard>
      </RouterLink>
    </div>

    <div class="mt-6">
      <GradeList :distribution="performance.distribution" :total="performance.total" />
    </div>
  </UCard>
</template>
