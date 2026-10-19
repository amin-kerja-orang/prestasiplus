<script setup lang="ts">
/** "Statistik Subjek" (FR-M05-28): bank size, average difficulty (stars) and times used per subject. */
import { computed, ref } from 'vue'

import { DsIconChip } from '@/ds'

import type { DashboardSubjectStat } from '../../api/types'
import { starStates } from '../dashboard/dashboard-lib'
import { subjectAccent, subjectGlyph } from '../quiz/subject-glyph'

const props = defineProps<{ stats: DashboardSubjectStat[] }>()

/** Compact by default: the first 6 rows, then "Lihat semua". */
const COMPACT = 6
const showAll = ref(false)
const shown = computed(() => (showAll.value ? props.stats : props.stats.slice(0, COMPACT)))
</script>

<template>
  <section
    class="flex flex-col gap-3"
    aria-labelledby="dash-subject-stats-h"
    data-testid="dash-subject-stats"
  >
    <h2 id="dash-subject-stats-h" class="text-heading text-highlighted">📊 Statistik Subjek</h2>
    <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <li v-for="(s, idx) in shown" :key="s.id" class="min-w-0" data-testid="dash-subject-stat">
        <UCard :ui="{ body: 'flex flex-col gap-3 p-4' }">
          <div class="flex items-center gap-3">
            <DsIconChip
              :icon="subjectGlyph(s.icon)"
              :accent="subjectAccent(idx)"
              size="lg"
              data-testid="dash-stat-icon"
            />
            <div class="min-w-0">
              <p class="truncate text-subheading text-highlighted" data-testid="dash-stat-name">
                {{ s.name }}
              </p>
              <p class="text-caption text-muted" data-testid="dash-stat-bank">
                {{ s.bankCount }} soalan
              </p>
            </div>
          </div>
          <div class="flex items-center justify-between gap-2 text-label text-muted">
            <span class="flex items-center gap-2">
              Kesukaran:
              <span class="flex" data-testid="dash-stat-stars" aria-hidden="true">
                <span
                  v-for="(on, i) in starStates(s.avgDifficulty)"
                  :key="i"
                  :class="on ? 'text-warning' : 'text-dimmed'"
                  :data-on="on ? 'true' : 'false'"
                  >★</span
                >
              </span>
            </span>
            <span
              >Digunakan: <span data-testid="dash-stat-used">{{ s.usedCount }}x</span></span
            >
          </div>
        </UCard>
      </li>
    </ul>
    <UButton
      v-if="stats.length > 6"
      color="neutral"
      variant="soft"
      class="min-h-11 self-center"
      :aria-expanded="showAll ? 'true' : 'false'"
      data-testid="dash-subject-stats-toggle"
      @click="showAll = !showAll"
      >{{ showAll ? 'Tunjuk kurang' : 'Lihat semua' }}</UButton
    >
  </section>
</template>
