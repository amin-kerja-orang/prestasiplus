<script setup lang="ts">
/**
 * S6 "Penguasaan Subjek" (FR-M08-40): per practised subject a chip (the first two letters of the subject
 * code), the name, a bar (≥ 80 success, 60–79.9 warning, < 60 error; INFERRED bands), "{round(x)}%" and
 * "{n} sesi · {m} soalan"; or the empty state with "Mula Berlatih" → `/practice`.
 */
import { DsEmptyState } from '@/ds'

import type { StudentPerformance } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { masteryTone } from '../../lib/analitik'
import ToneText from '../shared/ToneText.vue'

defineProps<{ mastery: StudentPerformance['mastery'] }>()

const icon = usePhIcon()
</script>

<template>
  <UCard class="lg:col-span-2" data-testid="mastery-card">
    <div class="flex flex-col gap-4">
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('books')" class="size-5 text-primary" />Penguasaan Subjek
      </h2>
      <div v-if="mastery.length === 0" data-testid="mastery-empty">
        <DsEmptyState title="Belum ada data latihan." icon="i-ph-chart-pie">
          <template #actions>
            <UButton
              to="/practice"
              size="lg"
              :icon="icon('play')"
              label="Mula Berlatih"
              data-testid="mastery-start"
            />
          </template>
        </DsEmptyState>
      </div>
      <ul v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2" data-testid="mastery-list">
        <li
          v-for="m in mastery"
          :key="m.subjectCode"
          class="flex min-w-0 items-center gap-3 bg-soft p-3"
          :data-testid="`mastery-${m.subjectCode}`"
        >
          <UAvatar :text="m.subjectCode.slice(0, 2).toUpperCase()" size="lg" aria-hidden="true" />
          <div class="flex min-w-0 grow flex-col gap-1">
            <p class="truncate text-label text-highlighted">{{ m.subjectName }}</p>
            <div class="flex items-center gap-2">
              <UProgress
                class="min-w-0 grow"
                :model-value="Math.min(m.accuracy, 100)"
                :max="100"
                :color="masteryTone(m.accuracy).color"
                size="sm"
                :aria-label="`Penguasaan ${m.subjectName}`"
              />
              <ToneText
                :tone="masteryTone(m.accuracy).text"
                class="tabular text-label"
                data-testid="pct"
                >{{ Math.round(m.accuracy) }}%</ToneText
              >
            </div>
            <p class="text-caption text-muted">{{ m.sessions }} sesi · {{ m.answered }} soalan</p>
          </div>
        </li>
      </ul>
    </div>
  </UCard>
</template>
