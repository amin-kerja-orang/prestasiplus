<script setup lang="ts">
/** "Statistik Subjek" (FR-M05-28): bank size, average difficulty (stars) and times used per subject. */
import { computed, ref } from 'vue'

import { DsIconChip, DsStack, DsGrid, DsCluster, DsHeading, DsText } from '@/ds'

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
  <DsStack
    as="section"
    gap="sm"
    aria-labelledby="dash-subject-stats-h"
    data-testid="dash-subject-stats"
  >
    <DsHeading id="dash-subject-stats-h" :level="2">📊 Statistik Subjek</DsHeading>
    <DsGrid :cols="{ base: 1, sm: 2, xl: 3 }" gap="sm" as="ul">
      <li v-for="(s, idx) in shown" :key="s.id" class="min-w-0" data-testid="dash-subject-stat">
        <UCard :ui="{ body: 'flex flex-col gap-3 p-4' }">
          <DsCluster :wrap="false">
            <DsIconChip
              :icon="subjectGlyph(s.icon)"
              :accent="subjectAccent(idx)"
              size="lg"
              data-testid="dash-stat-icon"
            />
            <div class="min-w-0">
              <DsText variant="subheading" truncate data-testid="dash-stat-name">
                {{ s.name }}
              </DsText>
              <DsText variant="caption" data-testid="dash-stat-bank">
                {{ s.bankCount }} soalan
              </DsText>
            </div>
          </DsCluster>
          <div class="flex items-center justify-between gap-2 text-label text-muted">
            <DsCluster as="span" gap="xs" :wrap="false">
              Kesukaran:
              <DsCluster
                as="span"
                gap="none"
                align="stretch"
                :wrap="false"
                data-testid="dash-stat-stars"
                aria-hidden="true"
              >
                <span
                  v-for="(on, i) in starStates(s.avgDifficulty)"
                  :key="i"
                  :class="on ? 'text-warning' : 'text-dimmed'"
                  :data-on="on ? 'true' : 'false'"
                  >★</span
                >
              </DsCluster>
            </DsCluster>
            <span
              >Digunakan: <span data-testid="dash-stat-used">{{ s.usedCount }}x</span></span
            >
          </div>
        </UCard>
      </li>
    </DsGrid>
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
  </DsStack>
</template>
