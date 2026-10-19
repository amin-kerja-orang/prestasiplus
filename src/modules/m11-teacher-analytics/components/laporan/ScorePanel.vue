<script setup lang="ts">
/**
 * FN-M11-2.2.10: "Pecahan Skor Purata", five bar cards (no Permainan, as live). "-%" is error text over
 * an empty error bar at 0%; values > 0 take the BR-M11-22 colours (success / warning / error).
 */
import type { TeacherReport } from '../../api/types'
import { LAPORAN_COPY } from './copy'
import { bandOf, SCORE_COLOR, SCORE_TEXT, type ScoreKey } from './format'

defineProps<{ score: TeacherReport['score'] }>()

const BARS: { key: ScoreKey; label: string; icon: string }[] = [
  { key: 'kuiz', label: 'Kuiz', icon: 'i-ph-question' },
  { key: 'struktur', label: 'Struktur', icon: 'i-ph-list-numbers' },
  { key: 'latihTubi', label: 'Latih Tubi', icon: 'i-ph-barbell' },
  { key: 'trackingA', label: 'Tracking A', icon: 'i-ph-crosshair' },
  { key: 'battle', label: 'Battle', icon: 'i-ph-lightning' },
]
</script>

<template>
  <UCard data-testid="panel-skor">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-label text-highlighted">
        <UIcon name="i-ph-chart-bar" class="size-4 text-primary-t" />{{ LAPORAN_COPY.scoreBreakdown }}
      </h2>
      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div
          v-for="b in BARS"
          :key="b.key"
          class="flex min-w-0 flex-col gap-2 bg-soft p-3"
          :data-testid="`bar-${b.key}`"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="flex min-w-0 items-center gap-1 text-label text-default">
              <UIcon :name="b.icon" class="size-4 shrink-0 text-muted" />{{ b.label }}
            </span>
            <span
              v-if="score.byType[b.key] === null"
              class="tabular text-label text-error"
              data-testid="bar-value"
              >{{ LAPORAN_COPY.noScore }}</span
            >
            <span
              v-else
              :class="['tabular text-label', SCORE_TEXT[bandOf(score.byType[b.key] as number)]]"
              data-testid="bar-value"
              >{{ score.byType[b.key] }}%</span
            >
          </div>
          <UProgress
            :model-value="score.byType[b.key] ?? 0"
            :color="
              score.byType[b.key] === null
                ? 'error'
                : SCORE_COLOR[bandOf(score.byType[b.key] as number)]
            "
            size="sm"
            :data-value="score.byType[b.key] ?? 0"
            :data-color="
              score.byType[b.key] === null
                ? 'error'
                : SCORE_COLOR[bandOf(score.byType[b.key] as number)]
            "
            data-testid="bar-fill"
          />
        </div>
      </div>
    </div>
  </UCard>
</template>
