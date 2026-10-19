<script setup lang="ts">
/** S11 "Tahap Penguasaan Subjek" (FN-M14-2.1.8; FR-M14-20): read-only M05 mastery rows. */
import { DsIconChip } from '@/ds'

import type { DashboardMastery } from '../../api'
import { gamClampPct, gamStageLabel, gamTrimNumber } from '../../lib/student/s11-format'

defineProps<{ rows: readonly DashboardMastery[] }>()

const barPct = (r: DashboardMastery) =>
  r.nextTarget === null ? 100 : r.nextTarget > 0 ? gamClampPct((r.correct / r.nextTarget) * 100) : 0
const isActive = (r: DashboardMastery) => gamStageLabel(r.stage) === 'Aktif'
</script>

<template>
  <UCard class="min-w-0" data-testid="s11-mastery">
    <div class="flex flex-col gap-3">
      <h2 class="flex items-center gap-2 font-display text-subheading font-bold text-highlighted">
        <DsIconChip icon="stack" accent="win" size="sm" />Tahap Penguasaan Subjek
      </h2>
      <ul class="grid grid-cols-1 gap-2 md:grid-cols-2">
        <li
          v-for="(r, i) in rows"
          :key="`${r.subjectName}-${i}`"
          class="flex min-w-0 items-center gap-3 rounded-card bg-elevated p-3"
          data-testid="s11-mastery-row"
        >
          <DsIconChip
            :icon="isActive(r) ? 'i-ph-lightning-duotone' : 'i-ph-seedling-duotone'"
            :accent="isActive(r) ? 'action' : 'heat'"
            size="sm"
          />
          <div class="flex min-w-0 flex-1 flex-col gap-1">
            <div class="flex items-center justify-between gap-2">
              <span class="min-w-0 truncate text-label text-highlighted"
                >L{{ r.level }} · {{ r.subjectName }}</span
              >
              <UBadge
                :color="isActive(r) ? 'primary' : 'warning'"
                variant="subtle"
                size="sm"
                class="shrink-0"
                >{{ gamStageLabel(r.stage) }}</UBadge
              >
            </div>
            <UProgress
              :model-value="barPct(r)"
              :max="100"
              size="sm"
              :color="isActive(r) ? 'primary' : 'warning'"
              :aria-label="`Penguasaan ${r.subjectName}`"
            />
            <div class="flex flex-wrap items-center justify-between gap-x-2 text-caption text-muted">
              <span data-testid="s11-mastery-correct"
                >{{ r.correct }} betul<template v-if="r.nextTarget !== null">
                  / {{ r.nextTarget }}</template
                ></span
              >
              <span data-testid="s11-mastery-accuracy"
                >{{ gamTrimNumber(r.accuracy) }}% tepat<template v-if="r.multiplier > 1">
                  · {{ r.multiplier }}x bonus</template
                ></span
              >
            </div>
          </div>
        </li>
      </ul>
    </div>
  </UCard>
</template>
