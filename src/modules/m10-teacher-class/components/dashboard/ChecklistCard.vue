<script setup lang="ts">
/** FN-M10-2.1.2: "Senarai Semak Guru" (FR-M10-09, BR-M10-05). */
import { computed } from 'vue'

import { DsIconChip, DsPanel } from '@/ds'
import { usePrototypeScope } from '@/composables'

import type { GuruDashboard } from '../../api/types'
import { DASH_COPY } from './copy'
import { checklistProgress } from './lib'

const props = defineProps<{ checklist: GuruDashboard['checklist'] }>()
// Prototype scope (D43): the "Misi harian" row links to a screen outside the matrix.
const { allows } = usePrototypeScope()
const progress = computed(() => checklistProgress(props.checklist))
const ICONS = ['i-ph-laptop-duotone', 'i-ph-users-three-duotone', 'i-ph-rocket-launch-duotone']
</script>

<template>
  <DsPanel data-testid="checklist-card">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="flex items-center gap-2 text-subheading text-highlighted">
          <UIcon name="i-ph-clipboard-text-duotone" class="size-5 shrink-0 text-primary-t" />{{
            DASH_COPY.checklistTitle
          }}
        </h2>
        <p class="text-caption text-muted" data-testid="checklist-count">
          {{ progress.done }}/3 langkah selesai
        </p>
      </div>
      <p class="tabular text-heading text-highlighted" data-testid="checklist-percent">
        {{ progress.percent }}%
      </p>
    </div>
    <UProgress
      :model-value="progress.percent"
      class="mt-3"
      aria-label="Kemajuan senarai semak"
      data-testid="checklist-bar"
    />
    <ul class="mt-4 flex flex-col gap-2">
      <li
        v-for="(row, i) in DASH_COPY.checklistRows"
        :key="row.key"
        :data-done="checklist[row.key]"
        data-testid="checklist-row"
      >
        <DsPanel tone="inset">
          <div class="flex min-w-0 items-center gap-3">
            <DsIconChip :icon="checklist[row.key] ? 'i-ph-check-circle-duotone' : ICONS[i]!" />
            <div class="min-w-0 flex-1">
              <p class="text-label text-highlighted">{{ row.title }}</p>
              <p class="text-caption text-muted">{{ row.text }}</p>
            </div>
            <UButton
              v-if="allows(row.to)"
              :to="row.to"
              size="sm"
              color="neutral"
              variant="soft"
              class="shrink-0"
              data-testid="checklist-link"
              >{{ DASH_COPY.view }}</UButton
            >
          </div>
        </DsPanel>
      </li>
    </ul>
  </DsPanel>
</template>
