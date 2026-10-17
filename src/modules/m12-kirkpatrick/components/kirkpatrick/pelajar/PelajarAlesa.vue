<script setup lang="ts">
/**
 * The ALESA card of S8 (FN-M12-9.2.1 ... 9.2.3; FR-M12-79 ... 81): "AI" badge, the composed paragraph, four tiles (2 x 2 below
 * `sm`) and the "Terkuat: … · Perlu perhatian: …" line (empty for a student without answers).
 */
import { computed } from 'vue'

import type { StudentKirkpatrick } from '../../../api/types'
import { count, mean, pct, pct1 } from '../common/kirkpatrick-format'
import { alesaParagraph } from './pelajar-format'

const props = defineProps<{ data: StudentKirkpatrick }>()

const paragraph = computed(() => alesaParagraph(props.data))
</script>

<template>
  <UCard as="section" class="min-w-0" data-testid="pel-alesa">
    <template #header>
      <div class="flex items-center gap-3">
        <UBadge color="primary" variant="soft" label="AI" />
        <h2 class="text-subheading text-highlighted">ALESA — Analisis Tingkah Laku Kirkpatrick</h2>
      </div>
    </template>
    <p class="text-body text-default" data-testid="pel-paragraph">{{ paragraph }}</p>
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
    <p v-if="data.strongest && data.weakest" class="mt-3 text-caption text-muted" data-testid="pel-strength">
      Terkuat:
      <strong>{{ data.strongest.subjectName }} ({{ pct1(data.strongest.accuracy) }})</strong>
      · Perlu perhatian:
      <strong>{{ data.weakest.subjectName }} ({{ pct1(data.weakest.accuracy) }})</strong>
    </p>
  </UCard>
</template>
