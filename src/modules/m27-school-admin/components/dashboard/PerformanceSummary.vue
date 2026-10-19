<script setup lang="ts">
/**
 * S0 "Ringkasan Prestasi" card (FR-M27-31…37; restyle spec AS-2): title and subtitle, then four panels (GPS
 * SEKOLAH, AMARAN AWAL, LATIHAN, TINGKATAN) and the grade chart. 4 panels per row at 1280, 2 at 768, 1 at
 * 375 (FR-M27-25). AMARAN AWAL is rendered when the M18 risk read answers (`risk` not null; XR-M27-08
 * resolved). The TINGKATAN panel is the link to `/prestasi/tingkatan`. No-data states follow BR-M27-18.
 * Colour appears only on the figures that carry a meaning (GPS band, risk, level accuracy).
 */
import { RouterLink } from 'vue-router'

import { DsIconChip, DsPanel, DsCluster, DsStack, DsHeading, DsText } from '@/ds'

import type { SchoolDashboard } from '../../api/dashboard'
import GradeList from './GradeList.vue'
import { barWidth, count, gps, PATHS, percent } from './dashboard-format'

defineProps<{ performance: SchoolDashboard['performance'] }>()
</script>

<template>
  <DsPanel data-testid="sd-performance">
    <DsCluster :wrap="false">
      <DsIconChip icon="chart-bar" size="lg" />
      <div class="min-w-0">
        <DsHeading :level="2" variant="subheading" data-testid="sd-performance-title">
          Ringkasan Prestasi
        </DsHeading>
        <DsText variant="caption" data-testid="sd-performance-subtitle">
          GPS, risiko murid, ketepatan latihan &amp; perbandingan tingkatan
        </DsText>
      </div>
    </DsCluster>

    <div
      class="mt-4 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"
      data-testid="sd-panels"
    >
      <DsPanel tone="inset" data-testid="sd-panel-gps">
        <DsStack gap="2xs" align="center" justify="center" class="text-center">
          <DsText variant="overline" as="p">GPS Sekolah</DsText>
          <p
            class="tabular text-display"
            :class="
              performance.gps.band === 'Cemerlang'
                ? 'text-success'
                : performance.gps.band === 'Baik'
                  ? 'text-info'
                  : performance.gps.band === 'Perlu Perhatian'
                    ? 'text-error'
                    : 'text-cat-5'
            "
            data-testid="sd-gps-value"
          >
            {{ gps(performance.gps.value) }}
          </p>
          <p
            v-if="performance.gps.grade && performance.gps.band"
            class="text-label"
            :class="
              performance.gps.band === 'Cemerlang'
                ? 'text-success'
                : performance.gps.band === 'Baik'
                  ? 'text-info'
                  : performance.gps.band === 'Perlu Perhatian'
                    ? 'text-error'
                    : 'text-cat-5'
            "
            data-testid="sd-gps-grade"
          >
            {{ performance.gps.grade }} · {{ performance.gps.band }}
          </p>
          <DsText variant="caption" data-testid="sd-gps-entries">
            {{ count(performance.gps.entries) }} entri headcount
          </DsText>
        </DsStack>
      </DsPanel>

      <DsPanel v-if="performance.risk" tone="inset" data-testid="sd-panel-risk">
        <DsStack gap="2xs" align="center" justify="center" class="text-center">
          <DsText variant="overline" as="p">Amaran Awal</DsText>
          <div class="mt-1 flex items-start justify-center gap-4">
            <div>
              <DsText variant="heading" tone="success" tabular data-testid="sd-risk-safe">
                {{ count(performance.risk.safe) }}
              </DsText>
              <DsText variant="caption" tone="success">Selamat</DsText>
            </div>
            <div>
              <DsText variant="heading" tone="warning" tabular data-testid="sd-risk-watch">
                {{ count(performance.risk.watch) }}
              </DsText>
              <DsText variant="caption" tone="warning">Berhati</DsText>
            </div>
            <div>
              <DsText variant="heading" tone="error" tabular data-testid="sd-risk-high">
                {{ count(performance.risk.high) }}
              </DsText>
              <DsText variant="caption" tone="error">Berisiko</DsText>
            </div>
          </div>
          <DsText variant="caption" data-testid="sd-risk-total">
            {{ count(performance.risk.total) }} murid dinilai
          </DsText>
        </DsStack>
      </DsPanel>

      <DsPanel tone="inset" data-testid="sd-panel-practice">
        <DsStack gap="2xs" align="center" justify="center" class="text-center">
          <DsText variant="overline" as="p">Latihan</DsText>
          <DsText variant="display" tabular data-testid="sd-practice-accuracy">
            {{ percent(performance.practice.accuracy) }}
          </DsText>
          <DsText variant="label" as="p" tone="muted">Purata Ketepatan</DsText>
          <DsText variant="caption" data-testid="sd-practice-counts">
            {{ count(performance.practice.sessions) }} sesi ·
            {{ count(performance.practice.questions) }} soalan
          </DsText>
        </DsStack>
      </DsPanel>

      <RouterLink :to="PATHS.levels" class="block min-w-0" data-testid="sd-panel-levels">
        <DsPanel tone="inset" class="h-full hover:bg-elevated">
          <DsText variant="overline" as="p" align="center">Tingkatan</DsText>
          <div
            v-for="level in performance.levels"
            :key="level.code"
            class="mt-2"
            data-testid="sd-level-row"
          >
            <DsCluster gap="xs" align="baseline" justify="between" :wrap="false">
              <DsText variant="label" tone="highlighted">{{ level.name }}</DsText>
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
            </DsCluster>
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
        </DsPanel>
      </RouterLink>
    </div>

    <div class="mt-6">
      <GradeList :distribution="performance.distribution" :total="performance.total" />
    </div>
  </DsPanel>
</template>
