<script setup lang="ts">
/**
 * S6 "Penguasaan Subjek" (FR-M08-40): per practised subject a chip (the first two letters of the subject
 * code), the name, a bar (≥ 80 success, 60–79.9 warning, < 60 error; INFERRED bands), "{round(x)}%" and
 * "{n} sesi · {m} soalan"; or the empty state with "Mula Berlatih" → `/practice`.
 */
import { DsEmptyState, DsPanel, DsStack, DsGrid, DsCluster, DsText } from '@/ds'

import type { StudentPerformance } from '../../api/types'
import { usePhIcon } from '../../lib/icons'
import { masteryTone } from '../../lib/analitik'

defineProps<{ mastery: StudentPerformance['mastery'] }>()

const icon = usePhIcon()
</script>

<template>
  <DsPanel class="lg:col-span-2" data-testid="mastery-card">
    <DsStack>
      <h2 class="flex items-center gap-2 text-subheading text-highlighted">
        <UIcon :name="icon('books')" class="size-5 text-primary-t" />Penguasaan Subjek
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
      <DsGrid v-else :cols="{ base: 1, sm: 2 }" gap="sm" as="ul" data-testid="mastery-list">
        <li
          v-for="m in mastery"
          :key="m.subjectCode"
          class="flex min-w-0 items-center gap-3 bg-soft p-3"
          :data-testid="`mastery-${m.subjectCode}`"
        >
          <UAvatar :text="m.subjectCode.slice(0, 2).toUpperCase()" size="lg" aria-hidden="true" />
          <DsStack gap="2xs" class="grow">
            <DsText variant="label" as="p" tone="highlighted" truncate>{{ m.subjectName }}</DsText>
            <DsCluster gap="xs" :wrap="false">
              <UProgress
                class="min-w-0 grow"
                :model-value="Math.min(m.accuracy, 100)"
                :max="100"
                :color="masteryTone(m.accuracy).color"
                size="sm"
                :aria-label="`Penguasaan ${m.subjectName}`"
              />
              <span :class="[masteryTone(m.accuracy).text, 'tabular text-label']" data-testid="pct"
                >{{ Math.round(m.accuracy) }}%</span
              >
            </DsCluster>
            <DsText variant="caption">{{ m.sessions }} sesi · {{ m.answered }} soalan</DsText>
          </DsStack>
        </li>
      </DsGrid>
    </DsStack>
  </DsPanel>
</template>
