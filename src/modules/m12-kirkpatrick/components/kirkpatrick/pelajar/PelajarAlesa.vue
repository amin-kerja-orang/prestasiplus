<script setup lang="ts">
/**
 * The ALESA card of S8 (FN-M12-9.2.1 ... 9.2.3; FR-M12-79 ... 81): "AI" badge, the composed paragraph, four tiles (2 x 2 below
 * `sm`) and the "Terkuat: … · Perlu perhatian: …" line (empty for a student without answers).
 */
import { computed } from 'vue'

import { isAlesaAiOn } from '@/app/features'
import { DsPanel } from '@/ds'

import type { StudentKirkpatrick } from '../../../api/types'
import { count, mean, pct, pct1 } from '../common/kirkpatrick-format'
import { alesaParagraph } from './pelajar-format'

const props = defineProps<{ data: StudentKirkpatrick }>()

const paragraph = computed(() => alesaParagraph(props.data))
// VITE_ALESA_AI off (D73): the AI badge, the ALESA heading and the generated paragraph go; the real
// figures (Soalan, Ketepatan, Konsistensi, Streak, Terkuat) stay under a plain heading.
const alesaOn = isAlesaAiOn()
</script>

<template>
  <DsPanel
    as="section"
    :title="alesaOn ? 'ALESA — Analisis Tingkah Laku Kirkpatrick' : 'Ringkasan Pelajar'"
    :icon="alesaOn ? 'sparkle' : 'user-circle'"
    class="min-w-0"
    data-testid="pel-alesa"
  >
    <template v-if="alesaOn" #actions><UBadge color="primary" variant="soft" label="AI" /></template>
    <p v-if="alesaOn" class="text-body text-default" data-testid="pel-paragraph">{{ paragraph }}</p>
    <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-answers">
        <p class="tabular text-heading text-highlighted">{{ count(data.answers) }}</p>
        <p class="text-caption text-muted">Soalan</p>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-accuracy">
        <p class="tabular text-heading text-highlighted">{{ pct(data.accuracy) }}</p>
        <p class="text-caption text-muted">Ketepatan</p>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-konsistensi">
        <p class="tabular text-heading text-highlighted">{{ mean(data.konsistensi) }}</p>
        <p class="text-caption text-muted">Konsistensi</p>
      </UCard>
      <UCard variant="soft" class="min-w-0 text-center" data-testid="pel-tile-streak">
        <p class="tabular text-heading text-highlighted">{{ data.streak }}d</p>
        <p class="text-caption text-muted">Streak</p>
      </UCard>
    </div>
    <p
      v-if="data.strongest && data.weakest"
      class="mt-3 text-caption text-muted"
      data-testid="pel-strength"
    >
      Terkuat:
      <strong>{{ data.strongest.subjectName }} ({{ pct1(data.strongest.accuracy) }})</strong>
      · Perlu perhatian:
      <strong>{{ data.weakest.subjectName }} ({{ pct1(data.weakest.accuracy) }})</strong>
    </p>
  </DsPanel>
</template>
